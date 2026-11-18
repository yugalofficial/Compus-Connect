import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Event } from '../types';
import EventCard from '../components/EventCard';
import PublicNavbar from '../components/PublicNavbar';
import { Search, SlidersHorizontal, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocumentSeo } from '../lib/seo';

const CATEGORIES = ['All', 'Tech', 'Cultural', 'Sports', 'Workshop', 'Academic'];
const STATUSES = ['All', 'upcoming', 'ongoing', 'completed'];

export default function Explore() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  useDocumentSeo({
    title: 'Explore Campus Events | Campus Connect',
    description:
      'Browse upcoming technical fests, workshops, cultural nights, and sports tournaments on Campus Connect with instant registration and QR tickets.',
    canonicalPath: 'explore',
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
        list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        console.error('Fetch events error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filteredEvents = events.filter((event) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      event.title.toLowerCase().includes(q) ||
      event.description.toLowerCase().includes(q) ||
      event.venue.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || event.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <PublicNavbar />

      <div className="w-full px-4 sm:px-6 pt-5 sm:pt-6 pb-8 max-w-7xl mx-auto space-y-6">
        <header>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
            Live Campus Directory
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">Explore Events</h1>

          <div className="flex gap-2.5 sm:gap-3">
            <div className="flex-1 min-w-0 glass rounded-xl px-3.5 sm:px-4 flex items-center gap-2.5 sm:gap-3">
              <Search className="text-secondary w-4 h-4 shrink-0" />
              <input
                type="text"
                placeholder="Search events, venues, or categories..."
                className="bg-transparent w-full min-w-0 h-11 text-sm focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Toggle status filters"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                showFilters ? 'bg-primary text-white' : 'glass text-secondary hover:text-foreground'
              }`}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </header>

        {showFilters && (
          <div className="glass p-4 rounded-2xl flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-secondary mr-2">Status:</span>
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  selectedStatus === status ? 'bg-primary text-white' : 'bg-background text-secondary hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1.5 p-1 glass rounded-xl overflow-x-auto no-scrollbar max-w-full sm:w-fit">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === cat ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass h-72 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((event) => {
              const isFull = (event.registeredCount || 0) >= event.registrationLimit;
              return (
                <div key={event.id} className="flex flex-col space-y-1.5">
                  <EventCard
                    event={event}
                    onClick={() => navigate(`/events/${event.slug || event.id}`)}
                  />
                  {(event.isCancelled || isFull || event.registrationDeadline) && (
                    <div className="px-2 flex items-center justify-between text-[11px] text-secondary">
                      {event.isCancelled ? (
                        <span className="font-semibold text-red-500">Event Cancelled</span>
                      ) : isFull ? (
                        <span className="font-semibold text-amber-500">
                          {event.allowWaitlist ? 'Full · Waitlist Open' : 'Registrations Full'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          Deadline: {event.registrationDeadline?.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-2xl p-16 text-center border-dashed">
            <p className="font-semibold text-sm mb-1">No events found</p>
            <p className="text-xs text-secondary">Try adjusting your search query or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
