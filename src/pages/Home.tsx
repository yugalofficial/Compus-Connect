import React, { useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Event, Society } from '../types';
import EventCard from '../components/EventCard';
import { Search, Sparkles, Calendar, Award, Users, QrCode, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { Link, useNavigate } from 'react-router-dom';
import { getEventRecommendations } from '../services/aiService';
import { format } from 'date-fns';
import { getEventCover, getInitials } from '../lib/media';

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

  useEffect(() => {
    setFollowedIds(user?.followedSocieties || []);
  }, [user?.followedSocieties]);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-xs font-semibold text-primary mb-1">Student Portal</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-secondary text-sm mt-1">
            Discover campus events, access your attendance QRs, and manage meal coupons.
          </p>
        </div>

        <div className="glass px-4 py-3 rounded-2xl flex items-center gap-3 self-start sm:self-auto">
          <div className="w-9 h-9 bg-accent/15 rounded-xl flex items-center justify-center text-accent">
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar size={20} className="text-primary" /> My Active Passes
            </h2>
            <span className="text-xs text-secondary tabular-nums">{myRegistrations.length} registrations</span>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="glass rounded-2xl p-4">
              <p className="text-2xl font-extrabold tabular-nums text-primary">{myRegistrations.length}</p>
              <p className="text-xs text-secondary mt-0.5">Registered</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-2xl font-extrabold tabular-nums text-emerald-500">
                {myRegistrations.filter((r) => r.attended).length}
              </p>
              <p className="text-xs text-secondary mt-0.5">Attended</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-2xl font-extrabold tabular-nums text-accent">
                {myRegistrations.filter((r) => r.couponRedeemed).length}
              </p>
              <p className="text-xs text-secondary mt-0.5">Meals Claimed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRegistrations.map((reg) => (
              <div key={reg.id} className="glass rounded-2xl p-4 flex flex-col justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={getEventCover(reg.event?.posterUrl, reg.event?.category)}
                    alt={reg.event?.title || 'Event'}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-900"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm truncate">{reg.event?.title || 'Campus Event'}</h4>
                    <p className="text-xs text-secondary mt-0.5">
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
                <div key={soc.id} className="glass rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <Link to={`/society/${soc.id}`} className="flex items-center gap-3 group">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center overflow-hidden shrink-0">
                      {soc.logoUrl ? (
                        <img src={soc.logoUrl} alt={soc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        getInitials(soc.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1">
                        {soc.name}
                        <CheckCircle2 size={13} className="text-primary shrink-0" />
                      </h4>
                      <p className="text-xs text-secondary tabular-nums">
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
    </div>
  );
}
