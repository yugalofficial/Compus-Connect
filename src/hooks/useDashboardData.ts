import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { CanteenPayment, Event, Registration, Society, User, UserRole } from '../types';

export type EnrichedRedemption = Registration & { event?: Event; student?: User };

export interface EventCouponStat {
  title: string;
  count: number;
  cost: number;
  organizerId: string;
}

export function useDashboardData(scopeRole?: UserRole) {
  const { user, isAdmin, isApproved } = useAuth();
  const effectiveRole: UserRole | undefined = scopeRole || user?.role;

  const [events, setEvents] = useState<Event[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [rawRegistrations, setRawRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<CanteenPayment[]>([]);
  const [redemptions, setRedemptions] = useState<EnrichedRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset all role-specific slices atomically when user/role/approval changes
    setEvents([]);
    setSocieties([]);
    setRawRegistrations([]);
    setUsers([]);
    setPayments([]);
    setRedemptions([]);
    setError(null);

    if (!user || !isApproved || !effectiveRole) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const unsubscribers: Array<() => void> = [];

    // STUDENT DASHBOARD STREAM
    if (effectiveRole === 'student') {
      const unsubEvents = onSnapshot(
        collection(db, 'events'),
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
          list.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
          setEvents(list);
          setLoading(false);
        },
        (err) => {
          console.error('Student events listener error:', err);
          if (active) {
            setError(err.message);
            setLoading(false);
          }
        }
      );

      const unsubSocieties = onSnapshot(
        collection(db, 'societies'),
        (snap) => {
          if (!active) return;
          setSocieties(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Society)));
        },
        (err) => console.error('Student societies listener error:', err)
      );

      const unsubRegs = onSnapshot(
        query(collection(db, 'registrations'), where('userId', '==', user.uid)),
        (snap) => {
          if (!active) return;
          setRawRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration)));
        },
        (err) => console.error('Student registrations listener error:', err)
      );

      unsubscribers.push(unsubEvents, unsubSocieties, unsubRegs);
    }

    // ORGANISER DASHBOARD STREAM
    else if (effectiveRole === 'organizer') {
      const eventQ = isAdmin
        ? query(collection(db, 'events'))
        : query(collection(db, 'events'), where('organizerId', '==', user.uid));

      const unsubEvents = onSnapshot(
        eventQ,
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
          list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          setEvents(list);
          setLoading(false);
        },
        (err) => {
          console.error('Organiser events listener error:', err);
          if (active) {
            setError(err.message);
            setLoading(false);
          }
        }
      );

      const payQ = isAdmin
        ? query(collection(db, 'payments'))
        : query(collection(db, 'payments'), where('organizerId', '==', user.uid));

      const unsubPayments = onSnapshot(
        payQ,
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CanteenPayment));
          list.sort(
            (a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime()
          );
          setPayments(list);
        },
        (err) => console.error('Organiser payments listener error:', err)
      );

      const unsubRegs = onSnapshot(
        collection(db, 'registrations'),
        (snap) => {
          if (!active) return;
          setRawRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration)));
        },
        (err) => console.error('Organiser registrations listener error:', err)
      );

      const unsubVendors = onSnapshot(
        query(collection(db, 'users'), where('role', '==', 'canteen')),
        (snap) => {
          if (!active) return;
          setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
        },
        (err) => console.error('Organiser vendors listener error:', err)
      );

      unsubscribers.push(unsubEvents, unsubPayments, unsubRegs, unsubVendors);
    }

    // CANTEEN DASHBOARD STREAM
    else if (effectiveRole === 'canteen') {
      const eventsQ = query(collection(db, 'events'), where('hasFoodCoupon', '==', true));
      const unsubEvents = onSnapshot(
        eventsQ,
        (snap) => {
          if (!active) return;
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Event))
            .filter((ev) => ev.status === 'upcoming' || ev.status === 'ongoing');
          list.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
          setEvents(list);
        },
        (err) => console.error('Canteen events listener error:', err)
      );

      const regQ = query(collection(db, 'registrations'), where('couponRedeemed', '==', true));
      const unsubRedemptions = onSnapshot(
        regQ,
        async (snap) => {
          try {
            const enriched = await Promise.all(
              snap.docs.map(async (d) => {
                const reg = { id: d.id, ...d.data() } as Registration;
                const [eventDoc, userDoc] = await Promise.all([
                  getDoc(doc(db, 'events', reg.eventId)),
                  getDoc(doc(db, 'users', reg.userId)),
                ]);
                return {
                  ...reg,
                  event: eventDoc.exists() ? ({ id: eventDoc.id, ...eventDoc.data() } as Event) : undefined,
                  student: userDoc.exists() ? ({ uid: userDoc.id, ...userDoc.data() } as User) : undefined,
                };
              })
            );
            if (!active) return;
            enriched.sort((a, b) => {
              const ta = new Date(a.couponRedeemedAt || a.scannedAt || 0).getTime();
              const tb = new Date(b.couponRedeemedAt || b.scannedAt || 0).getTime();
              return tb - ta;
            });
            setRedemptions(enriched);
          } catch (err: any) {
            console.error('Canteen redemptions error:', err);
            if (active) setError(err?.message || 'Failed to load redemptions');
          } finally {
            if (active) setLoading(false);
          }
        },
        (err) => {
          console.error('Canteen redemptions listener error:', err);
          if (active) {
            setError(err.message);
            setLoading(false);
          }
        }
      );

      const payQ = isAdmin
        ? query(collection(db, 'payments'))
        : query(collection(db, 'payments'), where('vendorId', '==', user.uid));

      const unsubPayments = onSnapshot(
        payQ,
        (snap) => {
          if (!active) return;
          setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CanteenPayment)));
        },
        (err) => console.error('Canteen payments listener error:', err)
      );

      unsubscribers.push(unsubEvents, unsubRedemptions, unsubPayments);
    }

    // SUPER ADMIN DASHBOARD STREAM
    else if (effectiveRole === 'admin') {
      const unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User));
          list.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (b.status === 'pending' && a.status !== 'pending') return 1;
            return (a.name || '').localeCompare(b.name || '');
          });
          setUsers(list);
          setLoading(false);
        },
        (err) => {
          console.error('Admin users listener error:', err);
          if (active) {
            setError(err.message);
            setLoading(false);
          }
        }
      );

      const unsubEvents = onSnapshot(
        collection(db, 'events'),
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
          list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          setEvents(list);
        },
        (err) => console.error('Admin events listener error:', err)
      );

      const unsubRegs = onSnapshot(
        collection(db, 'registrations'),
        (snap) => {
          if (!active) return;
          setRawRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration)));
        },
        (err) => console.error('Admin registrations listener error:', err)
      );

      const unsubSocieties = onSnapshot(
        collection(db, 'societies'),
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Society));
          list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setSocieties(list);
        },
        (err) => console.error('Admin societies listener error:', err)
      );

      const unsubPayments = onSnapshot(
        collection(db, 'payments'),
        (snap) => {
          if (!active) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CanteenPayment));
          list.sort(
            (a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime()
          );
          setPayments(list);
        },
        (err) => console.error('Admin payments listener error:', err)
      );

      unsubscribers.push(unsubUsers, unsubEvents, unsubRegs, unsubSocieties, unsubPayments);
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user?.uid, effectiveRole, isAdmin, isApproved]);

  const registrations = useMemo(() => {
    if (effectiveRole === 'organizer' && !isAdmin) {
      const myEventIds = new Set(events.map((e) => e.id));
      return rawRegistrations.filter((r) => myEventIds.has(r.eventId));
    }
    return rawRegistrations;
  }, [effectiveRole, isAdmin, events, rawRegistrations]);

  const vendorMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      if (u.role === 'canteen' || effectiveRole === 'organizer') {
        map[u.uid] = u;
      }
    });
    return map;
  }, [users, effectiveRole]);

  const paymentsByEvent = useMemo(() => {
    const map: Record<string, CanteenPayment> = {};
    payments.forEach((p) => {
      map[p.eventId] = p;
    });
    return map;
  }, [payments]);

  const { earnings, eventStats } = useMemo(() => {
    let total = 0;
    const stats: Record<string, EventCouponStat> = {};
    redemptions.forEach((r) => {
      if (r.event) {
        const cost = r.event.couponCost || 50;
        total += cost;
        if (!stats[r.eventId]) {
          stats[r.eventId] = {
            title: r.event.title,
            count: 0,
            cost,
            organizerId: r.event.organizerId,
          };
        }
        stats[r.eventId].count += 1;
      }
    });
    return { earnings: total, eventStats: stats };
  }, [redemptions]);

  return {
    loading,
    error,
    events,
    societies,
    setSocieties,
    registrations,
    users,
    vendorMap,
    payments,
    paymentsByEvent,
    redemptions,
    earnings,
    eventStats,
  };
}
