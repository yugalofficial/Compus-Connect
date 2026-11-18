import React, { useEffect, useState, useMemo } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Event, Society, IssuedCertificate, SocietyApplication } from '../types';
import EventCard from '../components/EventCard';
import { Search, Sparkles, Calendar, Award, Users, QrCode, TrendingUp, CheckCircle2, Download, Clock, Utensils, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { Link, useNavigate } from 'react-router-dom';
import { getEventRecommendations } from '../services/aiService';
import { format } from 'date-fns';
import { getEventCover, getInitials } from '../lib/media';
import { downloadCertificatePdf } from '../lib/certificatePdf';

export default function Home() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    events,
    societies,
    setSocieties,
    registrations: rawRegistrations,
    loading,
  } = useDashboardData('student');

  const [recommendations, setRecommendations] = useState<Event[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>(user?.followedSocieties || []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [societyApps, setSocietyApps] = useState<SocietyApplication[]>([]);

  useEffect(() => {
    setFollowedIds(user?.followedSocieties || []);
  }, [user?.followedSocieties]);

  useEffect(() => {
    if (!user) return;
    const unsubCerts = onSnapshot(
      query(collection(db, 'certificates'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IssuedCertificate, 'id'>),
        }));
        list.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
        setCertificates(list);
      },
      () => {}
    );
    const unsubApps = onSnapshot(
      query(collection(db, 'society_applications'), where('userId', '==', user.uid)),
      (snap) => {
        setSocietyApps(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SocietyApplication, 'id'>),
          }))
        );
      },
      () => {}
    );
    return () => {
      unsubCerts();
      unsubApps();
    };
  }, [user?.uid]);

  useEffect(() => {
    let active = true;
    if (user && events.length > 0) {
      getEventRecommendations(user.interests, events)
        .then((recIds) => {
          if (active) setRecommendations(events.filter((e) => recIds.includes(e.id)));
        })
        .catch(() => {});
    } else {
      setRecommendations([]);
    }
    return () => {
      active = false;
    };
  }, [events, user?.interests]);

  const myRegistrations = rawRegistrations.map((reg) => ({
    ...reg,
    event: events.find((e) => e.id === reg.eventId),
  }));

  const activityTimeline = useMemo(() => {
    const items: { id: string; label: string; detail: string; time: string; kind: 'reg' | 'att' | 'meal' | 'cert' | 'soc' }[] = [];
    myRegistrations.forEach((reg) => {
      const evTitle = reg.event?.title || 'Campus Event';
      items.push({
        id: `reg_${reg.id}`,
        label: reg.status === 'waitlisted' ? `Waitlisted for ${evTitle}` : `Registered for ${evTitle}`,
        detail: `Status: ${reg.status}`,
        time: reg.createdAt || reg.event?.date || '',
        kind: 'reg',
      });
      if (reg.attended && reg.scannedAt) {
        items.push({
          id: `att_${reg.id}`,
          label: `Checked in at ${evTitle}`,
          detail: 'Attendance QR Verified',
          time: reg.scannedAt,
          kind: 'att',
        });
      }
      if (reg.couponRedeemed && reg.couponRedeemedAt) {
        items.push({
          id: `meal_${reg.id}`,
          label: `Meal coupon redeemed (${evTitle})`,
          detail: 'Canteen Partner Verified',
          time: reg.couponRedeemedAt,
          kind: 'meal',
        });
      }
    });
    certificates.forEach((c) => {
      items.push({
        id: `cert_${c.certificateId}`,
        label: `Certificate issued: ${c.eventTitle}`,
        detail: `${c.templateCategory} · ${c.certificateId}`,
        time: c.issuedAt,
        kind: 'cert',
      });
    });
    societyApps.forEach((a) => {
      items.push({
        id: `app_${a.id}`,
        label: `Applied to ${a.societyName}`,
        detail: `${a.roleInterest} · ${a.status}`,
        time: a.reviewedAt || a.createdAt,
        kind: 'soc',
      });
    });
    return items
      .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
      .slice(0, 6);
  }, [myRegistrations, certificates, societyApps]);

  const handleToggleFollow = async (soc: Society) => {
    if (!user) return;
    const isFollowing = followedIds.includes(soc.id);
    const nextFollowed = isFollowing
      ? followedIds.filter((id) => id !== soc.id)
      : [...followedIds, soc.id];
    setFollowedIds(nextFollowed);

    const nextCount = Math.max(0, (soc.followerCount || 0) + (isFollowing ? -1 : 1));
    setSocieties((prev) => prev.map((s) => (s.id === soc.id ? { ...s, followerCount: nextCount } : s)));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        followedSocieties: isFollowing ? arrayRemove(soc.id) : arrayUnion(soc.id),
      });
      await updateDoc(doc(db, 'societies', soc.id), { followerCount: nextCount });
      showToast(isFollowing ? `Unfollowed ${soc.name}` : `Following ${soc.name}`, 'success');
    } catch {
      setFollowedIds(followedIds);
      showToast('Could not update follow status.', 'error');
    }
  };

  const filteredEvents = events.filter(
    (e) =>
      (category === 'All' || e.category === category) &&
      (e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.venue.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 pt-5 sm:pt-6 pb-4 max-w-7xl mx-auto space-y-8 sm:space-y-10">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary mb-1">Student Portal</p>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight break-words">
            Welcome back, {user?.name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-secondary text-sm mt-1">
            Discover campus events, access your attendance QRs, and manage meal coupons.
          </p>
        </div>

        <div className="glass px-4 py-3 rounded-2xl flex items-center gap-3 self-start sm:self-auto shrink-0">
          <div className="w-9 h-9 bg-accent/15 rounded-xl flex items-center justify-center text-accent shrink-0">
            <Award size={18} />
          </div>
          <div>
            <p className="text-[11px] text-secondary font-medium">Campus Points</p>
            <p className="text-base font-bold tabular-nums">{user?.points || 0}</p>
          </div>
        </div>
      </header>

      {/* My Registrations & Tickets */}
      {myRegistrations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 min-w-0 truncate">
              <Calendar size={20} className="text-primary shrink-0" /> My Active Passes
            </h2>
            <span className="text-xs text-secondary tabular-nums shrink-0">{myRegistrations.length} registrations</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="glass rounded-2xl p-3 sm:p-4 min-w-0">
              <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-primary truncate">{myRegistrations.length}</p>
              <p className="text-[11px] sm:text-xs text-secondary mt-0.5 truncate">Registered</p>
            </div>
            <div className="glass rounded-2xl p-3 sm:p-4 min-w-0">
              <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-emerald-500 truncate">
                {myRegistrations.filter((r) => r.attended).length}
              </p>
              <p className="text-[11px] sm:text-xs text-secondary mt-0.5 truncate">Attended</p>
            </div>
            <div className="glass rounded-2xl p-3 sm:p-4 min-w-0">
              <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-accent truncate">
                {myRegistrations.filter((r) => r.couponRedeemed).length}
              </p>
              <p className="text-[11px] sm:text-xs text-secondary mt-0.5 truncate">Meals Claimed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRegistrations.map((reg) => (
              <div key={reg.id} className="glass rounded-2xl p-4 flex flex-col justify-between gap-4 min-w-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={getEventCover(reg.event?.posterUrl, reg.event?.category)}
                    alt={reg.event?.title || 'Event'}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-900"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm truncate">{reg.event?.title || 'Campus Event'}</h4>
                    <p className="text-xs text-secondary mt-0.5 truncate">
                      {reg.event?.date ? format(new Date(reg.event.date), 'MMM d · h:mm a') : 'TBA'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border-subtle pt-3">
                  <span className={reg.attended ? 'text-emerald-500 font-semibold' : 'text-secondary'}>
                    {reg.attended ? 'Checked In' : reg.status === 'pending' ? 'Verification Pending' : 'Ready to Scan'}
                  </span>
                  {reg.event?.hasFoodCoupon && (
                    <span className={reg.couponRedeemed ? 'text-emerald-500 font-semibold' : 'text-accent font-medium'}>
                      {reg.couponRedeemed ? 'Meal Redeemed' : reg.attended ? 'Coupon Unlocked' : 'Coupon Locked'}
                    </span>
                  )}
                </div>

                <Link
                  to={`/events/${reg.event?.slug || reg.eventId}`}
                  className="w-full py-2.5 bg-primary text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <QrCode size={14} /> Open Ticket & QR
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Digital Certificates Preview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Award size={20} className="text-primary shrink-0" /> My Certificates
          </h2>
          <Link to="/certificates" className="text-xs font-semibold text-primary hover:underline">
            View All ({certificates.length})
          </Link>
        </div>

        {certificates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certificates.slice(0, 3).map((cert) => (
              <div key={cert.certificateId} className="glass rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-primary uppercase truncate">
                    {cert.templateCategory}
                  </p>
                  <h4 className="font-bold text-sm truncate mt-0.5">{cert.eventTitle}</h4>
                  <p className="text-xs font-mono text-secondary mt-1 truncate">{cert.certificateId}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cert.status === 'revoked'}
                    onClick={() => downloadCertificatePdf(cert)}
                    className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                  >
                    <Download size={13} /> PDF
                  </button>
                  <Link
                    to={`/verify-certificate/${cert.certificateId}`}
                    className="py-2 px-3 rounded-xl border border-border-subtle text-xs font-semibold hover:bg-secondary/10"
                  >
                    Verify
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-dashed">
            <div className="min-w-0">
              <p className="font-semibold text-sm">Earn verified digital certificates</p>
              <p className="text-xs text-secondary">
                Check in at events with your Attendance QR to unlock verifiable PDF credentials.
              </p>
            </div>
            <Link
              to="/certificates"
              className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-semibold hover:bg-secondary/10 shrink-0 self-start sm:self-auto"
            >
              Open Certificates Hub
            </Link>
          </div>
        )}
      </section>

      {/* Search & Category Tabs */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 glass rounded-xl px-4 flex items-center gap-3">
            <Search size={18} className="text-secondary shrink-0" />
            <input
              type="text"
              placeholder="Search events by title, venue, or topic..."
              className="bg-transparent border-none outline-none w-full h-11 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 p-1 rounded-xl glass overflow-x-auto no-scrollbar">
            {['All', 'Tech', 'Cultural', 'Sports', 'Workshop', 'Academic'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-2 rounded-lg whitespace-nowrap text-xs font-semibold transition-colors ${
                  category === cat ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && category === 'All' && !search && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={18} className="text-accent" /> Recommended for You
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recommendations.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => navigate(`/events/${event.slug || event.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Events */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" /> Upcoming & Live Events
            </h2>
            <Link to="/explore" className="text-xs font-semibold text-primary hover:underline">
              Browse All
            </Link>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => navigate(`/events/${event.slug || event.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center border-dashed">
              <p className="font-semibold text-sm mb-1">No events match your search</p>
              <p className="text-xs text-secondary">Try clearing your category filter or check back soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* Real Campus Societies */}
      {societies.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={18} className="text-primary" /> Campus Societies & Clubs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {societies.map((soc) => {
              const isFollowing = followedIds.includes(soc.id);
              return (
                <div key={soc.id} className="glass rounded-2xl p-5 flex flex-col justify-between gap-4 min-w-0">
                  <Link to={`/society/${soc.id}`} className="flex items-center gap-3 group min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center overflow-hidden shrink-0">
                      {soc.logoUrl ? (
                        <img src={soc.logoUrl} alt={soc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        getInitials(soc.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1">
                        <span className="truncate">{soc.name}</span>
                        <CheckCircle2 size={13} className="text-primary shrink-0" />
                      </h4>
                      <p className="text-xs text-secondary tabular-nums truncate">
                        {soc.category} · {soc.followerCount || 0} followers
                      </p>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleToggleFollow(soc)}
                    className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isFollowing
                        ? 'border border-border-subtle text-secondary hover:text-foreground'
                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow Society'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Central Student Activity Timeline */}
      {activityTimeline.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Clock size={18} className="text-primary" /> Recent Campus Activity
          </h2>
          <div className="glass rounded-2xl divide-y divide-border-subtle">
            {activityTimeline.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {item.kind === 'cert' ? (
                      <Award size={16} />
                    ) : item.kind === 'meal' ? (
                      <Utensils size={16} />
                    ) : item.kind === 'soc' ? (
                      <Building2 size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{item.label}</p>
                    <p className="text-xs text-secondary truncate capitalize">{item.detail}</p>
                  </div>
                </div>
                {item.time && (
                  <span className="text-[11px] text-secondary tabular-nums shrink-0">
                    {item.time.slice(0, 10)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
