import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  updateDoc,
  increment,
  deleteDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Event, Registration, CanteenPayment, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Users,
  QrCode,
  CheckCircle,
  XCircle,
  Coffee,
  Search,
  Edit,
  Trash2,
  Download,
  CreditCard,
  Upload,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import QRScanner from '../components/QRScanner';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { compressImageToDataUrl, getInitials } from '../lib/media';

type EnrichedRegistration = Registration & { student?: User };
type EnrichedPayment = CanteenPayment & { vendor?: User };

export default function ManageEvent() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast, confirm } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EnrichedRegistration[]>([]);
  const [canteenPayments, setCanteenPayments] = useState<EnrichedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState<'attendance' | 'coupon' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  // Modals
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);
  const [settlingPayment, setSettlingPayment] = useState<EnrichedPayment | null>(null);
  const [upiTxnId, setUpiTxnId] = useState('');
  const [proofDataUrl, setProofDataUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Debounce & concurrency guard for QR scanning
  const isProcessingScanRef = useRef(false);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    const scanParam = searchParams.get('scan');
    if (scanParam === 'attendance' || scanParam === 'coupon') {
      setShowScanner(scanParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const unsubEvent = onSnapshot(
      doc(db, 'events', id),
      (snap) => {
        setEvent(snap.exists() ? ({ id: snap.id, ...snap.data() } as Event) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubRegs = onSnapshot(
      query(collection(db, 'registrations'), where('eventId', '==', id)),
      async (regSnapshot) => {
        const rawRegs = regSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Registration));
        const enrichedRegs = await Promise.all(
          rawRegs.map(async (r) => {
            try {
              const uDoc = await getDoc(doc(db, 'users', r.userId));
              return {
                ...r,
                student: uDoc.exists() ? ({ uid: uDoc.id, ...uDoc.data() } as User) : undefined,
              };
            } catch {
              return r;
            }
          })
        );
        setRegistrations(enrichedRegs);
      }
    );

    const unsubPays = onSnapshot(
      query(collection(db, 'payments'), where('eventId', '==', id)),
      async (paySnapshot) => {
        const rawPays = paySnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CanteenPayment));
        const enrichedPays = await Promise.all(
          rawPays.map(async (p) => {
            if (!p.vendorId) return p;
            try {
              const vDoc = await getDoc(doc(db, 'users', p.vendorId));
              return {
                ...p,
                vendor: vDoc.exists() ? ({ uid: vDoc.id, ...vDoc.data() } as User) : undefined,
              };
            } catch {
              return p;
            }
          })
        );
        setCanteenPayments(enrichedPays);
      }
    );

    return () => {
      unsubEvent();
      unsubRegs();
      unsubPays();
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id || !event) return;
    const ok = await confirm({
      title: 'Delete Event?',
      message: `Are you sure you want to delete "${event.title}"? This action cannot be undone.`,
      confirmText: 'Delete Event',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'events', id));
      showToast('Event deleted.', 'success');
      navigate('/dashboard');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete event.', 'error');
    }
  };

  const verifyPayment = async (reg: EnrichedRegistration) => {
    if (!event) return;
    try {
      const ticketId = `TKT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const validationToken =
        reg.validationToken || Math.random().toString(36).substring(2, 15);
      const qrCode = `attendance:${event.id}:${reg.userId}:${validationToken}`;

      await updateDoc(doc(db, 'registrations', reg.id), {
        status: 'confirmed',
        ticketId,
        qrCode,
        validationToken,
      });

      await updateDoc(doc(db, 'events', event.id), {
        registeredCount: increment(1),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: reg.userId,
        title: 'Registration Confirmed',
        message: `Your payment for "${event.title}" has been verified. Your QR Pass is ready!`,
        type: 'registration_success',
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast('Registration verified and ticket issued!', 'success');
    } catch (err) {
      console.error('Verify payment error:', err);
      showToast('Failed to verify payment.', 'error');
    }
  };

  const rejectRegistration = async (reg: EnrichedRegistration) => {
    if (!event) return;
    const ok = await confirm({
      title: 'Reject Payment?',
      message: `Reject registration for ${reg.student?.name || reg.userName || reg.userId}?`,
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;

    try {
      await updateDoc(doc(db, 'registrations', reg.id), {
        status: 'rejected',
      });
      await addDoc(collection(db, 'notifications'), {
        userId: reg.userId,
        title: 'Payment Rejected',
        message: `Your payment proof for "${event.title}" could not be verified. Please contact the organiser.`,
        type: 'payment_update',
        read: false,
        createdAt: serverTimestamp(),
      });
      showToast('Registration marked as rejected.', 'info');
    } catch (err) {
      console.error('Reject error:', err);
      showToast('Failed to reject registration.', 'error');
    }
  };

  const handleScan = async (decodedText: string) => {
    if (!id || !user) return;
    const normalized = decodedText.trim();
    const now = Date.now();

    // Debounce & lock: prevent duplicate triggers from a single QR scan
    if (
      isProcessingScanRef.current ||
      (lastScanRef.current.code === normalized && now - lastScanRef.current.time < 3000)
    ) {
      return;
    }

    isProcessingScanRef.current = true;
    lastScanRef.current = { code: normalized, time: now };
    const scanMode = showScanner;

    try {
      const parts = normalized.split(':');
      if (parts.length !== 4 || (parts[0] !== 'attendance' && parts[0] !== 'coupon')) {
        showToast('Invalid QR code format.', 'error');
        return;
      }

      const [qrKind, eventId, userId, token] = parts;
      if (eventId !== id) {
        showToast('This QR pass belongs to a different event!', 'error');
        return;
      }

      if (scanMode === 'attendance' && qrKind !== 'attendance') {
        showToast('Please scan the Attendance QR pass, not the food coupon.', 'error');
        return;
      }

      if (scanMode === 'coupon' && !event?.hasFoodCoupon) {
        showToast('This event does not include food coupons.', 'error');
        setShowScanner(null);
        return;
      }

      const regId = `${userId}_${eventId}`;
      const nowIso = new Date().toISOString();

      const txResult = await runTransaction(db, async (tx) => {
        const regRef = doc(db, 'registrations', regId);
        const attRef = doc(db, 'attendance', regId);
        const couponRef = doc(db, 'coupons', regId);

        const regSnap = await tx.get(regRef);
        if (!regSnap.exists()) {
          return { status: 'error' as const, message: 'Student registration not found.' };
        }

        const reg = { id: regSnap.id, ...regSnap.data() } as Registration;
        if (reg.status !== 'confirmed') {
          return { status: 'error' as const, message: 'Registration payment is not confirmed yet.' };
        }

        if (reg.validationToken && reg.validationToken !== token) {
          return { status: 'error' as const, message: 'Security validation failed!' };
        }

        if (scanMode === 'attendance') {
          const attSnap = await tx.get(attRef);
          if (reg.attended || attSnap.exists()) {
            return { status: 'info' as const, message: 'Attendance already marked for this student.' };
          }
          tx.update(regRef, {
            attended: true,
            scannedAt: nowIso,
          });
          tx.set(attRef, {
            userId,
            eventId,
            scanTime: nowIso,
            verifiedBy: user.uid,
          });
          return { status: 'attendance_marked' as const };
        }

        if (scanMode === 'coupon') {
          if (!reg.attended) {
            return { status: 'error' as const, message: 'Student must check in for attendance first!' };
          }
          const couponSnap = await tx.get(couponRef);
          if (reg.couponRedeemed || couponSnap.exists()) {
            return { status: 'info' as const, message: 'Food coupon already redeemed!' };
          }
          tx.update(regRef, {
            couponRedeemed: true,
            couponRedeemedAt: nowIso,
          });
          tx.set(couponRef, {
            userId,
            eventId,
            redeemedAt: nowIso,
            vendorId: user.uid,
          });
          return { status: 'coupon_redeemed' as const };
        }

        return { status: 'error' as const, message: 'Invalid scanner mode.' };
      });

      if (txResult.status === 'error') {
        showToast(txResult.message, 'error');
        if (scanMode === 'coupon') setShowScanner(null);
        return;
      }

      if (txResult.status === 'info') {
        showToast(txResult.message, 'info');
        setShowScanner(null);
        return;
      }

      if (txResult.status === 'attendance_marked') {
        try {
          await updateDoc(doc(db, 'users', userId), {
            points: increment(50),
            updatedAt: nowIso,
          });
        } catch {
          // Non-blocking if profile points couldn't be incremented
        }
        await addDoc(collection(db, 'notifications'), {
          userId,
          title: 'Checked In (+50 Points)',
          message: `You checked in to "${event?.title || 'Event'}"${
            event?.hasFoodCoupon ? ' and unlocked your Food Coupon QR!' : '.'
          }`,
          type: 'event_update',
          read: false,
          createdAt: serverTimestamp(),
        });
        showToast('Attendance marked & +50 Campus Points awarded!', 'success');
      } else if (txResult.status === 'coupon_redeemed') {
        showToast('Food coupon redeemed!', 'success');
      }

      setShowScanner(null);
    } catch (err) {
      console.error('Scan process error:', err);
      showToast('Failed to process QR scan.', 'error');
    } finally {
      isProcessingScanRef.current = false;
    }
  };

  const exportToPDF = () => {
    if (!event) return;
    const pdf = new jsPDF();

    pdf.setFontSize(20);
    pdf.setTextColor(37, 99, 235);
    pdf.text('Campus Connect — Event Report', 14, 20);

    pdf.setFontSize(12);
    pdf.setTextColor(40);
    pdf.text(`Event: ${event.title}`, 14, 30);
    pdf.text(`Date: ${new Date(event.date).toLocaleDateString()} | Venue: ${event.venue}`, 14, 37);

    const attendedCount = registrations.filter((r) => r.attended).length;
    const redeemedCount = registrations.filter((r) => r.couponRedeemed).length;
    const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length;
    const totalCouponAmount = redeemedCount * (event.couponCost || 50);

    pdf.setFontSize(10);
    pdf.setTextColor(80);
    pdf.text(
      `Confirmed: ${confirmedCount}   |   Attended: ${attendedCount}   |   Coupons Redeemed: ${redeemedCount}   |   Canteen Liability: INR ${totalCouponAmount}`,
      14,
      46
    );

    const tableData = registrations.map((reg) => [
      reg.student?.name || reg.userName || reg.userId,
      reg.student?.email || reg.userEmail || '—',
      reg.ticketId || 'N/A',
      reg.status.toUpperCase(),
      reg.attended ? 'YES' : 'NO',
      reg.couponRedeemed ? 'REDEEMED' : 'NO',
    ]);

    autoTable(pdf, {
      startY: 54,
      head: [['Student', 'Email', 'Ticket ID', 'Status', 'Attended', 'Coupon']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
    });

    pdf.save(`${event.slug || event.title}_Report.pdf`);
    showToast('PDF report downloaded!', 'success');
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 800, 0.72);
      setProofDataUrl(dataUrl);
    } catch (err) {
      console.error('Proof compression error:', err);
      showToast('Could not read selected image.', 'error');
    }
  };

  const submitCanteenSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingPayment || !event) return;
    if (!upiTxnId.trim() && !proofDataUrl) {
      showToast('Please enter a UPI transaction ID or upload a screenshot proof.', 'error');
      return;
    }

    setUploading(true);
    let finalProofUrl = proofDataUrl;

    try {
      if (proofDataUrl) {
        try {
          const response = await axios.post('/api/sheets/sync', {
            action: 'uploadPaymentProof',
            eventId: event.id,
            paymentId: settlingPayment.id,
            fileName: `PaymentProof_${settlingPayment.id}.jpg`,
            fileData: proofDataUrl.split(',')[1],
            mimeType: 'image/jpeg',
          });
          if (response.data?.success && response.data?.fileUrl) {
            finalProofUrl = response.data.fileUrl;
          }
        } catch {
          // Apps Script Drive upload optional — Firestore stores compressed proof
        }
      }

      const paidAt = new Date().toISOString();
      await updateDoc(doc(db, 'payments', settlingPayment.id), {
        status: 'paid',
        paidAt,
        upiTransactionId: upiTxnId.trim() || undefined,
        paymentScreenshot: finalProofUrl || undefined,
      });

      if (settlingPayment.vendorId) {
        await addDoc(collection(db, 'notifications'), {
          userId: settlingPayment.vendorId,
          title: 'Canteen Payout Settled',
          message: `₹${settlingPayment.amount} for "${event.title}" has been settled${
            upiTxnId.trim() ? ` (Txn: ${upiTxnId.trim()})` : ''
          }.`,
          type: 'payment_update',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      setCanteenPayments((prev) =>
        prev.map((p) =>
          p.id === settlingPayment.id
            ? {
                ...p,
                status: 'paid',
                paidAt,
                upiTransactionId: upiTxnId.trim() || undefined,
                paymentScreenshot: finalProofUrl || undefined,
              }
            : p
        )
      );

      showToast('Canteen payout marked as settled!', 'success');
      setSettlingPayment(null);
      setUpiTxnId('');
      setProofDataUrl('');
    } catch (err) {
      console.error('Settlement error:', err);
      showToast('Failed to save settlement.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (reg.student?.name || reg.userName || '').toLowerCase().includes(q) ||
      (reg.student?.email || reg.userEmail || '').toLowerCase().includes(q) ||
      reg.userId.toLowerCase().includes(q) ||
      (reg.ticketId || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-10 text-center">
        <p className="text-lg font-bold mb-2">Event not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const confirmedRegs = registrations.filter((r) => r.status === 'confirmed');
  const attendedCount = registrations.filter((r) => r.attended).length;
  const redeemedCount = registrations.filter((r) => r.couponRedeemed).length;

  return (
    <div className="px-4 sm:px-6 pt-6 pb-12 max-w-5xl mx-auto space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 glass border border-border-subtle rounded-full flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight truncate">{event.title}</h1>
            <p className="text-xs text-secondary font-medium">
              {event.category} · {event.venue}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToPDF}
            className="px-4 py-2.5 glass border border-border-subtle rounded-xl text-xs font-bold text-primary flex items-center gap-2 hover:border-primary/40"
          >
            <Download size={14} />
            Export PDF
          </button>
          <button
            onClick={() => navigate(`/edit/${id}`)}
            className="w-10 h-10 glass border border-border-subtle rounded-xl flex items-center justify-center text-primary hover:border-primary/40"
            aria-label="Edit Event"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="w-10 h-10 glass border border-border-subtle rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10"
            aria-label="Delete Event"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass p-5 rounded-3xl border border-border-subtle">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Users size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Attendance</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">
            {attendedCount}{' '}
            <span className="text-sm text-secondary font-medium">/ {confirmedRegs.length}</span>
          </p>
          <div className="mt-3 w-full bg-secondary/15 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{
                width: `${confirmedRegs.length ? (attendedCount / confirmedRegs.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="glass p-5 rounded-3xl border border-border-subtle">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
              <Coffee size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
              Food Coupons
            </h3>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">
            {redeemedCount} <span className="text-sm text-secondary font-medium">Redeemed</span>
          </p>
          <p className="text-xs text-secondary font-medium mt-2 tabular-nums">
            {event.hasFoodCoupon
              ? `₹${(redeemedCount * (event.couponCost || 50)).toLocaleString()} canteen value`
              : 'No food coupons enabled'}
          </p>
        </div>

        <div className="glass p-5 rounded-3xl border border-border-subtle">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <CreditCard size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Revenue</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">
            ₹{(confirmedRegs.length * (event.fee || 0)).toLocaleString()}
          </p>
          <p className="text-xs text-secondary font-medium mt-2 tabular-nums">
            {confirmedRegs.length} confirmed {event.type === 'paid' ? 'paid' : 'free'} tickets
          </p>
        </div>
      </div>

      {/* Scanner Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setShowScanner('attendance')}
          className="glass p-5 rounded-3xl border border-primary/25 flex items-center justify-center gap-3 text-primary hover:bg-primary/5 transition-colors font-bold text-sm"
        >
          <QrCode size={22} />
          Scan Attendance QR
        </button>
        <button
          onClick={() => setShowScanner('coupon')}
          disabled={!event.hasFoodCoupon}
          className={`glass p-5 rounded-3xl border flex items-center justify-center gap-3 font-bold text-sm transition-colors ${
            event.hasFoodCoupon
              ? 'border-accent/25 text-accent hover:bg-accent/5'
              : 'border-border-subtle text-secondary opacity-50 cursor-not-allowed'
          }`}
        >
          <Coffee size={22} />
          Scan Food Coupon
        </button>
      </div>

      {/* Canteen Payouts */}
      {event.hasFoodCoupon && canteenPayments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CreditCard size={18} className="text-emerald-500" />
            Canteen Payouts
          </h3>
          <div className="space-y-3">
            {canteenPayments.map((payment) => (
              <div
                key={payment.id}
                className="glass p-5 rounded-3xl border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-sm">
                      {payment.vendor?.vendorName || payment.vendor?.name || 'Canteen Partner'}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        payment.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : payment.status === 'approved'
                          ? 'bg-blue-500/15 text-blue-500'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <p className="text-xs text-secondary tabular-nums">
                    {payment.studentCount} students · ₹{payment.amount.toLocaleString()} total
                    {(payment.vendorUpiId || payment.vendor?.upiId) &&
                      ` · UPI: ${payment.vendorUpiId || payment.vendor?.upiId}`}
                  </p>
                  {payment.upiTransactionId && (
                    <p className="text-xs text-emerald-500 font-mono mt-1">
                      Txn ID: {payment.upiTransactionId}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {payment.status !== 'paid' ? (
                    <button
                      onClick={() => {
                        setSettlingPayment(payment);
                        setUpiTxnId(payment.upiTransactionId || '');
                        setProofDataUrl('');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      <Upload size={14} />
                      Settle & Upload Proof
                    </button>
                  ) : (
                    payment.paymentScreenshot && (
                      <button
                        onClick={() =>
                          setPreviewImage({
                            title: 'Canteen Payment Proof',
                            src: payment.paymentScreenshot!,
                          })
                        }
                        className="flex items-center gap-2 px-4 py-2.5 glass border border-border-subtle rounded-xl text-xs font-bold hover:border-primary/40"
                      >
                        <ImageIcon size={14} />
                        View Proof
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* QR Control System */}
      <section className="glass p-6 rounded-3xl border border-border-subtle space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">Dynamic QR Pass Visibility</h3>
            <p className="text-xs text-secondary">
              Toggle whether students can currently view and present their attendance QR pass
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const nextVal = !event.qrVisible;
              await updateDoc(doc(db, 'events', event.id), { qrVisible: nextVal });
              setEvent({ ...event, qrVisible: nextVal });
              showToast(`Attendance QR ${nextVal ? 'enabled' : 'hidden'}.`, 'info');
            }}
            className={`w-14 h-8 rounded-full relative transition-colors shrink-0 ${
              event.qrVisible ? 'bg-primary' : 'bg-secondary/25'
            }`}
            aria-label="Toggle QR Visibility"
          >
            <div
              className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                event.qrVisible ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-secondary font-semibold block mb-1.5">
              Scan Limit per Student
            </label>
            <input
              type="number"
              min={1}
              value={event.qrScanLimit || 1}
              onChange={async (e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                await updateDoc(doc(db, 'events', event.id), { qrScanLimit: val });
                setEvent({ ...event, qrScanLimit: val });
              }}
              className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-semibold tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs text-secondary font-semibold block mb-1.5">
              QR Expiry Time (Optional)
            </label>
            <input
              type="datetime-local"
              value={event.qrExpiry || ''}
              onChange={async (e) => {
                const val = e.target.value;
                await updateDoc(doc(db, 'events', event.id), { qrExpiry: val });
                setEvent({ ...event, qrExpiry: val });
              }}
              className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm font-semibold"
            />
          </div>
        </div>
      </section>

      {/* Registrations List */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold">
            Registrations <span className="text-secondary font-medium tabular-nums">({registrations.length})</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'confirmed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${
                  statusFilter === tab
                    ? 'bg-primary text-white'
                    : 'glass border border-border-subtle text-secondary'
                }`}
              >
                {tab}
              </button>
            ))}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
              <input
                type="text"
                placeholder="Search student or ticket…"
                className="glass border border-border-subtle py-2 pl-9 pr-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredRegistrations.length > 0 ? (
            filteredRegistrations.map((reg) => {
              const displayName = reg.student?.name || reg.userName || reg.userId;
              const displayEmail = reg.student?.email || reg.userEmail;
              return (
                <div
                  key={reg.id}
                  className="glass p-5 rounded-3xl border border-border-subtle space-y-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {getInitials(displayName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{displayName}</p>
                        <p className="text-xs text-secondary truncate">
                          {displayEmail ? `${displayEmail} · ` : ''}Ticket: {reg.ticketId || 'Pending'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        reg.status === 'confirmed'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : reg.status === 'rejected'
                          ? 'bg-red-500/15 text-red-500'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {reg.status}
                    </span>
                  </div>

                  {reg.status === 'pending' && (
                    <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-secondary space-y-1">
                        {reg.transactionId && (
                          <p className="font-mono font-semibold text-foreground">
                            TXN: {reg.transactionId}
                          </p>
                        )}
                        {reg.paymentScreenshot && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                title: `Payment Proof — ${displayName}`,
                                src: reg.paymentScreenshot!,
                              })
                            }
                            className="text-primary font-semibold hover:underline flex items-center gap-1"
                          >
                            <ImageIcon size={13} />
                            View Screenshot
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => rejectRegistration(reg)}
                          className="px-3.5 py-2 border border-red-500/30 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500/10"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => verifyPayment(reg)}
                          className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90"
                        >
                          Verify & Issue Ticket
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-5 pt-1 text-xs font-semibold">
                    <span
                      className={`flex items-center gap-1.5 ${
                        reg.attended ? 'text-emerald-500' : 'text-secondary'
                      }`}
                    >
                      {reg.attended ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {reg.attended ? 'Attended' : 'Not Checked In'}
                    </span>
                    {event.hasFoodCoupon && (
                      <span
                        className={`flex items-center gap-1.5 ${
                          reg.couponRedeemed ? 'text-emerald-500' : 'text-secondary'
                        }`}
                      >
                        <Coffee size={14} />
                        {reg.couponRedeemed ? 'Coupon Redeemed' : 'Coupon Unused'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass p-10 rounded-3xl text-center border border-dashed border-border-subtle text-sm text-secondary">
              No matching registrations found.
            </div>
          )}
        </div>
      </section>

      {/* Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <QRScanner
            title={showScanner === 'attendance' ? 'Scan Attendance QR' : 'Scan Food Coupon QR'}
            onClose={() => setShowScanner(null)}
            onScan={handleScan}
          />
        )}
      </AnimatePresence>

      {/* Settle Canteen Payment Modal */}
      <AnimatePresence>
        {settlingPayment && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettlingPayment(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass rounded-3xl p-6 shadow-2xl border border-border-subtle max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Settle Canteen Payout</h3>
                <button
                  onClick={() => setSettlingPayment(null)}
                  className="p-2 rounded-xl hover:bg-secondary/10"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={submitCanteenSettlement} className="space-y-4">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-1">
                  <p className="text-xs text-secondary font-semibold uppercase tracking-wider">
                    Payable Amount
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums">
                    ₹{settlingPayment.amount.toLocaleString()}
                  </p>
                  {(settlingPayment.vendorUpiId || settlingPayment.vendor?.upiId) && (
                    <p className="text-xs text-primary font-mono">
                      Vendor UPI: {settlingPayment.vendorUpiId || settlingPayment.vendor?.upiId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">
                    UPI / Bank Transaction ID
                  </label>
                  <input
                    type="text"
                    value={upiTxnId}
                    onChange={(e) => setUpiTxnId(e.target.value)}
                    placeholder="e.g. 429183920192"
                    className="w-full bg-background/60 border border-border-subtle rounded-xl py-2.5 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">
                    Upload Payment Screenshot
                  </label>
                  <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-border-subtle cursor-pointer hover:border-primary/50 text-xs font-bold text-primary">
                    <Upload size={16} />
                    {proofDataUrl ? 'Screenshot Attached (Replace)' : 'Choose Screenshot Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProofFileChange}
                    />
                  </label>
                  {proofDataUrl && (
                    <img
                      src={proofDataUrl}
                      alt="Preview"
                      className="mt-3 rounded-xl max-h-40 w-full object-contain border border-border-subtle"
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettlingPayment(null)}
                    className="flex-1 py-3 rounded-xl border border-border-subtle text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
                  >
                    {uploading ? 'Saving…' : 'Confirm Settlement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Proof Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg glass rounded-3xl p-5 border border-border-subtle max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm">{previewImage.title}</h4>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg hover:bg-secondary/15"
                >
                  <X size={18} />
                </button>
              </div>
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="w-full max-h-[70vh] object-contain rounded-2xl bg-black/20"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
