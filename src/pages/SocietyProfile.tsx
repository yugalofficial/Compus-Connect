import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  doc,
  collection,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  setDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Society, Event, SocietyApplication } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { motion } from 'motion/react';
import {
  Users,
  Calendar,
  ArrowLeft,
  Globe,
  Instagram,
  Twitter,
  CheckCircle2,
  Edit,
  Megaphone,
  UserPlus,
  GraduationCap,
} from 'lucide-react';
import EventCard from '../components/EventCard';
import PublicNavbar from '../components/PublicNavbar';
import { HERO_BANNER_IMAGE, getInitials } from '../lib/media';
import { useDocumentSeo } from '../lib/seo';

function normalizeSocialUrl(value?: string, platform?: 'instagram' | 'twitter' | 'website'): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const handle = trimmed.replace(/^@/, '');
  if (platform === 'instagram') return `https://instagram.com/${handle}`;
  if (platform === 'twitter') return `https://x.com/${handle}`;
  return `https://${trimmed}`;
}

export default function SocietyProfile() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [society, setSociety] = useState<Society | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [applications, setApplications] = useState<SocietyApplication[]>([]);
  const [myApplication, setMyApplication] = useState<SocietyApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'applications'>('overview');

  // Membership application form
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [roleInterest, setRoleInterest] = useState('General Member');
  const [statement, setStatement] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // Announcement composer
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  const isOwner = Boolean(user && (user.uid === society?.organizerId || isAdmin));

  useDocumentSeo({
    title: society ? `${society.name} | Campus Connect` : 'Society Profile | Campus Connect',
    description:
      society?.description?.slice(0, 155) ||
      'Explore student clubs, events, announcements, and membership applications on Campus Connect.',
    canonicalPath: id ? `society/${id}` : 'societies',
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    setIsFollowing(user?.followedSocieties?.includes(id) || false);

    let unsubEvents: (() => void) | undefined;
    let activeOrgId = '';

    const unsubSoc = onSnapshot(
      doc(db, 'societies', id),
      (socDoc) => {
        if (!socDoc.exists()) {
          setSociety(null);
          setLoading(false);
          return;
        }
        const socData = { id: socDoc.id, ...socDoc.data() } as Society;
        setSociety(socData);
        setLoading(false);

        if (socData.organizerId && socData.organizerId !== activeOrgId) {
          activeOrgId = socData.organizerId;
          if (unsubEvents) unsubEvents();
          const eventsQ = query(
            collection(db, 'events'),
            where('organizerId', '==', socData.organizerId)
          );
          unsubEvents = onSnapshot(eventsQ, (eventsSnapshot) => {
            const list = eventsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
            list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setEvents(list);
          });
        }
      },
      (err) => {
        console.error('Fetch society error:', err);
        showToast('Failed to load society details.', 'error');
        setLoading(false);
      }
    );

    return () => {
      unsubSoc();
      if (unsubEvents) unsubEvents();
    };
  }, [id, user?.uid, user?.followedSocieties]);

  // Listen to membership applications (student's own or owner's queue)
  useEffect(() => {
    if (!id || !user) {
      setApplications([]);
      setMyApplication(null);
      return;
    }

    const myAppId = `${user.uid}_${id}`;
    const unsubMine = onSnapshot(
      doc(db, 'society_applications', myAppId),
      (snap) => {
        setMyApplication(
          snap.exists() ? { id: snap.id, ...(snap.data() as Omit<SocietyApplication, 'id'>) } : null
        );
      },
      () => setMyApplication(null)
    );

    let unsubAll: (() => void) | undefined;
    if (isOwner) {
      unsubAll = onSnapshot(
        query(collection(db, 'society_applications'), where('societyId', '==', id)),
        (snap) => {
          setApplications(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SocietyApplication, 'id'>),
            }))
          );
        },
        () => {}
      );
    }

    return () => {
      unsubMine();
      if (unsubAll) unsubAll();
    };
  }, [id, user?.uid, isOwner]);

  const handleFollow = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!id || !society) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const socRef = doc(db, 'societies', id);
      const nextCount = isFollowing
        ? Math.max(0, (society.followerCount || 1) - 1)
        : (society.followerCount || 0) + 1;

      await updateDoc(userRef, {
        followedSocieties: isFollowing ? arrayRemove(id) : arrayUnion(id),
      });
      await updateDoc(socRef, { followerCount: nextCount });

      setIsFollowing(!isFollowing);
      setSociety({ ...society, followerCount: nextCount });
      showToast(
        isFollowing ? `Unfollowed ${society.name}` : `Following ${society.name}`,
        'success'
      );
    } catch (err) {
      console.error('Follow error:', err);
      showToast('Failed to update follow status.', 'error');
    }
  };

  const handleApplyMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !society || !id) return;
    setSubmittingApp(true);
    try {
      const appId = `${user.uid}_${id}`;
      const payload: Omit<SocietyApplication, 'id'> = {
        societyId: id,
        societyName: society.name,
        organizerId: society.organizerId,
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        roleInterest: roleInterest.trim() || 'General Member',
        statement: statement.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'society_applications', appId), payload);
      await addDoc(collection(db, 'notifications'), {
        userId: society.organizerId,
        title: `New Society Application — ${society.name}`,
        message: `${user.name} applied to join as ${payload.roleInterest}.`,
        type: 'society_application',
        read: false,
        createdAt: new Date().toISOString(),
      });
      showToast('Membership application submitted!', 'success');
      setShowApplyModal(false);
      setStatement('');
    } catch (err) {
      console.error('Apply error:', err);
      showToast('Could not submit application.', 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleReviewApplication = async (
    app: SocietyApplication,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await updateDoc(doc(db, 'society_applications', app.id), {
        status,
        reviewedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: app.userId,
        title: `Society Application ${status === 'approved' ? 'Approved' : 'Updated'}`,
        message: `Your application for ${app.societyName} (${app.roleInterest}) has been ${status}.`,
        type: 'society_application',
        read: false,
        createdAt: new Date().toISOString(),
      });
      showToast(`Application ${status}.`, 'success');
    } catch {
      showToast('Failed to update application status.', 'error');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!society || !id || !annTitle.trim() || !annMsg.trim()) return;
    setPostingAnn(true);
    try {
      const newAnn = {
        id: `ann_${Date.now()}`,
        title: annTitle.trim(),
        message: annMsg.trim(),
        createdAt: new Date().toISOString(),
      };
      const updated = [newAnn, ...(society.announcements || [])].slice(0, 12);
      await updateDoc(doc(db, 'societies', id), { announcements: updated });
      setAnnTitle('');
      setAnnMsg('');
      showToast('Announcement published to society feed.', 'success');
    } catch {
      showToast('Could not publish announcement.', 'error');
    } finally {
      setPostingAnn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!society) {
    return (
      <div className="p-10 text-center">
        <p className="text-lg font-bold mb-2">Society not found</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const websiteUrl = normalizeSocialUrl(society.socials?.website, 'website');
  const igUrl = normalizeSocialUrl(society.socials?.instagram, 'instagram');
  const xUrl = normalizeSocialUrl(society.socials?.twitter, 'twitter');

  const upcomingEvents = events.filter((e) => e.status !== 'completed');
  const pastEvents = events.filter((e) => e.status === 'completed');

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <PublicNavbar />

      <div className="w-full pb-10 max-w-4xl mx-auto">
        <div className="relative h-48 sm:h-64 bg-primary/15 sm:rounded-b-3xl overflow-hidden">
          <img
            src={society.bannerUrl || HERO_BANNER_IMAGE}
            className="w-full h-full object-cover"
            alt={society.name}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
          <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            {isOwner && (
              <Link
                to={`/edit-society/${id}`}
                className="w-10 h-10 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center"
                aria-label="Edit Society"
              >
                <Edit size={18} />
              </Link>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 -mt-12 relative z-10 space-y-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl glass p-1.5 border border-border-subtle shadow-xl bg-surface flex items-center justify-center overflow-hidden">
            {society.logoUrl ? (
              <img
                src={society.logoUrl}
                className="w-full h-full object-cover rounded-2xl"
                alt={society.name}
              />
            ) : (
              <span className="text-2xl font-extrabold text-primary">{getInitials(society.name)}</span>
            )}
          </div>

          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 break-words">
                <span className="break-words">{society.name}</span>
                <CheckCircle2 size={20} className="text-primary shrink-0" />
              </h1>
              <p className="text-secondary font-bold text-xs uppercase tracking-wider mt-1">
                {society.category} Society
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {user && !isOwner && (
                <button
                  type="button"
                  disabled={Boolean(myApplication)}
                  onClick={() => setShowApplyModal(true)}
                  className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-secondary/10 disabled:opacity-60"
                >
                  <UserPlus size={15} />
                  {myApplication
                    ? `Applied (${myApplication.status})`
                    : 'Apply to Join'}
                </button>
              )}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleFollow}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                  isFollowing
                    ? 'glass border border-border-subtle text-secondary hover:text-foreground'
                    : 'bg-primary text-white shadow-lg shadow-primary/25'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow Society'}
              </motion.button>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm font-semibold tabular-nums">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary shrink-0" />
              <span>{society.followerCount || 0} Followers</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary shrink-0" />
              <span>{events.length} Hosted Events</span>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1.5 p-1 glass rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                activeTab === 'overview' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
              }`}
            >
              Overview & Announcements
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                activeTab === 'events' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
              }`}
            >
              Event Calendar ({events.length})
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('applications')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                  activeTab === 'applications' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                Applications ({applications.length})
              </button>
            )}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle space-y-5">
                <div>
                  <h2 className="text-base font-bold mb-2">About</h2>
                  <p className="text-secondary text-sm leading-relaxed whitespace-pre-line break-words">
                    {society.description}
                  </p>
                </div>

                {society.facultyCoordinator?.name && (
                  <div className="p-4 rounded-2xl bg-background/60 border border-border-subtle flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <GraduationCap size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-secondary uppercase">Faculty Coordinator</p>
                      <p className="text-sm font-bold truncate">{society.facultyCoordinator.name}</p>
                      {(society.facultyCoordinator.department || society.facultyCoordinator.email) && (
                        <p className="text-xs text-secondary truncate">
                          {[society.facultyCoordinator.department, society.facultyCoordinator.email]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {society.coreTeam && society.coreTeam.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-bold">Core Leadership Team</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {society.coreTeam.map((m, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-background/60 border border-border-subtle">
                          <p className="font-bold text-xs sm:text-sm">{m.name}</p>
                          <p className="text-xs text-secondary">{m.role}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(websiteUrl || igUrl || xUrl) && (
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-border-subtle">
                    {websiteUrl && (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 glass border border-border-subtle rounded-xl flex items-center gap-2 text-xs font-semibold text-secondary hover:text-primary transition-colors"
                      >
                        <Globe size={15} />
                        Website
                      </a>
                    )}
                    {igUrl && (
                      <a
                        href={igUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 glass border border-border-subtle rounded-xl flex items-center gap-2 text-xs font-semibold text-secondary hover:text-primary transition-colors"
                      >
                        <Instagram size={15} />
                        Instagram
                      </a>
                    )}
                    {xUrl && (
                      <a
                        href={xUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 glass border border-border-subtle rounded-xl flex items-center gap-2 text-xs font-semibold text-secondary hover:text-primary transition-colors"
                      >
                        <Twitter size={15} />
                        X / Twitter
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Society Announcements */}
              <div className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle space-y-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Megaphone size={17} className="text-primary" />
                  Society Announcements
                </h2>

                {isOwner && (
                  <form onSubmit={handlePostAnnouncement} className="p-4 rounded-2xl bg-background/60 border border-border-subtle space-y-2.5">
                    <input
                      type="text"
                      required
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      placeholder="Announcement headline (e.g. Auditions Open)"
                      className="w-full h-9 px-3 rounded-lg bg-surface border border-border-subtle text-xs font-semibold"
                    />
                    <textarea
                      required
                      rows={2}
                      value={annMsg}
                      onChange={(e) => setAnnMsg(e.target.value)}
                      placeholder="Share details with campus students..."
                      className="w-full p-3 rounded-lg bg-surface border border-border-subtle text-xs"
                    />
                    <button
                      type="submit"
                      disabled={postingAnn}
                      className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      {postingAnn ? 'Publishing...' : 'Post Announcement'}
                    </button>
                  </form>
                )}

                {society.announcements && society.announcements.length > 0 ? (
                  <div className="space-y-3">
                    {society.announcements.map((a) => (
                      <div key={a.id} className="p-4 rounded-2xl bg-background/60 border border-border-subtle">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-bold text-sm">{a.title}</h3>
                          <span className="text-[11px] text-secondary tabular-nums">
                            {a.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">{a.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-secondary">No announcements posted yet.</p>
                )}
              </div>

              {society.galleryUrls && society.galleryUrls.length > 0 && (
                <div className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle space-y-3">
                  <h2 className="text-base font-bold">Highlight Gallery</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {society.galleryUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`${society.name} highlight ${idx + 1}`}
                        className="aspect-video w-full rounded-xl object-cover border border-border-subtle"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-6">
              {upcomingEvents.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-lg font-bold">Upcoming & Live Events</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => navigate(`/events/${event.slug || event.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {pastEvents.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-secondary">Past Events</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {pastEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => navigate(`/events/${event.slug || event.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {events.length === 0 && (
                <div className="glass p-12 rounded-3xl text-center border border-dashed border-border-subtle">
                  <p className="text-secondary text-sm">No events published by this society yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && isOwner && (
            <div className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle space-y-4">
              <h2 className="text-lg font-bold">Student Membership Applications</h2>
              {applications.length === 0 ? (
                <p className="text-sm text-secondary py-6 text-center">No membership applications submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 rounded-2xl bg-background/60 border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{app.userName}</p>
                        <p className="text-xs text-secondary truncate">
                          {app.userEmail} · Interest: {app.roleInterest}
                        </p>
                        {app.statement && (
                          <p className="text-xs text-foreground mt-1">{app.statement}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {app.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReviewApplication(app, 'approved')}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:opacity-90"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReviewApplication(app, 'rejected')}
                              className="px-3.5 py-2 rounded-xl border border-red-500/30 text-red-500 text-xs font-bold hover:bg-red-500/10"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span
                            className={`text-xs font-bold capitalize ${
                              app.status === 'approved' ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {app.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Membership Application Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div
            onClick={() => setShowApplyModal(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <form
            onSubmit={handleApplyMembership}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass rounded-3xl p-6 shadow-2xl border border-border-subtle space-y-4"
          >
            <h2 className="text-lg font-bold">Apply to Join {society.name}</h2>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Role / Interest</label>
              <input
                type="text"
                required
                value={roleInterest}
                onChange={(e) => setRoleInterest(e.target.value)}
                placeholder="e.g. Technical Volunteer, Design, General Member"
                className="w-full h-10 px-3 rounded-xl bg-background/60 border border-border-subtle text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                Short Note (Optional)
              </label>
              <textarea
                rows={3}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Share your skills or motivation..."
                className="w-full p-3 rounded-xl bg-background/60 border border-border-subtle text-sm"
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingApp}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
              >
                {submittingApp ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
