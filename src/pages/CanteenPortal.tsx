import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCanteenQrScanner } from '../hooks/useCanteenQrScanner';
import { db } from '../firebase';
import {
  collection,
  doc,
  updateDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode,
  Utensils,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Users,
  Settings,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import QRScanner from '../components/QRScanner';
import { format, isToday } from 'date-fns';
import confetti from 'canvas-confetti';
import { getInitials } from '../lib/media';

function formatSafeTime(ts?: string): string {
  if (!ts) return 'Just now';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 'Just now';
  return format(d, 'dd MMM, hh:mm a');
}

export default function CanteenPortal() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const {
    events: activeEvents,
    redemptions,
    paymentsByEvent,
    earnings,
    eventStats,
    loading,
  } = useDashboardData('canteen');

  const [showScanner, setShowScanner] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string>('');
  const [logTab, setLogTab] = useState<'today' | 'history'>('today');

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [vendorName, setVendorName] = useState(user?.vendorName || '');
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [razorpayId, setRazorpayId] = useState(user?.razorpayId || '');
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const handleCloseScanner = useCallback(() => {
    setShowScanner(false);
  }, []);

  const {
    status,
    message,
    scannedData,
    handleScan: onScannerScan,
    resetScanState,
  } = useCanteenQrScanner({
    user,
    activeEventId,
    showToast,
    onScanStart: handleCloseScanner,
  });

  useEffect(() => {
    if (user) {
      setVendorName(user.vendorName || '');
      setUpiId(user.upiId || '');
      setRazorpayId(user.razorpayId || '');
    }
  }, [user]);

  useEffect(() => {
    setActiveEventId((prev) =>
      prev && activeEvents.some((e) => e.id === prev) ? prev : activeEvents[0]?.id || ''
    );
  }, [activeEvents]);

  const handleUpdateSettings = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        vendorName: vendorName.trim(),
        upiId: upiId.trim(),
        razorpayId: razorpayId.trim(),
        updatedAt: new Date().toISOString(),
      });
      setShowSettings(false);
      confetti({ particleCount: 40, spread: 55 });
      showToast('Canteen payout settings saved!', 'success');
    } catch (err) {
      console.error('Update settings error:', err);
      showToast('Failed to update canteen settings.', 'error');
    }
  };

  const handleRequestPayment = async (
    eventId: string,
    stats: { title: string; count: number; cost: number; organizerId: string }
  ) => {
    if (!user) return;
    const existing = paymentsByEvent[eventId];
    if (existing && existing.status !== 'rejected') {
      showToast(`Payout request is already ${existing.status}.`, 'info');
      return;
    }

    if (!user.upiId && !upiId) {
      showToast('Please set your UPI ID in Canteen Settings before requesting payout.', 'error');
      setShowSettings(true);
      return;
    }

    try {
      const paymentId = `PAY_${eventId}_${user.uid}`;
      const amount = stats.count * stats.cost;
      const nowIso = new Date().toISOString();

      await setDoc(doc(db, 'payments', paymentId), {
        eventId,
        eventTitle: stats.title,
        organizerId: stats.organizerId,
        vendorId: user.uid,
        vendorUpiId: user.upiId || upiId.trim(),
        amount,
        studentCount: stats.count,
        status: 'pending',
        requestedAt: nowIso,
        timestamp: nowIso,
      });

      if (stats.organizerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: stats.organizerId,
          title: 'Canteen Payout Requested',
          message: `${user.vendorName || user.name} requested ₹${amount.toLocaleString()} for ${
            stats.count
          } redeemed food coupons at "${stats.title}".`,
          type: 'payment_update',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      showToast('Payout request sent to event organiser!', 'success');
    } catch (err) {
      console.error('Payment request error:', err);
      showToast('Failed to submit payout request.', 'error');
    }
  };

  const displayedRedemptions = redemptions.filter((log) => {
    if (logTab === 'history') return true;
    const ts = log.couponRedeemedAt || log.scannedAt;
    if (!ts) return true;
    const d = new Date(ts);
    return !isNaN(d.getTime()) && isToday(d);
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 sm:px-6 pt-6 pb-12 max-w-7xl mx-auto space-y-10"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
            {user?.vendorName || 'Canteen Operations'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Canteen Portal
          </h1>
          <p className="text-secondary text-sm mt-1">
            Scan student meal QR passes, audit redemptions, and settle payouts with organisers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="glass border border-border-subtle px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:border-primary/40"
          >
            <Settings size={16} />
            Payout Settings
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 flex items-center gap-2 hover:opacity-95"
          >
            <QrCode size={18} />
            Scan Coupon
          </button>
        </div>
      </header>

      {/* Active Event Selector + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 glass p-5 rounded-3xl border border-border-subtle flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Calendar size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Active Event:
            </span>
          </div>
          <select
            value={activeEventId}
            onChange={(e) => setActiveEventId(e.target.value)}
            className="flex-1 bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {activeEvents.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} (₹{e.couponCost || 50}/coupon)
              </option>
            ))}
            {activeEvents.length === 0 && <option value="">No active events with food coupons</option>}
          </select>
        </div>

        <div className="glass p-6 rounded-3xl border border-border-subtle">
          <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
            <Utensils size={20} />
          </div>
          <p className="text-3xl font-extrabold tabular-nums">₹{earnings.toLocaleString()}</p>
          <p className="text-xs text-secondary font-semibold uppercase tracking-wider mt-1">
            Total Coupon Value
          </p>
        </div>

        <div className="glass p-6 rounded-3xl border border-border-subtle">
          <div className="w-11 h-11 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4">
            <Users size={20} />
          </div>
          <p className="text-3xl font-extrabold tabular-nums">{redemptions.length}</p>
          <p className="text-xs text-secondary font-semibold uppercase tracking-wider mt-1">
            Meals Redeemed
          </p>
        </div>

        {/* Payout Requests */}
        <div className="glass p-6 rounded-3xl border border-border-subtle">
          <h3 className="text-xs text-secondary font-bold uppercase tracking-wider mb-4">
            Event Payout Requests
          </h3>
          <div className="space-y-3 max-h-44 overflow-y-auto pr-1">
            {Object.entries(eventStats).map(([evId, stat]) => {
              const pay = paymentsByEvent[evId];
              return (
                <div key={evId} className="flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{stat.title}</p>
                    <p className="text-[11px] text-secondary tabular-nums">
                      {stat.count} meals · ₹{(stat.count * stat.cost).toLocaleString()}
                    </p>
                  </div>

                  {!pay || pay.status === 'rejected' ? (
                    <button
                      onClick={() => handleRequestPayment(evId, stat)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-bold shrink-0 hover:opacity-90"
                    >
                      {pay?.status === 'rejected' ? 'Retry' : 'Request'}
                    </button>
                  ) : pay.status === 'paid' && pay.paymentScreenshot ? (
                    <button
                      onClick={() => setProofPreview(pay.paymentScreenshot!)}
                      className="px-2.5 py-1 bg-emerald-500/15 text-emerald-500 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <ImageIcon size={12} />
                      Paid Proof
                    </button>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 ${
                        pay.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : pay.status === 'approved'
                          ? 'bg-blue-500/15 text-blue-500'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {pay.status}
                    </span>
                  )}
                </div>
              );
            })}
            {Object.keys(eventStats).length === 0 && (
              <p className="text-xs text-secondary">No redemptions recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Scan Validation Result Box */}
      <div className="glass p-6 rounded-3xl border border-border-subtle">
        <AnimatePresence mode="wait">
          {status === 'idle' ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
                <QrCode size={28} />
              </div>
              <p className="font-bold text-sm">Ready to Scan Food Coupons</p>
              <p className="text-xs text-secondary mt-1">
                Tap "Scan Coupon" above or enter a coupon token manually inside the scanner.
              </p>
            </motion.div>
          ) : status === 'processing' ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 flex flex-col items-center gap-3"
            >
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Validating Coupon…
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div
                className={`p-5 rounded-2xl border flex items-center gap-4 ${
                  status === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className={status === 'success' ? 'text-emerald-500' : 'text-red-500'}>
                  {status === 'success' ? <CheckCircle size={36} /> : <XCircle size={36} />}
                </div>
                <div>
                  <h4
                    className={`text-lg font-extrabold ${
                      status === 'success' ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {status === 'success' ? 'Coupon Redeemed' : 'Validation Failed'}
                  </h4>
                  <p className="text-sm text-secondary">{message}</p>
                </div>
              </div>

              {status === 'success' && scannedData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl border border-border-subtle">
                    <p className="text-[11px] text-secondary font-semibold uppercase">Student</p>
                    <p className="text-sm font-bold mt-0.5">
                      {scannedData.student?.name || scannedData.reg.userName || 'Student'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-border-subtle">
                    <p className="text-[11px] text-secondary font-semibold uppercase">Event</p>
                    <p className="text-sm font-bold truncate mt-0.5">
                      {scannedData.event?.title || 'Event'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-border-subtle">
                    <p className="text-[11px] text-secondary font-semibold uppercase">Organiser</p>
                    <p className="text-sm font-bold mt-0.5">
                      {scannedData.organizer?.name || 'Organiser'}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={resetScanState}
                className="w-full py-2.5 rounded-xl border border-border-subtle text-xs font-bold uppercase tracking-wider text-secondary hover:text-foreground"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Redemption Logs */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Redemption Logs</h2>
          <div className="flex gap-2">
            {(['today', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLogTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${
                  logTab === tab
                    ? 'bg-primary text-white'
                    : 'glass border border-border-subtle text-secondary'
                }`}
              >
                {tab === 'today' ? 'Today' : 'All History'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : displayedRedemptions.length > 0 ? (
          <div className="space-y-3">
            {displayedRedemptions.map((log) => {
              const studentName = log.student?.name || log.userName || 'Student';
              return (
                <div
                  key={log.id}
                  className="glass p-4 sm:p-5 rounded-3xl border border-border-subtle flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {log.student?.photoURL ? (
                        <img
                          src={log.student.photoURL}
                          alt={studentName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(studentName)
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm sm:text-base truncate">{studentName}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-secondary mt-0.5">
                        <span className="truncate">{log.event?.title || log.eventId}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock size={12} />
                          {formatSafeTime(log.couponRedeemedAt || log.scannedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-emerald-500/15 text-emerald-500 rounded-xl text-xs font-bold shrink-0">
                    ₹{log.event?.couponCost || 50}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass p-12 rounded-3xl text-center border border-dashed border-border-subtle">
            <p className="text-secondary text-sm font-semibold">
              {logTab === 'today' ? 'No coupons redeemed today yet.' : 'No redemptions recorded yet.'}
            </p>
          </div>
        )}
      </section>

      {/* Scanner & Modals */}
      <AnimatePresence>
        {showScanner && (
          <QRScanner
            onScan={onScannerScan}
            onClose={() => setShowScanner(false)}
            title="Scan Food Coupon"
          />
        )}

        {showSettings && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass p-6 rounded-3xl shadow-2xl border border-border-subtle max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold">Canteen Payout Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-xl hover:bg-secondary/10"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-secondary font-semibold mb-1.5 block">
                    Canteen / Vendor Name
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Central Campus Canteen"
                    className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary font-semibold mb-1.5 block">
                    UPI ID (for event settlements)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. canteen@upi"
                    className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary font-semibold mb-1.5 block">
                    Razorpay Account ID (optional)
                  </label>
                  <input
                    type="text"
                    value={razorpayId}
                    onChange={(e) => setRazorpayId(e.target.value)}
                    placeholder="e.g. acc_..."
                    className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 rounded-xl border border-border-subtle text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSettings}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {proofPreview && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProofPreview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass p-5 rounded-3xl border border-border-subtle max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm">Settlement Proof</h4>
                <button
                  onClick={() => setProofPreview(null)}
                  className="p-1.5 rounded-lg hover:bg-secondary/10"
                >
                  <X size={18} />
                </button>
              </div>
              <img
                src={proofPreview}
                alt="Settlement proof"
                className="w-full max-h-[65vh] object-contain rounded-2xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
