import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  QrCode,
  Shield,
  LayoutDashboard,
  HelpCircle,
  Utensils,
  Copy,
  Mail,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PublicNavbar from '../components/PublicNavbar';
import { useDocumentSeo } from '../lib/seo';

export default function HowToUse() {
  const navigate = useNavigate();
  const { platformSettings } = useAuth();
  const { showToast } = useToast();

  useDocumentSeo({
    title: 'Platform Guide — Campus Connect',
    description: 'Step-by-step guide to student passes, societies, canteen QR redemptions, digital certificates, and analytics.',
    canonicalPath: '/how-to-use',
  });

  const supportEmail = platformSettings.supportEmail || 'yugalofficial63@gmail.com';

  const steps = [
    {
      icon: User,
      title: '1. Sign Up & Role Approval',
      desc: 'Register with your campus email or Google account as a Student, Organiser, or Canteen Partner. Organiser and Canteen accounts are reviewed and approved by the Super Admin before accessing operational dashboards.',
      role: 'Everyone',
    },
    {
      icon: Calendar,
      title: '2. Discover & Register for Events',
      desc: 'Students browse curated campus events, follow student societies, check the interactive Calendar, and register for free or paid events via UPI / Razorpay with instant ticket verification.',
      role: 'Students',
    },
    {
      icon: QrCode,
      title: '3. Attendance & Food Coupon QR Passes',
      desc: 'Confirmed registrations unlock a tamper-resistant Attendance QR pass and, when included, a Food Coupon QR pass synced in real time across check-in desks and the Canteen Portal.',
      role: 'Students & Canteen',
    },
    {
      icon: LayoutDashboard,
      title: '4. Event Hosting & Analytics',
      desc: 'Organisers create events, brand their Society profile, verify student payments, scan attendance QR codes, export attendance PDF reports, and settle canteen food coupon payouts.',
      role: 'Organisers',
    },
    {
      icon: Utensils,
      title: '5. Canteen Verification & Payouts',
      desc: 'Canteen staff scan student food coupon QR codes after attendance check-in, track daily redemptions, configure their UPI ID, and submit payout requests directly to event organisers.',
      role: 'Canteen',
    },
    {
      icon: Shield,
      title: '6. Super Admin Governance',
      desc: 'The Super Admin approves or suspends accounts, provisions new user credentials directly, moderates societies, revokes invalid certificates, monitors immutable audit logs, and triggers Google Sheets / Drive sync.',
      role: 'Super Admin',
    },
    {
      icon: Award,
      title: '7. Verified Digital Certificates & Analytics',
      desc: 'Organisers design custom A4 certificates with drag-and-drop layouts and issue QR-verified PDF credentials to checked-in attendees. Anyone can verify authenticity via Certificate ID on the public portal.',
      role: 'Organisers & Students',
    },
  ];

  const handleCopySupport = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      showToast(`Copied support email: ${supportEmail}`, 'success');
    } catch {
      showToast(`Support email: ${supportEmail}`, 'info');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicNavbar />
      <div className="w-full px-4 sm:px-6 pt-5 sm:pt-6 pb-8 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 sm:gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 glass border border-border-subtle rounded-full flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Platform Guide</h1>
          <p className="text-secondary text-sm">How Campus Connect works for every role</p>
        </div>
      </header>

      <div className="space-y-5">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle"
          >
            <div className="flex items-center gap-3.5 sm:gap-4 mb-3 min-w-0">
              <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                <step.icon size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold break-words">{step.title}</h3>
                <p className="text-xs font-semibold text-primary">{step.role}</p>
              </div>
            </div>
            <p className="text-secondary text-sm leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}

        <section className="pt-4">
          <div className="glass p-5 sm:p-8 rounded-3xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <HelpCircle className="text-primary shrink-0" size={22} />
              <h2 className="text-lg sm:text-xl font-bold">Need Account or Event Support?</h2>
            </div>
            <p className="text-secondary text-sm mb-6 leading-relaxed break-words">
              For role approvals, society onboarding, or payment settlement help, reach out to the
              Campus Admin at <span className="text-primary font-bold break-all">{supportEmail}</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`mailto:${supportEmail}?subject=Campus%20Connect%20Support`}
                className="flex-1 bg-primary text-white py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95"
              >
                <Mail size={16} />
                Email Support
              </a>
              <button
                type="button"
                onClick={handleCopySupport}
                className="flex-1 glass border border-border-subtle py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:border-primary/40"
              >
                <Copy size={16} />
                Copy Email Address
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
