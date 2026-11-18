import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Download,
  FileSpreadsheet,
  IndianRupee,
  TicketCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CanteenPayment, Event, IssuedCertificate, Registration } from '../types';

type DatePreset = 'all' | '30d' | '7d' | 'custom';

export default function Analytics() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [payments, setPayments] = useState<CanteenPayment[]>([]);
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const eventsQ = isAdmin
      ? collection(db, 'events')
      : query(collection(db, 'events'), where('organizerId', '==', user.uid));

    const unsubEvents = onSnapshot(eventsQ, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Event, 'id'>) }));
      list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setEvents(list);
      setLoading(false);
    });

    const unsubRegs = onSnapshot(collection(db, 'registrations'), (snap) => {
      setRegistrations(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Registration, 'id'>) }))
      );
    });

    const payQ = isAdmin
      ? collection(db, 'payments')
      : query(collection(db, 'payments'), where('organizerId', '==', user.uid));
    const unsubPay = onSnapshot(payQ, (snap) => {
      setPayments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CanteenPayment, 'id'>) }))
      );
    });

    const certQ = isAdmin
      ? collection(db, 'certificates')
      : query(collection(db, 'certificates'), where('organizerId', '==', user.uid));
    const unsubCert = onSnapshot(certQ, (snap) => {
      setCertificates(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IssuedCertificate, 'id'>) }))
      );
    });

    return () => {
      unsubEvents();
      unsubRegs();
      unsubPay();
      unsubCert();
    };
  }, [user, isAdmin]);

  const scopedEventIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

  const inDateRange = (isoDate?: string): boolean => {
    if (datePreset === 'all') return true;
    if (!isoDate) return false;
    const t = new Date(isoDate).getTime();
    if (isNaN(t)) return false;
    const now = Date.now();
    if (datePreset === '7d') return t >= now - 7 * 86400000;
    if (datePreset === '30d') return t >= now - 30 * 86400000;
    if (datePreset === 'custom') {
      if (customFrom && t < new Date(customFrom).getTime()) return false;
      if (customTo && t > new Date(`${customTo}T23:59:59`).getTime()) return false;
    }
    return true;
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedEventId !== 'all' && e.id !== selectedEventId) return false;
      return inDateRange(e.date);
    });
  }, [events, selectedEventId, datePreset, customFrom, customTo]);

  const activeEventIds = useMemo(
    () => new Set(filteredEvents.map((e) => e.id)),
    [filteredEvents]
  );

  const scopedRegistrations = useMemo(
    () =>
      registrations.filter(
        (r) =>
          scopedEventIds.has(r.eventId) &&
          (selectedEventId === 'all' || r.eventId === selectedEventId) &&
          activeEventIds.has(r.eventId)
      ),
    [registrations, scopedEventIds, selectedEventId, activeEventIds]
  );

  const scopedPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          scopedEventIds.has(p.eventId) &&
          (selectedEventId === 'all' || p.eventId === selectedEventId) &&
          activeEventIds.has(p.eventId)
      ),
    [payments, scopedEventIds, selectedEventId, activeEventIds]
  );

  const scopedCertificates = useMemo(
    () =>
      certificates.filter(
        (c) =>
          scopedEventIds.has(c.eventId) &&
          (selectedEventId === 'all' || c.eventId === selectedEventId) &&
          activeEventIds.has(c.eventId)
      ),
    [certificates, scopedEventIds, selectedEventId, activeEventIds]
  );

  const eventMap = useMemo(() => {
    const map: Record<string, Event> = {};
    events.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [events]);

  const metrics = useMemo(() => {
    const confirmedRegs = scopedRegistrations.filter((r) => r.status === 'confirmed');
    const pendingRegs = scopedRegistrations.filter((r) => r.status === 'pending');
    const waitlistedRegs = scopedRegistrations.filter((r) => r.status === 'waitlisted');
    const attendedRegs = confirmedRegs.filter((r) => r.attended);
    const couponEligibleEvents = scopedRegistrations.filter(
      (r) => r.status === 'confirmed' && eventMap[r.eventId]?.hasFoodCoupon
    );
    const redeemedCoupons = couponEligibleEvents.filter((r) => r.couponRedeemed);

    // Strictly count verified/confirmed ticket revenue only
    const confirmedRevenue = confirmedRegs.reduce((sum, reg) => {
      const ev = eventMap[reg.eventId];
      if (!ev || ev.type !== 'paid') return sum;
      return sum + (Number(ev.fee) || 0);
    }, 0);

    const settledCanteenPayouts = scopedPayments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const pendingCanteenPayouts = scopedPayments
      .filter((p) => p.status === 'pending' || p.status === 'approved')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const attendanceRate =
      confirmedRegs.length > 0
        ? Math.round((attendedRegs.length / confirmedRegs.length) * 100)
        : 0;
    const couponRate =
      couponEligibleEvents.length > 0
        ? Math.round((redeemedCoupons.length / couponEligibleEvents.length) * 100)
        : 0;
    const certRate =
      attendedRegs.length > 0
        ? Math.round((scopedCertificates.length / attendedRegs.length) * 100)
        : 0;

    return {
      totalRegs: scopedRegistrations.length,
      confirmedCount: confirmedRegs.length,
      pendingCount: pendingRegs.length,
      waitlistCount: waitlistedRegs.length,
      attendedCount: attendedRegs.length,
      attendanceRate,
      redeemedCouponsCount: redeemedCoupons.length,
      couponRate,
      certCount: scopedCertificates.length,
      certRate,
      confirmedRevenue,
      settledCanteenPayouts,
      pendingCanteenPayouts,
    };
  }, [scopedRegistrations, scopedPayments, scopedCertificates, eventMap]);

  const eventChartData = useMemo(() => {
    return filteredEvents.slice(0, 8).map((ev) => {
      const evRegs = scopedRegistrations.filter((r) => r.eventId === ev.id);
      const confirmed = evRegs.filter((r) => r.status === 'confirmed').length;
      const attended = evRegs.filter((r) => r.status === 'confirmed' && r.attended).length;
      const redeemed = evRegs.filter((r) => r.couponRedeemed).length;
      return {
        name: ev.title.length > 16 ? `${ev.title.slice(0, 15)}…` : ev.title,
        Confirmed: confirmed,
        Attended: attended,
        Coupons: redeemed,
      };
    });
  }, [filteredEvents, scopedRegistrations]);

  const timelineData = useMemo(() => {
    const byDay: Record<string, { date: string; registrations: number; revenue: number }> = {};
    scopedRegistrations.forEach((r) => {
      const ev = eventMap[r.eventId];
      const dayKey = (r.createdAt || ev?.date || new Date().toISOString()).slice(0, 10);
      if (!byDay[dayKey]) {
        byDay[dayKey] = { date: dayKey, registrations: 0, revenue: 0 };
      }
      byDay[dayKey].registrations += 1;
      if (r.status === 'confirmed' && ev?.type === 'paid') {
        byDay[dayKey].revenue += Number(ev.fee) || 0;
      }
    });
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [scopedRegistrations, eventMap]);

  const exportCsv = () => {
    const header = [
      'Event',
      'Date',
      'Category',
      'Type',
      'Confirmed',
      'Pending',
      'Waitlisted',
      'Attended',
      'Coupons Redeemed',
      'Confirmed Revenue (INR)',
    ];
    const rows = filteredEvents.map((ev) => {
      const evRegs = scopedRegistrations.filter((r) => r.eventId === ev.id);
      const confirmed = evRegs.filter((r) => r.status === 'confirmed');
      const pending = evRegs.filter((r) => r.status === 'pending').length;
      const waitlisted = evRegs.filter((r) => r.status === 'waitlisted').length;
      const attended = confirmed.filter((r) => r.attended).length;
      const redeemed = evRegs.filter((r) => r.couponRedeemed).length;
      const revenue = ev.type === 'paid' ? confirmed.length * (Number(ev.fee) || 0) : 0;

      return [
        `"${(ev.title || '').replace(/"/g, '""')}"`,
        `"${(ev.date || '').slice(0, 10)}"`,
        ev.category,
        ev.type,
        confirmed.length,
        pending,
        waitlisted,
        attended,
        redeemed,
        revenue,
      ].join(',');
    });

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus_connect_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Analytics CSV report exported.', 'success');
  };

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Campus Connect — Operations & Analytics Report', 14, 16);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(
      `Generated ${new Date().toLocaleString()} · Scope: ${
        selectedEventId === 'all' ? 'All Events' : eventMap[selectedEventId]?.title || 'Selected Event'
      }`,
      14,
      23
    );

    autoTable(pdf, {
      startY: 30,
      head: [
        [
          'Event',
          'Date',
          'Confirmed',
          'Attended',
          'Attendance %',
          'Coupons Used',
          'Confirmed Revenue (INR)',
        ],
      ],
      body: filteredEvents.map((ev) => {
        const evRegs = scopedRegistrations.filter((r) => r.eventId === ev.id);
        const confirmed = evRegs.filter((r) => r.status === 'confirmed');
        const attended = confirmed.filter((r) => r.attended).length;
        const pct = confirmed.length ? `${Math.round((attended / confirmed.length) * 100)}%` : '0%';
        const coupons = evRegs.filter((r) => r.couponRedeemed).length;
        const rev = ev.type === 'paid' ? confirmed.length * (Number(ev.fee) || 0) : 0;
        return [
          ev.title,
          (ev.date || '').slice(0, 10),
          confirmed.length,
          attended,
          pct,
          coupons,
          rev,
        ];
      }),
    });

    pdf.save(`campus_connect_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF analytics summary downloaded.', 'success');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-10 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-full glass border border-border-subtle flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              {isAdmin ? 'Platform-Wide Intelligence' : 'Organiser Analytics'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Analytics & Financial Reporting
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            aria-label="Filter by event"
            className="h-10 px-3 rounded-xl glass border border-border-subtle text-sm font-medium max-w-xs"
          >
            <option value="all">All Hosted Events ({events.length})</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            aria-label="Date range"
            className="h-10 px-3 rounded-xl glass border border-border-subtle text-sm font-medium"
          >
            <option value="all">All Time</option>
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
            <option value="custom">Custom Dates</option>
          </select>

          <button
            type="button"
            onClick={exportCsv}
            className="h-10 px-3.5 rounded-xl border border-border-subtle text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-secondary/10"
          >
            <FileSpreadsheet size={15} />
            CSV
          </button>

          <button
            type="button"
            onClick={exportPdf}
            className="h-10 px-3.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:opacity-90"
          >
            <Download size={15} />
            PDF Report
          </button>
        </div>
      </div>

      {datePreset === 'custom' && (
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="font-semibold text-secondary">From:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 px-2.5 rounded-lg bg-background border border-border-subtle"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold text-secondary">To:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 px-2.5 rounded-lg bg-background border border-border-subtle"
            />
          </label>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-secondary">
            <span>Confirmed Registrations</span>
            <Users size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-extrabold tabular-nums mt-2">{metrics.confirmedCount}</p>
          <p className="text-xs text-secondary mt-1 tabular-nums">
            {metrics.pendingCount} pending · {metrics.waitlistCount} waitlisted
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-secondary">
            <span>Attendance Check-In Rate</span>
            <TicketCheck size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold tabular-nums mt-2 text-emerald-500">
            {metrics.attendanceRate}%
          </p>
          <p className="text-xs text-secondary mt-1 tabular-nums">
            {metrics.attendedCount} checked in out of {metrics.confirmedCount}
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-secondary">
            <span>Confirmed Revenue</span>
            <IndianRupee size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-extrabold tabular-nums mt-2">
            ₹{metrics.confirmedRevenue.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-secondary mt-1 tabular-nums">
            Canteen settled: ₹{metrics.settledCanteenPayouts.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-secondary">
            <span>Coupons & Certificates</span>
            <Award size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold tabular-nums mt-2">
            {metrics.certCount} Issued
          </p>
          <p className="text-xs text-secondary mt-1 tabular-nums flex items-center gap-2">
            <Utensils size={12} /> {metrics.redeemedCouponsCount} meals ({metrics.couponRate}%)
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BarChart3 size={17} className="text-primary" />
              Registrations vs Attendance vs Coupons
            </h2>
            <p className="text-xs text-secondary">Event-by-event operational conversion</p>
          </div>
          <div className="h-72 w-full">
            {eventChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-secondary">
                No event metrics available for the selected range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventChartData} margin={{ top: 10, right: 10, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Confirmed" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Attended" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Coupons" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-bold">Registration Activity Trend</h2>
            <p className="text-xs text-secondary">Daily confirmed/submitted volume across your scope</p>
          </div>
          <div className="h-72 w-full">
            {timelineData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-secondary">
                Registration trend data populates as students enroll.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="registrations"
                    stroke="#2563eb"
                    fill="#2563eb"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="glass rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold">Event Performance Breakdown</h2>
        {loading ? (
          <p className="text-sm text-secondary">Loading analytics...</p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-sm text-secondary py-6 text-center">No events match your current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-border-subtle text-xs text-secondary">
                <tr>
                  <th className="py-2.5 pr-4">Event</th>
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 pr-4 tabular-nums">Confirmed</th>
                  <th className="py-2.5 pr-4 tabular-nums">Attended</th>
                  <th className="py-2.5 pr-4 tabular-nums">Coupons</th>
                  <th className="py-2.5 text-right tabular-nums">Confirmed Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredEvents.map((ev) => {
                  const evRegs = scopedRegistrations.filter((r) => r.eventId === ev.id);
                  const confirmed = evRegs.filter((r) => r.status === 'confirmed');
                  const attended = confirmed.filter((r) => r.attended).length;
                  const coupons = evRegs.filter((r) => r.couponRedeemed).length;
                  const revenue =
                    ev.type === 'paid' ? confirmed.length * (Number(ev.fee) || 0) : 0;

                  return (
                    <tr key={ev.id}>
                      <td className="py-3 pr-4 font-semibold">{ev.title}</td>
                      <td className="py-3 pr-4 text-xs text-secondary tabular-nums">
                        {(ev.date || '').slice(0, 10) || 'TBA'}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{confirmed.length}</td>
                      <td className="py-3 pr-4 tabular-nums">{attended}</td>
                      <td className="py-3 pr-4 tabular-nums">{coupons}</td>
                      <td className="py-3 text-right font-semibold tabular-nums">
                        {ev.type === 'paid' ? `₹${revenue.toLocaleString('en-IN')}` : 'Free'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
