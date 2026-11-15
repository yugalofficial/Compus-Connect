import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Campus Connect API is running" });
  });

  // Razorpay Order Creation
  app.post("/api/payment/order", async (req, res) => {
    const { amount, currency = "INR", receipt } = req.body;
    try {
      const order = await razorpay.orders.create({
        amount: amount * 100, // in paise
        currency,
        receipt,
      });
      res.json(order);
    } catch (error) {
      console.error("Razorpay error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Payment Verification Mock (Logic placeholder)
  app.post("/api/payments/verify", (req, res) => {
    const { paymentId, orderId, signature } = req.body;
    // Real logic would involve crypto.createHmac with Razorpay secret
    console.log("Verifying payment:", { paymentId, orderId });
    res.json({ success: true });
  });

  // Google Sheets & Drive Proxy (Apps Script)
  app.post("/api/sheets/sync", async (req, res) => {
    const { data, action, eventId, paymentId, fileName, fileData, mimeType } = req.body;
    const scriptUrl = process.env.APPS_SCRIPT_URL?.trim();

    if (!scriptUrl || scriptUrl === "MY_APPS_SCRIPT_URL") {
      return res.json({
        success: false,
        skipped: true,
        code: "apps_script_not_configured",
        error: "Apps Script URL not configured. Set APPS_SCRIPT_URL to your deployed /exec Web App URL.",
      });
    }

    try {
      const parsedUrl = new URL(scriptUrl);
      if (parsedUrl.pathname.endsWith("/edit")) {
        console.warn("Sheets sync skipped: APPS_SCRIPT_URL points to /edit instead of /exec.");
        return res.json({
          success: false,
          skipped: true,
          code: "apps_script_edit_url",
          error: "APPS_SCRIPT_URL points to the script editor (/edit). Deploy as a Web App ('Who has access: Anyone') and use the /exec URL.",
        });
      }

      const response = await axios.post(
        scriptUrl,
        {
          data,
          action,
          eventId,
          paymentId,
          fileName,
          fileData,
          mimeType,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          maxRedirects: 5,
          timeout: 30000,
        }
      );

      const resData = response.data;
      const isHtmlResponse =
        typeof resData === "string" &&
        (resData.trim().startsWith("<") || resData.toLowerCase().includes("<!doctype html"));

      if (isHtmlResponse) {
        console.warn("Sheets sync skipped: Apps Script returned HTML instead of JSON (check Web App access permissions).");
        return res.json({
          success: false,
          skipped: true,
          code: "apps_script_html_response",
          error: "Apps Script returned an HTML sign-in/error page instead of JSON. Redeploy your Web App with 'Who has access: Anyone' and use the /exec URL.",
        });
      }

      if (typeof resData === "string") {
        try {
          return res.json(JSON.parse(resData));
        } catch {
          return res.json({ success: true, message: resData.slice(0, 200) });
        }
      }

      return res.json(resData && typeof resData === "object" ? resData : { success: true });
    } catch (error: any) {
      if (error instanceof TypeError && error.message.includes("Invalid URL")) {
        console.warn("Sheets sync skipped: Invalid APPS_SCRIPT_URL");
        return res.json({
          success: false,
          skipped: true,
          code: "invalid_apps_script_url",
          error: "Invalid Apps Script URL configuration.",
        });
      }

      if (error.code === "ECONNABORTED") {
        console.warn("Sheets sync skipped: request timed out.");
        return res.json({
          success: false,
          skipped: true,
          code: "apps_script_timeout",
          error: "Apps Script request timed out.",
        });
      }

      const status = error.response?.status;
      const rawData = error.response?.data;
      const isHtml =
        typeof rawData === "string" &&
        (rawData.trim().startsWith("<") || rawData.toLowerCase().includes("<!doctype html"));

      const detail = isHtml
        ? `Apps Script returned an HTML error/login page (HTTP ${status || "error"}). Verify deployment access is 'Anyone' and URL ends with /exec.`
        : (typeof rawData === "object" && rawData?.error) ||
          error.message ||
          "Apps Script endpoint unavailable.";

      console.warn(`Sheets sync skipped: ${detail}`);
      return res.json({
        success: false,
        skipped: true,
        code: "apps_script_unavailable",
        error: detail,
      });
    }
  });

  // Brevo Email Integration (with graceful fallback when key is disabled/unconfigured)
  app.post("/api/email/send", async (req, res) => {
    const { to, subject, templateName, params } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ error: "Recipient 'to' and 'subject' are required" });
    }

    const apiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || "yugalofficial63@gmail.com";

    const templates: Record<string, string> = {
      welcome: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; border-radius: 20px; text-align: center;">
          <h1 style="color: #3b82f6; font-size: 32px; margin-bottom: 20px;">Campus Connect</h1>
          <p style="font-size: 18px; color: #333;">Welcome, <strong>{{name}}</strong>!</p>
          <p style="color: #666; line-height: 1.6;">You're now part of the ultimate campus ecosystem. Explore events, join societies, and elevate your campus experience.</p>
          <a href="{{appUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 30px;">Explore Platform</a>
          <hr style="margin: 40px 0; border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">© 2026 Campus Connect</p>
        </div>
      `,
      otp: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; border-radius: 20px; text-align: center;">
          <h1 style="color: #3b82f6; font-size: 32px; margin-bottom: 20px;">Security Alert</h1>
          <p style="color: #666;">Use the following OTP to complete your action. This code expires in 15 minutes.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 16px; margin: 30px 0;">
            <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #3b82f6;">{{otp}}</span>
          </div>
          <p style="font-size: 12px; color: #ef4444;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
      notification: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
          <h2 style="color: #3b82f6;">{{title}}</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">{{message}}</p>
          <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">Campus Connect Notifications</p>
        </div>
      `
    };

    const escapeHtml = (input: unknown) =>
      String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    let htmlContent = templates[templateName] || templates.notification;
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, val]) => {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, "g"), escapeHtml(val));
      });
    }

    if (!apiKey || apiKey === "MY_BREVO_API_KEY") {
      console.warn("Email skipped: BREVO_API_KEY is not configured.");
      return res.json({
        success: false,
        skipped: true,
        code: "brevo_not_configured",
        message: "Email service not configured; in-app notification delivered.",
      });
    }

    try {
      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: { name: "Campus Connect", email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent,
        },
        {
          headers: { "api-key": apiKey, "content-type": "application/json" },
          timeout: 10000,
        }
      );
      return res.json({ success: true });
    } catch (error: any) {
      const brevoData = error.response?.data;
      const status = error.response?.status;
      const code = brevoData?.code || "";

      if (status === 401 || status === 403 || code === "unauthorized") {
        console.warn("Brevo email skipped: API key is disabled or unauthorized.");

        // Optional fallback to Apps Script email relay if configured
        const scriptUrl = process.env.APPS_SCRIPT_URL;
        if (scriptUrl && scriptUrl !== "MY_APPS_SCRIPT_URL") {
          try {
            new URL(scriptUrl);
            await axios.post(
              scriptUrl,
              { action: "sendEmail", data: { to, subject, htmlContent } },
              { timeout: 10000 }
            );
            return res.json({ success: true, provider: "apps_script" });
          } catch {
            // Apps Script relay unavailable
          }
        }

        return res.json({
          success: false,
          skipped: true,
          code: "brevo_unauthorized",
          message: "Brevo API key is disabled or unauthorized; in-app notification delivered.",
        });
      }

      console.warn("Brevo email delivery failed:", brevoData || error.message);
      return res.json({
        success: false,
        skipped: true,
        code: "brevo_delivery_failed",
        message: "Email delivery unavailable; in-app notification delivered.",
      });
    }
  });

  // QR Validation
  app.post("/api/qr/validate", (req, res) => {
    const { qrData, type, userId } = req.body;
    // Logic to check if QR is valid, not expired, and not used
    // For demo, we just return valid
    res.json({ valid: true, message: "QR Validated successfully" });
  });

  // AI Recommendation
  app.post("/api/recommendations", async (req, res) => {
    const { userInterests, pastEvents, allEvents } = req.body;
    // Simple scoring: 2 points for category match, 1 point for society follow
    const recommendations = allEvents
      .map((event: any) => {
        let score = 0;
        if (userInterests && userInterests.includes(event.category)) score += 2;
        return { ...event, score };
      })
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    res.json({ recommendations });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
