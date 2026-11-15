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
} from 'firebase/firestore';
import { db } from '../firebase';
import { Society, Event } from '../types';
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
} from 'lucide-react';
import EventCard from '../components/EventCard';
import { HERO_BANNER_IMAGE, getInitials } from '../lib/media';

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
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwner = Boolean(user && (user.uid === society?.organizerId || isAdmin));

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

  const handleFollow = async () => {
    if (!user || !id || !society) return;
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

  return (
    <div className="w-full pb-4 max-w-4xl mx-auto">
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

      <div className="px-4 sm:px-6 -mt-12 relative z-10">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl glass p-1.5 border border-border-subtle shadow-xl mb-4 bg-surface flex items-center justify-center overflow-hidden">
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

        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 break-words">
              <span className="break-words">{society.name}</span>
              <CheckCircle2 size={20} className="text-primary shrink-0" />
            </h1>
            <p className="text-secondary font-bold text-xs uppercase tracking-wider mt-1">
              {society.category} Society
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleFollow}
            className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
              isFollowing
                ? 'glass border border-border-subtle text-secondary hover:text-foreground'
                : 'bg-primary text-white shadow-lg shadow-primary/25'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow Society'}
          </motion.button>
        </div>

        <div className="flex flex-wrap gap-6 mb-8 text-sm font-semibold tabular-nums">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary shrink-0" />
            <span>{society.followerCount || 0} Followers</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-primary shrink-0" />
            <span>{events.length} Events</span>
          </div>
        </div>

        <div className="glass p-5 sm:p-6 rounded-3xl border border-border-subtle mb-10">
          <h2 className="text-base font-bold mb-2">About</h2>
          <p className="text-secondary text-sm leading-relaxed whitespace-pre-line break-words">
            {society.description}
          </p>

          {(websiteUrl || igUrl || xUrl) && (
            <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border-subtle">
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

        <section>
          <h2 className="text-xl font-bold mb-5">Events by {society.name}</h2>
          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => navigate(`/events/${event.slug || event.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass p-12 rounded-3xl text-center border border-dashed border-border-subtle">
              <p className="text-secondary text-sm">No events published by this society yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
