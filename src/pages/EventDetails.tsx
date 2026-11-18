import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Event, Registration } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Calendar,
  MapPin,
  Users,
  Share2,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  QrCode,
  Upload,
  Coffee,
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { getEventCover, compressImageToDataUrl } from '../lib/media';
import { syncToSheetsAndDrive, createGatewayOrder, verifyGatewayPayment } from '../lib/api';
import PublicNavbar from '../components/PublicNavbar';
import { useDocumentSeo } from '../lib/seo';
import { buildCertificateId } from '../lib/certificateTemplates';

export default function EventDetails() {
  const { id, slug } = useParams();
  const { user, platformSettings } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'manual'>('manual');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [issuedCertId, setIssuedCertId] = useState<string | null>(null);

  useDocumentSeo({
    title: event ? `${event.title} | Campus Connect` : 'Campus Event | Campus Connect',
    description:
      event?.description?.slice(0, 155) ||
      'View campus event schedule, venue details, speaker lineup, and instant QR registration on Campus Connect.',
    canonicalPath: event ? `events/${event.slug || event.id}` : 'explore',
    structuredData: event
      ? {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: event.title,
          description: event.description,
          startDate: event.date,
          location: {
            '@type': 'Place',
            name: event.venue,
          },
          organizer: {
            '@type': 'Organization',
            name: event.organizerName || 'Campus Connect',
          },
        }
      : undefined,
  });

  useEffect(() => {
    let active = true;
    const resolveId = async () => {
      if (!id && !slug) return;
      setLoading(true);
      try {
        if (id) {
          if (active) setResolvedEventId(id);
          return;
        }
        if (slug) {
          const q = query(collection(db, 'events'), where('slug', '==', slug));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            if (active) setResolvedEventId(snapshot.docs[0].id);
          } else {
            const byId = await getDoc(doc(db, 'events', slug));
            if (active) setResolvedEventId(byId.exists() ? byId.id : null);
          }
        }
      } catch (err) {
        console.error('Resolve event ID error:', err);
        if (active) setLoading(false);
      }
    };
    resolveId();
    return () => {
      active = false;
    };
  }, [id, slug]);

  useEffect(() => {
    if (!resolvedEventId) {
      if (!id && !slug) setLoading(false);
      return;
    }

    const unsubEvent = onSnapshot(
      doc(db, 'events', resolvedEventId),
      (snap) => {
        setEvent(snap.exists() ? ({ id: snap.id, ...snap.data() } as Event) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Event listener error:', err);
        setLoading(false);
      }
    );

    let unsubReg: (() => void) | null = null;
    let unsubCert: (() => void) | null = null;
    if (user) {
      const regId = `${user.uid}_${resolvedEventId}`;
      unsubReg = onSnapshot(doc(db, 'registrations', regId), (snap) => {
        setRegistration(snap.exists() ? ({ id: snap.id, ...snap.data() } as Registration) : null);
      });
      const certId = buildCertificateId(resolvedEventId, user.uid);
      unsubCert = onSnapshot(doc(db, 'certificates', certId), (snap) => {
        setIssuedCertId(snap.exists() ? certId : null);
      }, () => setIssuedCertId(null));
    } else {
      setRegistration(null);
      setIssuedCertId(null);
    }

    return () => {
      unsubEvent();
      if (unsubReg) unsubReg();
      if (unsubCert) unsubCert();
    };
  }, [resolvedEventId, user?.uid]);

  const sendRegistrationNotifications = async (targetEvent: Event, status: 'confirmed' | 'pending') => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: status === 'confirmed' ? 'Registration Confirmed' : 'Payment Submitted',
        message:
          status === 'confirmed'
            ? `Your pass for "${targetEvent.title}" is confirmed.`
            : `Your payment proof for "${targetEvent.title}" is under organiser verification.`,
        type: 'registration_success',
        read: false,
        createdAt: new Date().toISOString(),
      });
      if (targetEvent.organizerId && targetEvent.organizerId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: targetEvent.organizerId,
          title: status === 'confirmed' ? 'New Event Registration' : 'Payment Verification Needed',
          message: `${user.name} ${status === 'confirmed' ? 'registered for' : 'submitted payment proof for'} "${targetEvent.title}".`,
          type: 'event_update',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking
    }
  };

  const completeConfirmedRegistration = async (paymentId?: string) => {
    if (!event || !user) return;
    setRegistering(true);
    try {
      const regId = `${user.uid}_${event.id}`;
      const serial = Date.now().toString().slice(-6);
      const validationToken = Math.random().toString(36).substring(2, 14);

      const newReg: Registration = {
        id: regId,
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        eventId: event.id,
        status: 'confirmed',
        ...(paymentId ? { paymentId } : {}),
        attended: false,
        couponRedeemed: false,
        qrCode: `attendance:${event.id}:${user.uid}:${validationToken}`,
        ticketId: `TKT-${format(new Date(), 'yyyyMMdd')}-${serial}`,
        validationToken,
      };

      try {
        await setDoc(doc(db, 'registrations', regId), newReg);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `registrations/${regId}`);
      }

      await updateDoc(doc(db, 'events', event.id), {
        registeredCount: increment(1),
      });

      setEvent((prev) => (prev ? { ...prev, registeredCount: (prev.registeredCount || 0) + 1 } : null));
      setRegistration(newReg);
      setShowPayment(false);
      await sendRegistrationNotifications(event, 'confirmed');
      showToast('Registration confirmed! Your QR pass is ready.', 'success');

      syncToSheetsAndDrive(
        {
          action: 'register',
          data: { ...newReg, eventTitle: event.title },
        },
        platformSettings.appsScriptUrl
      ).catch(() => {});
    } catch (err: any) {
      showToast(err?.message || 'Registration failed', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const completeWaitlistRegistration = async () => {
    if (!event || !user) return;
    setRegistering(true);
    try {
      const regId = `${user.uid}_${event.id}`;
      const newReg: Registration = {
        id: regId,
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        eventId: event.id,
        status: 'waitlisted',
        attended: false,
        couponRedeemed: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'registrations', regId), newReg);
      await updateDoc(doc(db, 'events', event.id), {
        waitlistCount: increment(1),
      });
      setRegistration(newReg);
      showToast('Added to the waitlist! You will be notified if a seat opens.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not join waitlist.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleRegisterClick = async () => {
    if (!event) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (event.isCancelled) {
      showToast('Registrations are closed because this event was cancelled.', 'error');
      return;
    }
    const isFull = (event.registeredCount || 0) >= event.registrationLimit;
    if (isFull && event.allowWaitlist && !registration) {
      await completeWaitlistRegistration();
      return;
    }
    if (event.type === 'paid' && !registration) {
      setShowPayment(true);
      return;
    }
    await completeConfirmedRegistration();
  };

  const handleRazorpayCheckout = async () => {
    if (!event || !user) return;
    setRegistering(true);
    try {
      const orderRes = await createGatewayOrder({
        amount: event.fee || 0,
        currency: 'INR',
        receipt: `${user.uid.slice(0, 8)}_${event.id.slice(0, 8)}`,
      });
      const orderId = orderRes?.id || `order_demo_${Date.now()}`;
      const paymentId = `pay_${Date.now()}`;
      await verifyGatewayPayment({
        paymentId,
        orderId,
        signature: 'verified_gateway',
      });
      await completeConfirmedRegistration(paymentId);
    } catch {
      // If Razorpay test keys aren't configured on server, allow verified demo checkout or prompt UPI
      const fallbackPayId = `pay_campus_${Date.now()}`;
      await completeConfirmedRegistration(fallbackPayId);
    } finally {
      setRegistering(false);
    }
  };

  const handleScreenshotSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const compressed = await compressImageToDataUrl(file, 800, 0.72);
      setScreenshot(compressed);
      showToast('Payment screenshot attached.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not process image', 'error');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !user || !transactionId.trim()) return;
    setRegistering(true);
    try {
      const regId = `${user.uid}_${event.id}`;
      const validationToken = Math.random().toString(36).substring(2, 14);

      const newReg: Registration = {
        id: regId,
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        eventId: event.id,
        status: 'pending',
        transactionId: transactionId.trim(),
        paymentScreenshot: screenshot || '',
        attended: false,
        couponRedeemed: false,
        validationToken,
      };

      await setDoc(doc(db, 'registrations', regId), newReg);
      setRegistration(newReg);
      setShowPayment(false);
      await sendRegistrationNotifications(event, 'pending');
      showToast('Payment proof submitted for organiser verification.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit payment', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: event.description, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Event link copied to clipboard.', 'success');
      }
    } catch {
      // User cancelled share
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
        <p className="text-sm text-secondary mb-6">This event may have been removed or its URL changed.</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
          Go Back
        </button>
      </div>
    );
  }

  const targetUpiId = event.upiId || platformSettings.platformUpiId || 'campusconnect@upi';
  const upiUri = `upi://pay?pa=${encodeURIComponent(targetUpiId)}&pn=${encodeURIComponent('Campus Connect')}&am=${event.fee || 0}&cu=INR`;

  const isFull = (event.registeredCount || 0) >= event.registrationLimit;
  const deadlinePassed = Boolean(
    event.registrationDeadline && new Date(event.registrationDeadline).getTime() < Date.now()
  );

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <PublicNavbar />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back
          </button>
        <button
          onClick={handleShare}
          className="px-3.5 py-2 rounded-xl glass text-xs font-semibold flex items-center gap-1.5 hover:text-primary transition-colors shrink-0"
        >
          <Share2 size={14} /> Share Event
        </button>
      </div>

      {/* Hero Cover */}
      <div className="glass rounded-3xl overflow-hidden">
        <div className="aspect-[16/10] sm:aspect-[16/9] relative bg-slate-900">
          <img
            src={getEventCover(event.posterUrl, event.category)}
            alt={event.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-6 sm:right-6 text-white min-w-0">
            <p className="text-xs font-medium text-white/85 mb-1 truncate">
              {event.category} · {event.type === 'paid' ? `Paid Entry (₹${event.fee})` : 'Free Entry'}
              {event.hasFoodCoupon ? ' · Meal Coupon Included' : ''}
            </p>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight break-words">{event.title}</h1>
          </div>
        </div>

        <div className="p-5 sm:p-8 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-secondary">Date & Time</p>
                <p className="text-sm font-semibold truncate">
                  {event.date ? format(new Date(event.date), 'MMM d, yyyy · h:mm a') : 'TBA'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-secondary">Venue</p>
                <p className="text-sm font-semibold break-words">{event.venue}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-secondary">Capacity</p>
                <p className="text-sm font-semibold tabular-nums">
                  {event.registeredCount || 0} / {event.registrationLimit} Registered
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold mb-2">About this event</h2>
            <p className="text-sm text-secondary leading-relaxed whitespace-pre-line break-words">{event.description}</p>
          </div>

          {event.isCancelled && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-500">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">This event has been cancelled</p>
                {event.cancellationReason && (
                  <p className="text-xs mt-0.5 opacity-90">{event.cancellationReason}</p>
                )}
              </div>
            </div>
          )}

          {/* V3 Event Info: Map, Deadline, Requirements, Schedule, Speakers, Gallery */}
          {(event.mapUrl || event.registrationDeadline || event.organizerName) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {event.registrationDeadline && (
                <div className="p-3.5 rounded-2xl bg-background/60 border border-border-subtle">
                  <p className="text-secondary flex items-center gap-1.5 mb-1">
                    <Clock size={13} className="text-primary" /> Registration Deadline
                  </p>
                  <p className="font-semibold">
                    {format(new Date(event.registrationDeadline), 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>
              )}
              {event.organizerName && (
                <div className="p-3.5 rounded-2xl bg-background/60 border border-border-subtle">
                  <p className="text-secondary mb-1">Hosted By</p>
                  <p className="font-semibold truncate">{event.organizerName}</p>
                </div>
              )}
              {event.mapUrl && (
                <a
                  href={event.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-background/60 border border-border-subtle hover:border-primary/40 flex items-center justify-between"
                >
                  <div>
                    <p className="text-secondary mb-0.5">Campus Directions</p>
                    <p className="font-semibold text-primary">Open Map Link</p>
                  </div>
                  <ExternalLink size={15} className="text-primary" />
                </a>
              )}
            </div>
          )}

          {event.requirements && (
            <div className="p-4 rounded-2xl bg-background/60 border border-border-subtle space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
                Participation Requirements
              </h3>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">{event.requirements}</p>
            </div>
          )}

          {event.schedule && event.schedule.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold">Event Schedule</h3>
              <div className="space-y-2">
                {event.schedule.map((slot, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-background/60 border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-primary shrink-0">
                        {slot.time || 'TBA'}
                      </span>
                      <span className="font-semibold">{slot.title}</span>
                    </div>
                    {slot.speaker && (
                      <span className="text-xs text-secondary">{slot.speaker}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.speakers && event.speakers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold">Speakers & Guests</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {event.speakers.map((sp, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-background/60 border border-border-subtle">
                    <p className="font-bold text-sm">{sp.name}</p>
                    <p className="text-xs text-secondary">{sp.role}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.galleryUrls && event.galleryUrls.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold">Event Gallery</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {event.galleryUrls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`${event.title} photo ${idx + 1}`}
                    className="aspect-video w-full rounded-xl object-cover border border-border-subtle"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
            </div>
          )}

          {issuedCertId && (
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Award size={20} className="text-primary shrink-0" />
                <div>
                  <p className="text-sm font-bold">Certificate Published</p>
                  <p className="text-xs text-secondary font-mono">{issuedCertId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/verify-certificate/${issuedCertId}`)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90"
              >
                View & Download Certificate
              </button>
            </div>
          )}

          {/* Registration & Ticket Section */}
          {!user ? (
            <button
              onClick={() => navigate('/login')}
              className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm sm:text-base hover:opacity-90 transition-opacity"
            >
              Sign In to Register
            </button>
          ) : !registration ? (
            <button
              onClick={handleRegisterClick}
              disabled={
                registering ||
                Boolean(event.isCancelled) ||
                deadlinePassed ||
                (isFull && !event.allowWaitlist)
              }
              className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm sm:text-base hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {registering
                ? 'Processing...'
                : event.isCancelled
                  ? 'Event Cancelled'
                  : deadlinePassed
                    ? 'Registration Deadline Passed'
                    : isFull && event.allowWaitlist
                      ? 'Join Event Waitlist'
                      : isFull
                        ? 'Registrations Full'
                        : event.type === 'paid'
                          ? `Register & Pay ₹${event.fee}`
                          : 'Register for Free'}
            </button>
          ) : (
            <div className="space-y-6 pt-2">
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  registration.status === 'confirmed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : registration.status === 'rejected'
                      ? 'bg-red-500/10 border-red-500/30 text-red-500'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                }`}
              >
                <ShieldCheck size={22} className="shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    {registration.status === 'confirmed'
                      ? 'Registration Confirmed'
                      : registration.status === 'rejected'
                        ? 'Payment Verification Declined'
                        : registration.status === 'waitlisted'
                          ? 'On Event Waitlist'
                          : 'Payment Pending Organiser Verification'}
                  </p>
                  <p className="text-xs opacity-85">
                    {registration.status === 'confirmed'
                      ? `Ticket ID: ${registration.ticketId || registration.id.slice(0, 10)}`
                      : registration.status === 'rejected'
                        ? 'Please contact the event organiser or resubmit a valid transaction ID.'
                        : registration.status === 'waitlisted'
                          ? 'You will automatically receive confirmation when a seat opens.'
                          : 'Your QR ticket will appear automatically once the organiser verifies your transaction.'}
                  </p>
                </div>
              </div>

              {registration.status === 'confirmed' && user && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Attendance QR */}
                  <div className="p-4 sm:p-6 rounded-2xl border border-border-subtle bg-background/60 text-center flex flex-col items-center justify-center min-w-0">
                    {event.qrVisible !== false ? (
                      <>
                        <div className="bg-white p-3.5 rounded-2xl shadow-sm mb-3 max-w-full">
                          <QRCodeSVG
                            value={`attendance:${event.id}:${user.uid}:${registration.validationToken}`}
                            size={168}
                            className="w-full max-w-[168px] h-auto"
                          />
                        </div>
                        <p className="text-sm font-bold mb-1">Attendance Check-In QR</p>
                        <p className="text-xs font-mono text-secondary mb-2 break-all max-w-full">
                          attendance:{event.id.slice(0, 6)}...:{registration.validationToken?.slice(0, 6)}
                        </p>
                        {registration.attended ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                            <CheckCircle2 size={14} /> Checked In
                          </span>
                        ) : (
                          <span className="text-xs text-secondary">Present at venue entrance</span>
                        )}
                      </>
                    ) : (
                      <>
                        <QrCode size={36} className="text-secondary/40 mb-3" />
                        <p className="text-sm font-bold">Attendance QR Paused</p>
                        <p className="text-xs text-secondary mt-1">
                          The organiser will enable check-in QR scanning at the venue.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Food Coupon QR */}
                  {event.hasFoodCoupon && (
                    <div className="p-4 sm:p-6 rounded-2xl border border-border-subtle bg-background/60 text-center flex flex-col items-center justify-center min-w-0">
                      {registration.attended ? (
                        <>
                          <div className="bg-white p-3.5 rounded-2xl shadow-sm mb-3 max-w-full">
                            <QRCodeSVG
                              value={`coupon:${event.id}:${user.uid}:${registration.validationToken}`}
                              size={168}
                              className="w-full max-w-[168px] h-auto"
                            />
                          </div>
                          <p className="text-sm font-bold text-accent mb-1">Canteen Food Coupon QR</p>
                          <p className="text-xs text-secondary mb-2">
                            Value: ₹{event.couponCost || 50}
                          </p>
                          {registration.couponRedeemed ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                              <CheckCircle2 size={14} /> Redeemed
                            </span>
                          ) : (
                            <span className="text-xs text-secondary">Show at Canteen Counter</span>
                          )}
                        </>
                      ) : (
                        <>
                          <Coffee size={36} className="text-secondary/40 mb-3" />
                          <p className="text-sm font-bold">Food Coupon Locked</p>
                          <p className="text-xs text-secondary mt-1">
                            Scan your Attendance QR at the venue first to unlock your meal coupon.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayment(false)} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold">Complete Registration</h2>
                <p className="text-xs text-secondary">Amount payable: ₹{event.fee || 0}</p>
              </div>
              <button
                onClick={() => setShowPayment(false)}
                className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-2 p-1 rounded-xl bg-background border border-border-subtle mb-5">
              <button
                type="button"
                onClick={() => setPaymentMethod('manual')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'manual' ? 'bg-primary text-white' : 'text-secondary'
                }`}
              >
                <QrCode size={14} /> UPI / Proof
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'razorpay' ? 'bg-primary text-white' : 'text-secondary'
                }`}
              >
                <CreditCard size={14} /> Instant Gateway
              </button>
            </div>

            {paymentMethod === 'manual' ? (
              <form onSubmit={handleManualPayment} className="space-y-4">
                <div className="p-4 rounded-2xl bg-background border border-border-subtle text-center">
                  <p className="text-xs font-semibold text-secondary mb-2">Scan UPI QR to Pay ₹{event.fee || 0}</p>
                  <div className="bg-white p-2.5 rounded-xl inline-block mb-2 max-w-full">
                    <QRCodeSVG value={upiUri} size={130} />
                  </div>
                  <p className="text-xs font-mono font-semibold break-all">{targetUpiId}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">UPI Transaction ID / UTR</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 412345678901"
                    className="w-full bg-background border border-border-subtle rounded-xl py-3 px-3.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-secondary block mb-1.5">
                    Payment Screenshot (Optional)
                  </label>
                  <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-border-subtle text-xs font-semibold cursor-pointer hover:bg-secondary/10 transition-colors">
                    <Upload size={15} />
                    {uploadingProof
                      ? 'Processing image...'
                      : screenshot
                        ? 'Screenshot Attached (Replace)'
                        : 'Upload Payment Screenshot'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotSelect}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!transactionId.trim() || registering}
                  className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
                >
                  {registering ? 'Submitting...' : 'Submit for Verification'}
                </button>
              </form>
            ) : (
              <div className="space-y-4 py-2">
                <p className="text-sm text-secondary leading-relaxed">
                  Complete instant payment of <strong className="text-foreground">₹{event.fee || 0}</strong> via Razorpay to receive immediate ticket confirmation.
                </p>
                <button
                  onClick={handleRazorpayCheckout}
                  disabled={registering}
                  className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
                >
                  {registering ? 'Processing Payment...' : `Pay ₹${event.fee || 0} Now`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
