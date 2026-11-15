import React, { useState } from 'react';
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { CanteenPayment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Users,
  QrCode,
  Settings,
  Plus,
  ArrowRight,
  IndianRupee,
  CreditCard,
  Building2,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getEventCover } from '../lib/media';

function formatSafeDate(dateStr?: string, fmt = 'MMM d, yyyy'): string {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'TBD';
  return format(d, fmt);
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    events: organizedEvents,
    registrations,
    vendorMap,
    payments: paymentRequests,
    loading,
  } = useDashboardData('organizer');

  const [eventFilter, setEventFilter] = useState<'all' | 'live' | 'past'>('all');
  const [showScannerPicker, setShowScannerPicker] = useState(false);

  const handleApprovePayment = async (payment: CanteenPayment) => {
    try {
      await updateDoc(doc(db, 'payments', payment.id), { status: 'approved' });
      if (payment.vendorId) {
        await addDoc(collection(db, 'notifications'), {
          userId: payment.vendorId,
          title: 'Payout Request Approved',
          message: `Organiser approved your ₹${payment.amount} payout request for "${payment.eventTitle}". Settlement pending.`,
          type: 'payment_update',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      confetti({ particleCount: 50, spread: 60 });
      showToast('Payout approved. Complete settlement on the Manage Event page.', 'success');
    } catch (err) {
      console.error('Approve payment error:', err);
      showToast('Failed to approve payout request.', 'error');
    }
  };

  const handleMarkPaid = async (payment: CanteenPayment) => {
    try {
      const paidAt = new Date().toISOString();
      await updateDoc(doc(db, 'payments', payment.id), {
        status: 'paid',
        paidAt,
      });
      if (payment.vendorId) {
        await addDoc(collection(db, 'notifications'), {
          userId: payment.vendorId,
          title: 'Payout Settled',
          message: `₹${payment.amount} for "${payment.eventTitle}" has been marked as paid.`,
          type: 'payment_update',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      showToast('Payment marked as paid!', 'success');
    } catch (err) {
      console.error('Mark paid error:', err);
      showToast('Failed to mark payment as paid.', 'error');
    }
  };

  const categoryCounts = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Academic']
    .map((cat) => ({
      name: cat,
      value: organizedEvents.filter((e) => e.category === cat).length,
    }))
    .filter((d) => d.value > 0);

  const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

  const totalRevenue = organizedEvents.reduce(
    (acc, e) => acc + (e.fee || 0) * (e.registeredCount || 0),
    0
  );
  const totalRegistrations = organizedEvents.reduce(
    (acc, e) => acc + (e.registeredCount || 0),
    0
  );
  const pendingPayments = paymentRequests
    .filter((p) => p.status === 'pending' || p.status === 'approved')
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const filteredEvents = organizedEvents.filter((ev) => {
    const isPast =
      ev.status === 'completed' ||
      (!isNaN(new Date(ev.date).getTime()) && new Date(ev.date).getTime() < Date.now() - 86400000);
    if (eventFilter === 'live') return !isPast;
    if (eventFilter === 'past') return isPast;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 sm:px-6 pt-6 pb-12 max-w-7xl mx-auto space-y-10"
    >
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
            {isAdmin ? 'Administrator View' : 'Organiser Console'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Organiser Hub
          </h1>
          <p className="text-secondary text-sm mt-1">
            Publish events, verify registrations, scan QR passes, and settle canteen payouts.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {user?.societyId ? (
            <Link
              to={`/society/${user.societyId}`}
              className="px-4 py-2.5 rounded-xl border border-border-subtle glass text-sm font-semibold flex items-center gap-2 hover:border-primary/40 transition-colors"
            >
              <Building2 size={16} className="text-primary" />
              My Society
            </Link>
          ) : (
            <Link
              to="/create-society"
              className="px-4 py-2.5 rounded-xl border border-border-subtle glass text-sm font-semibold flex items-center gap-2 hover:border-primary/40 transition-colors"
            >
              <Building2 size={16} className="text-primary" />
              Create Society
            </Link>
          )}

          <Link
            to="/create"
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/25 flex items-center gap-2 hover:opacity-95 transition-opacity"
          >
            <Plus size={18} />
            Create Event
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <section className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Events',
              val: organizedEvents.length,
              icon: Calendar,
              color: 'text-primary',
              bg: 'bg-primary/10',
            },
            {
              label: 'Registrations',
              val: totalRegistrations,
              icon: Users,
              color: 'text-accent',
              bg: 'bg-accent/10',
            },
            {
              label: 'Ticket Revenue',
              val: `₹${totalRevenue.toLocaleString()}`,
              icon: IndianRupee,
              color: 'text-emerald-500',
              bg: 'bg-emerald-500/10',
            },
            {
              label: 'Unsettled Payouts',
              val: `₹${pendingPayments.toLocaleString()}`,
              icon: CreditCard,
              color: 'text-amber-500',
              bg: 'bg-amber-500/10',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass p-5 rounded-3xl border border-border-subtle"
            >
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                <stat.icon size={20} />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">{stat.val}</p>
              <p className="text-xs text-secondary font-semibold uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Analytics Charts */}
        {organizedEvents.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass p-6 rounded-3xl border border-border-subtle">
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-6">
                Registrations by Event
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={organizedEvents.slice(0, 6)}>
                    <XAxis
                      dataKey="title"
                      tick={{ fontSize: 11, fill: 'var(--secondary)' }}
                      tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--foreground)',
                      }}
                    />
                    <Bar dataKey="registeredCount" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass p-6 rounded-3xl border border-border-subtle">
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-6">
                Category Split
              </h3>
              <div className="h-60 w-full">
                {categoryCounts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryCounts}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryCounts.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          borderRadius: '12px',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--foreground)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-secondary">
                    No category data yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Canteen Payout Requests */}
      {paymentRequests.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold flex items-center gap-2.5">
              <CreditCard className="text-primary" size={20} />
              Canteen Payout Requests
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paymentRequests.map((payment) => {
              const vendor = payment.vendorId ? vendorMap[payment.vendorId] : undefined;
              const upiDisplay = payment.vendorUpiId || vendor?.upiId;
              return (
                <div
                  key={payment.id}
                  className="glass p-5 rounded-3xl border border-border-subtle flex flex-col justify-between gap-4"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h4 className="font-bold text-base leading-snug">{payment.eventTitle}</h4>
                      <p className="text-xs text-secondary font-medium mt-0.5">
                        {vendor?.vendorName || vendor?.name || 'Canteen Partner'}
                      </p>
                      <p className="text-xs text-secondary font-medium tabular-nums mt-1">
                        {payment.studentCount} coupons · ₹{payment.amount.toLocaleString()}
                      </p>
                      {upiDisplay && (
                        <p className="text-xs text-primary font-mono mt-1">
                          UPI: {upiDisplay}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        payment.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : payment.status === 'approved'
                          ? 'bg-blue-500/15 text-blue-500'
                          : payment.status === 'rejected'
                          ? 'bg-red-500/15 text-red-500'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {payment.status === 'pending' && (
                      <button
                        onClick={() => handleApprovePayment(payment)}
                        className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        Approve
                      </button>
                    )}
                    {(payment.status === 'pending' || payment.status === 'approved') && (
                      <Link
                        to={`/manage/${payment.eventId}`}
                        className="flex-1 py-2.5 text-center border border-border-subtle rounded-xl text-xs font-bold hover:border-primary/40 transition-colors"
                      >
                        Settle / Proof
                      </Link>
                    )}
                    {payment.status === 'approved' && (
                      <button
                        onClick={() => handleMarkPaid(payment)}
                        className="py-2.5 px-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        Mark Paid
                      </button>
                    )}
                    {payment.status === 'paid' && (
                      <div className="flex-1 py-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={14} />
                        Settled {formatSafeDate(payment.paidAt, 'dd MMM')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link to="/create" className="block group">
            <div className="glass p-6 rounded-3xl border border-primary/20 flex items-center justify-between hover:border-primary/50 transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Plus size={24} />
                </div>
                <div>
                  <h4 className="text-base font-bold">New Event</h4>
                  <p className="text-xs text-secondary">Launch a new campus event</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-secondary group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link to={user?.societyId ? `/society/${user.societyId}` : '/create-society'} className="block group">
            <div className="glass p-6 rounded-3xl border border-accent/20 flex items-center justify-between hover:border-accent/50 transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                  <Building2 size={24} />
                </div>
                <div>
                  <h4 className="text-base font-bold">
                    {user?.societyId ? 'Society Profile' : 'Setup Society'}
                  </h4>
                  <p className="text-xs text-secondary">Manage club branding & socials</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-secondary group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setShowScannerPicker(true)}
            className="text-left block group w-full"
          >
            <div className="glass p-6 rounded-3xl border border-emerald-500/20 flex items-center justify-between hover:border-emerald-500/50 transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                  <QrCode size={24} />
                </div>
                <div>
                  <h4 className="text-base font-bold">Attendance Scanner</h4>
                  <p className="text-xs text-secondary">Select an event & scan tickets</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-secondary group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>
      </section>

      {/* Events List */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Your Events</h2>
          <div className="flex gap-2">
            {(['all', 'live', 'past'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setEventFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                  eventFilter === tab
                    ? 'bg-primary text-white shadow-sm'
                    : 'glass border border-border-subtle text-secondary hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredEvents.map((event) => {
              const evRegs = registrations.filter((r) => r.eventId === event.id);
              const pendingVerify = evRegs.filter((r) => r.status === 'pending').length;
              const attendedCount = evRegs.filter((r) => r.attended).length;

              return (
                <motion.div
                  key={event.id}
                  whileHover={{ y: -3 }}
                  className="glass p-5 rounded-3xl border border-border-subtle flex items-center gap-5 group"
                >
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-secondary/10 shrink-0">
                    <img
                      src={getEventCover(event.posterUrl, event.category)}
                      className="w-full h-full object-cover"
                      alt={event.title}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-secondary font-medium mb-1">
                      <span className="text-primary font-bold">{event.category}</span>
                      <span>·</span>
                      <span className="tabular-nums">{formatSafeDate(event.date)}</span>
                    </div>
                    <h4 className="text-base font-bold mb-2 truncate">{event.title}</h4>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-secondary tabular-nums mb-3">
                      <span>
                        <strong className="text-foreground">{event.registeredCount || 0}</strong> /{' '}
                        {event.registrationLimit} confirmed
                      </span>
                      <span>·</span>
                      <span>{attendedCount} attended</span>
                      {pendingVerify > 0 && (
                        <span className="text-amber-500 font-bold inline-flex items-center gap-1">
                          <Clock size={12} /> {pendingVerify} pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-end">
                      <Link
                        to={`/manage/${event.id}`}
                        className="px-3.5 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Settings size={14} />
                        Manage
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass p-12 rounded-3xl text-center border border-dashed border-border-subtle">
            <Calendar size={36} className="mx-auto text-secondary/40 mb-3" />
            <p className="font-bold mb-1">No events in this view</p>
            <p className="text-sm text-secondary mb-5">
              Create your first campus event to start accepting registrations and QR check-ins.
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold"
            >
              <Plus size={16} />
              Create Event
            </Link>
          </div>
        )}
      </section>

      {/* Scanner Event Picker Modal */}
      <AnimatePresence>
        {showScannerPicker && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowScannerPicker(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass rounded-3xl p-6 shadow-2xl border border-border-subtle max-h-[90dvh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Select Event to Scan</h3>
                <button
                  onClick={() => setShowScannerPicker(false)}
                  className="p-2 rounded-xl hover:bg-secondary/10"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto space-y-2.5 pr-1">
                {organizedEvents.length > 0 ? (
                  organizedEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => {
                        setShowScannerPicker(false);
                        navigate(`/manage/${ev.id}?scan=attendance`);
                      }}
                      className="w-full text-left p-4 rounded-2xl border border-border-subtle hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{ev.title}</p>
                        <p className="text-xs text-secondary mt-0.5 tabular-nums">
                          {formatSafeDate(ev.date)} · {ev.registeredCount || 0} registered
                        </p>
                      </div>
                      <QrCode size={18} className="text-primary shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-secondary mb-4">No events available to scan yet.</p>
                    <button
                      onClick={() => {
                        setShowScannerPicker(false);
                        navigate('/create');
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"
                    >
                      Create an Event
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
