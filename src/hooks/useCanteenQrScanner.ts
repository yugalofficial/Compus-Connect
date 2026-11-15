import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { db } from '../firebase';
import { Event, Registration, User } from '../types';

export type ScanStatus = 'idle' | 'success' | 'error' | 'processing';

export interface CanteenScanResult {
  reg: Registration;
  event?: Event;
  student?: User | null;
  organizer?: User | null;
}

interface UseCanteenQrScannerOptions {
  user: User | null;
  activeEventId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onScanStart?: () => void;
}

const SCAN_DEBOUNCE_MS = 3500;

export function useCanteenQrScanner({
  user,
  activeEventId,
  showToast,
  onScanStart,
}: UseCanteenQrScannerOptions) {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [message, setMessage] = useState('');
  const [scannedData, setScannedData] = useState<CanteenScanResult | null>(null);

  // Strict single-scan guards: in-flight mutex, last scanned QR ID + timestamp, and redeemed QR set
  const isProcessingScanRef = useRef(false);
  const lastScannedRef = useRef<{ qrId: string; timestamp: number }>({ qrId: '', timestamp: 0 });
  const redeemedQrIdsRef = useRef<Set<string>>(new Set());
  const onScanStartRef = useRef(onScanStart);

  useEffect(() => {
    onScanStartRef.current = onScanStart;
  }, [onScanStart]);

  const processScan = useCallback(
    async (decodedText: string) => {
      if (!user) return;
      const qrId = decodedText.trim();
      if (!qrId) return;

      const now = Date.now();

      // Enforce strict single-scan execution: block concurrent transactions, duplicate frames within cooldown, or already-redeemed QR IDs in this session
      if (isProcessingScanRef.current) {
        return;
      }

      if (redeemedQrIdsRef.current.has(qrId)) {
        lastScannedRef.current = { qrId, timestamp: now };
        setStatus('error');
        setMessage('This food coupon has already been redeemed!');
        return;
      }

      if (
        lastScannedRef.current.qrId === qrId &&
        now - lastScannedRef.current.timestamp < SCAN_DEBOUNCE_MS
      ) {
        return;
      }

      isProcessingScanRef.current = true;
      lastScannedRef.current = { qrId, timestamp: now };
      setStatus('processing');
      onScanStartRef.current?.();

      try {
        const parts = qrId.split(':');
        if (parts.length !== 4 || parts[0] !== 'coupon') {
          setStatus('error');
          setMessage('Invalid QR format. Please scan a Food Coupon QR code.');
          return;
        }

        const [, eventId, userId, token] = parts;

        if (activeEventId && eventId !== activeEventId) {
          lastScannedRef.current = { qrId: '', timestamp: 0 };
          setStatus('error');
          setMessage('This coupon belongs to a different event. Switch Active Event or verify.');
          return;
        }

        const regId = `${userId}_${eventId}`;
        const redeemedAt = new Date().toISOString();

        const txResult = await runTransaction(db, async (tx) => {
          const regRef = doc(db, 'registrations', regId);
          const eventRef = doc(db, 'events', eventId);
          const studentRef = doc(db, 'users', userId);
          const couponRef = doc(db, 'coupons', regId);

          const [regSnap, eventSnap, studentSnap, couponSnap] = await Promise.all([
            tx.get(regRef),
            tx.get(eventRef),
            tx.get(studentRef),
            tx.get(couponRef),
          ]);

          if (!regSnap.exists()) {
            return { ok: false as const, error: 'Student is not registered for this event.' };
          }

          const reg = { id: regSnap.id, ...regSnap.data() } as Registration;

          if (reg.status !== 'confirmed') {
            return { ok: false as const, error: 'Registration payment is not confirmed.' };
          }

          if (reg.validationToken && reg.validationToken !== token) {
            return { ok: false as const, error: 'Security validation failed!' };
          }

          if (!reg.attended) {
            return { ok: false as const, error: 'Student has not checked into the event yet.' };
          }

          if (reg.couponRedeemed || couponSnap.exists()) {
            return {
              ok: false as const,
              alreadyRedeemed: true as const,
              error: 'This food coupon has already been redeemed!',
            };
          }

          const event = eventSnap.exists()
            ? ({ id: eventSnap.id, ...eventSnap.data() } as Event)
            : undefined;
          const student = studentSnap.exists()
            ? ({ uid: studentSnap.id, ...studentSnap.data() } as User)
            : null;

          tx.update(regRef, {
            couponRedeemed: true,
            couponRedeemedAt: redeemedAt,
          });

          tx.set(couponRef, {
            userId,
            eventId,
            redeemedAt,
            vendorId: user.uid,
          });

          return { ok: true as const, reg, event, student };
        });

        if (!txResult.ok) {
          if ('alreadyRedeemed' in txResult && txResult.alreadyRedeemed) {
            redeemedQrIdsRef.current.add(qrId);
          }
          setStatus('error');
          setMessage(txResult.error);
          return;
        }

        redeemedQrIdsRef.current.add(qrId);

        let organizer: User | null = null;
        if (txResult.event?.organizerId) {
          try {
            const orgDoc = await getDoc(doc(db, 'users', txResult.event.organizerId));
            organizer = orgDoc.exists() ? (orgDoc.data() as User) : null;
          } catch {
            organizer = null;
          }
        }

        await addDoc(collection(db, 'notifications'), {
          userId,
          title: 'Food Coupon Redeemed',
          message: `Your meal coupon for "${txResult.event?.title || 'Event'}" was redeemed at ${
            user.vendorName || user.name
          }.`,
          type: 'event_update',
          read: false,
          createdAt: serverTimestamp(),
        });

        setScannedData({
          reg: { ...txResult.reg, couponRedeemed: true, couponRedeemedAt: redeemedAt },
          event: txResult.event,
          student: txResult.student,
          organizer,
        });
        setStatus('success');
        setMessage('Food coupon redeemed successfully!');
        confetti({
          particleCount: 80,
          spread: 65,
          origin: { y: 0.6 },
        });
        showToast(
          `Meal redeemed for ${txResult.student?.name || txResult.reg.userName || 'Student'}!`,
          'success'
        );
      } catch (err) {
        console.error('Canteen QR scan error:', err);
        setStatus('error');
        setMessage('Failed to validate and redeem coupon.');
      } finally {
        isProcessingScanRef.current = false;
      }
    },
    [user, activeEventId, showToast]
  );

  // Store latest useCallback in a ref so scanner callers hold a permanently stable callback reference
  const scanCallbackRef = useRef(processScan);
  useEffect(() => {
    scanCallbackRef.current = processScan;
  }, [processScan]);

  const handleScan = useCallback((decodedText: string) => {
    void scanCallbackRef.current(decodedText);
  }, []);

  const resetScanState = useCallback(() => {
    setStatus('idle');
    setMessage('');
    setScannedData(null);
    lastScannedRef.current = { qrId: '', timestamp: 0 };
  }, []);

  return {
    status,
    message,
    scannedData,
    handleScan,
    resetScanState,
  };
}
