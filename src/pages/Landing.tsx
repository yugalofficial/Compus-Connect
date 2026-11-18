import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  HelpCircle,
  Mail,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  Utensils,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../components/ProtectedRoute';
import PublicNavbar from '../components/PublicNavbar';
import EventCard from '../components/EventCard';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { HERO_BANNER_IMAGE, getInitials } from '../lib/media';
import { useDocumentSeo } from '../lib/seo';
import { Event, Society } from '../types';

export default function Landing() {
  const { user, loading, platformSettings } = useAuth();
  const navigate = useNavigate();

  const [liveEvents, setLiveEvents] = useState<Event[]>([]);
  const [liveSocieties, setLiveSocieties] = useState<Society[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [certLookupId, setCertLookupId] = useState('');

  useDocumentSeo({
    title: 'Campus Connect | University Event Management & Campus Operations Platform',
    description:
      'Manage campus events, student registrations, societies, QR attendance, canteen coupons, payment verification, digital certificates, analytics, and automated workflows in one unified university system.',
    canonicalPath: '',
  });

  useEffect(() => {
    if (!loading && user) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const unsubEvents = onSnapshot(
      collection(db, 'events'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Event, 'id'>) }))
          .filter((e) => !e.isCancelled);
        list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setLiveEvents(list);
        setEventsLoaded(true);
      },
      () => setEventsLoaded(true)
    );

    const unsubSocieties = onSnapshot(
      collection(db, 'societies'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Society, 'id'>) }))
          .filter((s) => s.approvalStatus !== 'rejected');
        list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
        setLiveSocieties(list);
      },
      () => {}
    );

    return () => {
      unsubEvents();
      unsubSocieties();
    };
  }, []);

  const upcomingEvents = liveEvents
    .filter((e) => e.status !== 'completed')
    .slice(0, 3);
  const displayEvents = upcomingEvents.length > 0 ? upcomingEvents : liveEvents.slice(0, 3);
  const displaySocieties = liveSocieties.slice(0, 3);

  const handleCertLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = certLookupId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!clean) {
      navigate('/verify-certificate');
      return;
    }
    navigate(`/verify-certificate/${clean}`);
  };

  const modules = [
    {
      icon: CalendarCheck,
      title: 'Event Discovery & Scheduling',
      desc: 'Publish free or paid events with registration limits, deadlines, schedules, speaker bios, and automatic waitlists.',
    },
    {
      icon: QrCode,
      title: 'QR Attendance Check-In',
      desc: 'Confirmed passes unlock tamper-resistant attendance QR tickets scanned live by organisers at the venue gate.',
    },
    {
      icon: Utensils,
      title: 'Canteen Meal Coupons & Payouts',
      desc: 'Single-scan debounced food coupon verification prevents double redemptions and streamlines vendor UPI settlements.',
    },
    {
      icon: Award,
      title: 'Digital Certificate Studio',
      desc: 'Design custom A4 credentials from 12 institutional templates, verify attendance eligibility, and embed verification QR codes.',
    },
    {
      icon: CreditCard,
      title: 'UPI & Razorpay Payments',
      desc: 'Accept registration payments via Razorpay or UPI screenshot submission with organiser audit and confirmation workflows.',
    },
    {
      icon: Building2,
      title: 'Societies & Club Governance',
      desc: 'Showcase student chapters, faculty coordinators, core team rosters, club announcements, and membership applications.',
    },
    {
      icon: BarChart3,
      title: 'Real-Time Analytics & Exports',
      desc: 'Track confirmed revenue, attendance conversion, coupon redemption, and export formatted CSV & PDF reports.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Google Sheets & Drive Sync',
      desc: 'Synchronise registration ledgers, payment confirmations, and operational records via your campus Apps Script endpoint.',
    },
    {
      icon: ShieldCheck,
      title: 'Super Admin Approvals & Audit Logs',
      desc: 'Enforce role-based access control, account approval gates, credential provisioning, and immutable audit trails.',
    },
    {
      icon: Smartphone,
      title: 'Offline-Resilient PWA',
      desc: 'Install directly on Android and iOS devices with offline Workbox caching for uninterrupted venue check-ins.',
    },
  ];

  const roles = [
    {
      icon: CalendarCheck,
      title: 'Students',
      desc: 'Browse campus events, register via UPI or Razorpay, access instant QR passes, claim meal coupons, and download verified PDF certificates.',
      cta: 'Student Sign In',
    },
    {
      icon: Users,
      title: 'Event Organisers',
      desc: 'Host society events, manage schedules and waitlists, verify payments, scan attendee QRs, issue digital certificates, and settle vendor payouts.',
      cta: 'Organiser Portal',
    },
    {
      icon: Utensils,
      title: 'Canteen Partners',
      desc: 'Scan food coupon QRs with strict single-scan protection, monitor meal counts in real time, and submit payout requests with UPI details.',
      cta: 'Canteen Portal',
    },
    {
      icon: ShieldCheck,
      title: 'Super Admin',
      desc: 'Approve user registrations, provision credentials directly, moderate societies, revoke compromised certificates, and trigger Sheets sync.',
      cta: 'Admin Console',
    },
  ];

  const faqs = [
    {
      q: 'How do new students, organisers, and canteen partners gain access?',
      a: 'Register via Google Sign-In or campus email on the Sign In page and select your role. Pending accounts are reviewed by the Super Admin before unlocking dashboard routes.',
    },
    {
      q: 'How does Campus Connect prevent duplicate food coupon scans or ineligible certificates?',
      a: 'Canteen QR scanning uses a ref-debounced single-scan guard combined with atomic Firestore updates, while certificate issuance rules verify both confirmed payment and checked-in attendance.',
    },
    {
      q: 'Can anyone verify a student certificate without logging in?',
      a: 'Yes. Employers, faculty coordinators, and external reviewers can enter any Certificate ID or scan its embedded QR code at the public verification registry.',
    },
    {
      q: 'Does Campus Connect work on Android and iOS phones?',
      a: 'Yes. Install Campus Connect directly from Chrome on Android or Safari on iOS as a full-screen Progressive Web App with offline Firestore support.',
    },
  ];

  const supportEmail = platformSettings.supportEmail || 'yugalofficial63@gmail.com';

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <PublicNavbar forceShow />

      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-8 pb-12 sm:pt-12 sm:pb-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 min-w-0">
            <p className="text-xs font-bold text-primary tracking-wider uppercase">
              University Event Operations · Credentials · Canteen Settlement
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.08]">
              Everything Your Campus Needs. Connected in One Platform.
            </h1>
            <p className="text-base sm:text-lg text-secondary leading-relaxed max-w-xl">
              Manage campus events, student registrations, societies, QR attendance, canteen coupons, payment verification, digital certificates, analytics, and automated workflows in one unified university system.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link
                to="/explore"
                className="px-6 py-3.5 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Explore Campus Events
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl border border-border-subtle font-semibold text-sm flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors"
              >
                Access Your Portal
              </Link>
            </div>

            {/* Real Firestore Live Operational Strip */}
            <div className="pt-2 grid grid-cols-3 gap-4 border-t border-border-subtle max-w-md">
              <div>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums">
                  {eventsLoaded ? liveEvents.length : '—'}
                </p>
                <p className="text-xs text-secondary">Listed Events</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums">
                  {liveSocieties.length}
                </p>
                <p className="text-xs text-secondary">Campus Societies</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums">4</p>
                <p className="text-xs text-secondary">Role Portals</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="glass rounded-3xl overflow-hidden border border-border-subtle shadow-2xl">
              <div className="aspect-[16/10] relative bg-slate-900">
                <img
                  src={HERO_BANNER_IMAGE}
                  alt="Campus Connect university operations platform"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                    Real-Time Firebase & Google Workspace Architecture
                  </p>
                  <p className="text-base sm:text-lg font-bold mt-0.5">
                    End-to-end event lifecycle from registration to QR attendance & verified certificates
                  </p>
                </div>
              </div>
              <div className="p-4 sm:p-5 grid grid-cols-3 gap-3 text-xs border-t border-border-subtle bg-surface">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  <span className="font-semibold truncate">RBAC Approvals</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <QrCode size={15} className="text-primary shrink-0" />
                  <span className="font-semibold truncate">Dual QR Passes</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <Award size={15} className="text-amber-500 shrink-0" />
                  <span className="font-semibold truncate">PDF Certificates</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Live Explore Campus Events */}
      <section className="border-t border-border-subtle py-12 sm:py-16 px-4 sm:px-6 bg-surface/40">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Live Campus Feed</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Upcoming Campus Events</h2>
            </div>
            <Link
              to="/explore"
              className="text-sm font-semibold text-primary flex items-center gap-1.5 hover:underline self-start sm:self-auto"
            >
              View All Events <ArrowRight size={15} />
            </Link>
          </div>

          {displayEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onClick={() => navigate(`/events/${ev.slug || ev.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass rounded-3xl p-10 text-center border-dashed space-y-2">
              <Calendar size={28} className="text-primary mx-auto" />
              <p className="font-bold text-sm">No events published yet</p>
              <p className="text-xs text-secondary max-w-md mx-auto">
                Organisers can sign in to publish workshops, hackathons, and cultural fests directly to this public feed.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Live Campus Societies */}
      <section className="border-t border-border-subtle py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Student Chapters & Clubs</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Societies & Communities</h2>
            </div>
            <Link
              to="/societies"
              className="text-sm font-semibold text-primary flex items-center gap-1.5 hover:underline self-start sm:self-auto"
            >
              Browse Societies Directory <ArrowRight size={15} />
            </Link>
          </div>

          {displaySocieties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {displaySocieties.map((soc) => (
                <Link
                  key={soc.id}
                  to={`/society/${soc.id}`}
                  className="glass rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform group"
                >
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                      {soc.logoUrl ? (
                        <img
                          src={soc.logoUrl}
                          alt={soc.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        getInitials(soc.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-primary uppercase">{soc.category}</p>
                      <h3 className="text-base font-bold truncate group-hover:text-primary transition-colors">
                        {soc.name}
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs text-secondary line-clamp-2 mb-4">
                    {soc.description}
                  </p>
                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                    <span className="text-secondary tabular-nums">{soc.followerCount || 0} followers</span>
                    <span className="font-semibold text-primary flex items-center gap-1">
                      Explore <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass rounded-3xl p-10 text-center border-dashed space-y-2">
              <Building2 size={28} className="text-primary mx-auto" />
              <p className="font-bold text-sm">Societies directory ready for onboarding</p>
              <p className="text-xs text-secondary max-w-md mx-auto">
                Organisers can register campus societies with faculty coordinators, core team members, and event calendars.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4. Digital Certificate Public Verification Spotlight */}
      <section className="border-t border-border-subtle py-12 sm:py-16 px-4 sm:px-6 bg-surface/40">
        <div className="max-w-5xl mx-auto glass rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-bold text-primary uppercase tracking-wider">
              Instant Public Verification
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Verify Any Campus Connect Certificate
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              Every certificate generated through Campus Connect includes a deterministic Credential ID and embedded verification QR code backed by Firestore eligibility records.
            </p>
          </div>
          <form onSubmit={handleCertLookup} className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-background border border-border-subtle">
              <Search size={16} className="text-secondary shrink-0" />
              <input
                type="text"
                value={certLookupId}
                onChange={(e) => setCertLookupId(e.target.value)}
                placeholder="Enter Certificate ID (e.g. CC-...)"
                className="w-full h-11 bg-transparent text-sm font-mono focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Verify Certificate Authenticity
            </button>
          </form>
        </div>
      </section>

      {/* 5. 10-Module Feature Grid */}
      <section id="features" className="border-t border-border-subtle py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Platform Architecture</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Ten Connected Modules Built for University Operations
            </h2>
            <p className="text-sm sm:text-base text-secondary">
              Every module shares one real-time Firestore database, role-based access layer, and audit pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {modules.map((m) => (
              <div key={m.title} className="glass rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3.5">
                    <m.icon size={19} />
                  </div>
                  <h3 className="text-sm font-bold mb-1.5">{m.title}</h3>
                  <p className="text-xs text-secondary leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Role-Based Portals & Workflow */}
      <section id="roles" className="border-t border-border-subtle py-12 sm:py-16 px-4 sm:px-6 bg-surface/40">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Dedicated Dashboards for Every Campus Role
            </h2>
            <p className="text-sm sm:text-base text-secondary">
              Authenticated accounts are verified by the Super Admin and routed straight to their role-specific workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {roles.map((r) => (
              <div key={r.title} className="glass rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <r.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{r.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{r.desc}</p>
                </div>
                <Link
                  to="/login"
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  {r.cta} <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ & PWA Install */}
      <section id="faq" className="border-t border-border-subtle py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <HelpCircle size={22} />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
              <p className="text-sm text-secondary leading-relaxed">
                Need onboarding help or account approval assistance? Contact the campus team at{' '}
                <a href={`mailto:${supportEmail}`} className="text-primary font-semibold hover:underline break-all">
                  {supportEmail}
                </a>
                .
              </p>
              <div className="pt-2">
                <Link
                  to="/how-to-use"
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                >
                  Read Complete Platform Guide <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {faqs.map((item) => (
                <div key={item.q} className="glass rounded-2xl p-5 space-y-2">
                  <h3 className="text-sm font-bold">{item.q}</h3>
                  <p className="text-xs text-secondary leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

          <PWAInstallButton variant="card" />
        </div>
      </section>

      {/* 8. Professional Footer */}
      <footer className="mt-auto border-t border-border-subtle bg-surface/50 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
          <div className="space-y-2">
            <p className="text-base font-extrabold font-display">
              Campus <span className="text-primary">Connect</span>
            </p>
            <p className="text-secondary leading-relaxed">
              University Event Operations, Digital Certificates, Societies & Canteen Settlement Platform.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-foreground">Explore</p>
            <ul className="space-y-1.5 text-secondary">
              <li><Link to="/explore" className="hover:text-foreground">Campus Events</Link></li>
              <li><Link to="/societies" className="hover:text-foreground">Societies Directory</Link></li>
              <li><Link to="/verify-certificate" className="hover:text-foreground">Verify Certificate</Link></li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-foreground">Portals</p>
            <ul className="space-y-1.5 text-secondary">
              <li><Link to="/login" className="hover:text-foreground">Sign In to Portal</Link></li>
              <li><Link to="/login?mode=register" className="hover:text-foreground">Create Account</Link></li>
              <li><Link to="/how-to-use" className="hover:text-foreground">Platform Guide</Link></li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-foreground">Support</p>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline break-all"
            >
              <Mail size={13} />
              {supportEmail}
            </a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-border-subtle text-center text-xs text-secondary">
          Campus Connect · Production University Event & Campus Management System
        </div>
      </footer>
    </div>
  );
}
