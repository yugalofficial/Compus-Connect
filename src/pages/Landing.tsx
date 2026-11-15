import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, ShieldCheck, Utensils, Users, ArrowRight, CalendarCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../components/ProtectedRoute';
import ThemeToggle from '../components/ThemeToggle';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { HERO_BANNER_IMAGE } from '../lib/media';

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [user, loading, navigate]);

  const roles = [
    {
      icon: CalendarCheck,
      title: 'Students',
      desc: 'Discover campus events, pay via UPI or Razorpay, access instant attendance tickets, and unlock meal coupons.',
    },
    {
      icon: Users,
      title: 'Event Organisers',
      desc: 'Launch events and societies, verify payments, scan attendee QRs, export PDF reports, and settle canteen payouts.',
    },
    {
      icon: Utensils,
      title: 'Canteen Vendors',
      desc: 'Validate student food coupon QRs in real time, prevent double redemption, and submit payout requests directly.',
    },
    {
      icon: ShieldCheck,
      title: 'Super Admin',
      desc: 'Approve user registrations, provision credentials, manage roles, oversee payouts, and sync records to Google Sheets.',
    },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Public Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-50 h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-3 sm:px-6 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-2 sm:gap-8 min-w-0">
          <Link to="/" className="text-base sm:text-lg font-extrabold tracking-tight font-display whitespace-nowrap shrink-0 truncate min-w-0">
            Campus <span className="text-primary">Connect</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-secondary">
            <a href="#roles" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">Portals</a>
            <a href="#workflow" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">Workflow</a>
            <Link to="/how-to-use" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">Platform Guide</Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <PWAInstallButton variant="compact" />
            <ThemeToggle />
            <Link
              to="/login"
              className="px-3 sm:px-4 py-2 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center min-w-0">
            <p className="text-xs font-semibold text-primary tracking-wide mb-3">
              Campus Operations · Events, Attendance & Canteen Billing
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] mb-5">
              One platform for every campus event and portal.
            </h1>
            <p className="text-base sm:text-lg text-secondary leading-relaxed mb-8 max-w-xl">
              Manage student registrations, verified QR check-ins, canteen meal coupon redemptions, and Super Admin credential approvals from a unified real-time system.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Access Your Portal
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/how-to-use"
                className="px-6 py-3.5 rounded-xl border border-border-subtle font-semibold text-sm flex items-center justify-center hover:bg-secondary/10 transition-colors"
              >
                Read Platform Guide
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] lg:min-h-[420px] rounded-3xl overflow-hidden border border-border-subtle relative bg-slate-900">
              <img
                src={HERO_BANNER_IMAGE}
                alt="University campus innovation hub"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs font-medium text-white/80">Real-Time Firebase & Google Workspace Sync</p>
                <p className="text-base font-bold mt-0.5">Role-verified access for Students, Organisers, Canteen & Admin</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Portals */}
      <section id="roles" className="border-t border-border-subtle py-14 px-4 sm:px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Built for every campus role</h2>
            <p className="text-sm sm:text-base text-secondary">
              Every profile signs in with verified credentials, passes Super Admin approval, and routes directly to its dedicated workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {roles.map((r) => (
              <div key={r.title} className="glass rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <r.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{r.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Strip */}
      <section id="workflow" className="border-t border-border-subtle py-12 sm:py-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto glass rounded-3xl p-6 sm:p-8 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="flex gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-base mb-1">01. Super Admin Approval</h4>
              <p className="text-sm text-secondary">New accounts are reviewed and approved by the Super Admin before accessing portals.</p>
            </div>
          </div>
          <div className="flex gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <QrCode size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-base mb-1">02. Dual QR Check-in & Meals</h4>
              <p className="text-sm text-secondary">Attendance verification unlocks tamper-proof canteen food coupon QR codes.</p>
            </div>
          </div>
          <div className="flex gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Utensils size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-base mb-1">03. Automated Reconciliation</h4>
              <p className="text-sm text-secondary">Organisers export PDF reports, upload UPI proofs, and sync records to Google Sheets.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Install App Banner (Android & iOS) */}
      <section className="px-4 sm:px-6 pb-10">
        <div className="max-w-7xl mx-auto">
          <PWAInstallButton variant="card" />
        </div>
      </section>

      <footer className="mt-auto py-7 px-4 sm:px-6 border-t border-border-subtle text-center text-xs text-secondary">
        Campus Connect V2 · Production Event & Canteen Management Platform
      </footer>
    </div>
  );
}
