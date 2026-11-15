import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const ENV_APPS_SCRIPT_URL = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim();

export function isStaticHostWithoutBackend(): boolean {
  if (API_BASE_URL) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith('github.io') || host.endsWith('pages.dev');
}

function resolveAppsScriptUrl(settingsUrl?: string): string {
  return (settingsUrl || ENV_APPS_SCRIPT_URL || '').trim();
}

export async function postToAppsScript(
  scriptUrl: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; fileUrl?: string; error?: string; skipped?: boolean }> {
  if (!scriptUrl || scriptUrl === 'MY_APPS_SCRIPT_URL') {
    return {
      success: false,
      skipped: true,
      error: 'Apps Script /exec URL is not configured.',
    };
  }

  try {
    const parsed = new URL(scriptUrl);
    if (parsed.pathname.endsWith('/edit')) {
      return {
        success: false,
        skipped: true,
        error: 'Apps Script URL points to /edit. Deploy as Web App and paste the /exec URL.',
      };
    }

    // Use text/plain to avoid CORS preflight failures on Google Apps Script Web Apps
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (text.trim().startsWith('<')) {
      return {
        success: false,
        skipped: true,
        error: 'Apps Script returned HTML instead of JSON. Ensure Web App access is set to "Anyone".',
      };
    }

    const parsedJson = JSON.parse(text);
    return {
      success: Boolean(parsedJson.success ?? true),
      fileUrl: parsedJson.fileUrl,
      error: parsedJson.error,
    };
  } catch (err: any) {
    return {
      success: false,
      skipped: true,
      error: err?.message || 'Apps Script request could not complete from browser.',
    };
  }
}

export async function syncToSheetsAndDrive(
  payload: Record<string, unknown>,
  appsScriptUrl?: string
): Promise<{ success: boolean; fileUrl?: string; error?: string; skipped?: boolean }> {
  if (!isStaticHostWithoutBackend()) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/sheets/sync`, payload);
      return response.data;
    } catch (err: any) {
      const fallbackUrl = resolveAppsScriptUrl(appsScriptUrl);
      if (fallbackUrl) {
        return postToAppsScript(fallbackUrl, payload);
      }
      return {
        success: false,
        skipped: true,
        error: err?.response?.data?.error || err?.message || 'Sheets sync unavailable.',
      };
    }
  }

  const scriptUrl = resolveAppsScriptUrl(appsScriptUrl);
  return postToAppsScript(scriptUrl, payload);
}

export async function sendTransactionalEmail(
  payload: {
    to: string;
    subject: string;
    templateName: string;
    params?: Record<string, unknown>;
  },
  appsScriptUrl?: string
): Promise<void> {
  if (!isStaticHostWithoutBackend()) {
    try {
      await axios.post(`${API_BASE_URL}/api/email/send`, payload);
      return;
    } catch {
      // Fall through to optional Apps Script email relay
    }
  }

  const scriptUrl = resolveAppsScriptUrl(appsScriptUrl);
  if (scriptUrl) {
    await postToAppsScript(scriptUrl, { action: 'sendEmail', ...payload });
  }
}

export async function createGatewayOrder(payload: {
  amount: number;
  currency?: string;
  receipt: string;
}): Promise<{ id: string }> {
  if (isStaticHostWithoutBackend()) {
    return { id: `order_gh_${Date.now()}` };
  }
  const response = await axios.post(`${API_BASE_URL}/api/payment/order`, payload);
  return response.data;
}

export async function verifyGatewayPayment(payload: {
  paymentId: string;
  orderId: string;
  signature: string;
}): Promise<{ success: boolean }> {
  if (isStaticHostWithoutBackend()) {
    return { success: true };
  }
  const response = await axios.post(`${API_BASE_URL}/api/payments/verify`, payload);
  return response.data;
}

export async function fetchRecommendedEventIds(
  userInterests: string[],
  allEvents: Array<{ id: string; title: string; category: string; registeredCount: number }>
): Promise<string[] | null> {
  if (isStaticHostWithoutBackend()) {
    return null;
  }
  const response = await axios.post(`${API_BASE_URL}/api/recommendations`, {
    userInterests,
    allEvents,
  });
  const recs = response.data?.recommendations || [];
  return recs.slice(0, 3).map((e: any) => e.id);
}
