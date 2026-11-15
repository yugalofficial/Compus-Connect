import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Event, Registration } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getEventCover } from '../lib/media';

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'all' | 'mine'>('all');

  useEffect(() => {
    const unsubEvents = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        const allEvents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
        allEvents.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
        setEvents(allEvents);
        setLoading(false);
      },
      (err) => {
        console.error('Fetch calendar events error:', err);
        setLoading(false);
      }
    );

    let unsubRegs: (() => void) | undefined;
    if (user) {
      unsubRegs = onSnapshot(
        query(collection(db, 'registrations'), where('userId', '==', user.uid)),
        (regSnapshot) => {
          setMyRegistrations(regSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Registration)));
        },
        (err) => console.error('Fetch calendar registrations error:', err)
      );
    } else {
      setMyRegistrations([]);
    }

    return () => {
      unsubEvents();
      if (unsubRegs) unsubRegs();
    };
  }, [user?.uid]);

  const monthStart = startOfMonth(currentMonth);
  const leadingEmptyDays = monthStart.getDay();
  const days = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(currentMonth),
  });

  const myEventIds = myRegistrations.map((r) => r.eventId);
  const filteredEvents = view === 'all' ? events : events.filter((e) => myEventIds.includes(e.id));

  const selectedDateEvents = filteredEvents.filter((event) => {
    if (!event.date) return false;
    return isSameDay(new Date(event.date), selectedDate);
  });

  const hasEvent = (date: Date) =>
    filteredEvents.some((event) => event.date && isSameDay(new Date(event.date), date));
  const hasMyEvent = (date: Date) =>
    events.some((event) => event.date && isSameDay(new Date(event.date), date) && myEventIds.includes(event.id));

  return (
    <div className="w-full px-4 sm:px-6 pt-5 sm:pt-6 pb-4 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Campus Calendar</h1>
          <p className="text-secondary text-sm mt-1">Track upcoming events and your registered schedule.</p>
        </div>

        <div className="flex p-1 glass rounded-xl self-start sm:self-auto shrink-0">
          <button
            onClick={() => setView('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              view === 'all' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setView('mine')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              view === 'mine' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
            }`}
          >
            My Schedule
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Month Grid */}
        <div className="lg:col-span-7 glass p-4 sm:p-6 rounded-2xl min-w-0">
          <div className="flex justify-between items-center mb-5 sm:mb-6">
            <h2 className="text-base sm:text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                aria-label="Previous month"
                className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-foreground"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                aria-label="Next month"
                className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-foreground"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-[10px] sm:text-[11px] font-semibold text-secondary py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: leadingEmptyDays }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodaysDate = isToday(day);
              const hasEv = hasEvent(day);
              const hasMyEv = hasMyEvent(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative transition-colors tabular-nums ${
                    isSelected
                      ? 'bg-primary text-white font-bold shadow-sm'
                      : isTodaysDate
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'hover:bg-secondary/10 font-medium'
                  }`}
                >
                  <span className="text-xs sm:text-sm">{format(day, 'd')}</span>
                  {(hasEv || hasMyEv) && (
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : hasMyEv ? 'bg-primary' : 'bg-secondary/50'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Schedule */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">
              {isSameDay(selectedDate, new Date()) ? "Today's Events" : format(selectedDate, 'EEEE, MMM d')}
            </h3>
            <span className="text-xs text-secondary tabular-nums">{selectedDateEvents.length} scheduled</span>
          </div>

          {loading ? (
            <div className="glass h-40 rounded-2xl animate-pulse" />
          ) : selectedDateEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDateEvents.map((event) => {
                const isRegistered = myEventIds.includes(event.id);
                return (
                  <Link
                    key={event.id}
                    to={`/events/${event.slug || event.id}`}
                    className="glass p-4 rounded-2xl flex gap-4 hover:border-primary/40 transition-colors"
                  >
                    <img
                      src={getEventCover(event.posterUrl, event.category)}
                      alt={event.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-900"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-secondary mb-1">
                        <span className="text-primary font-semibold">{event.category}</span>
                        {isRegistered && (
                          <span className="text-emerald-500 font-semibold flex items-center gap-1">
                            · <CheckCircle2 size={12} /> Registered
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm truncate mb-1.5">{event.title}</h4>
                      <div className="flex flex-wrap gap-3 text-xs text-secondary">
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock size={12} /> {format(new Date(event.date), 'h:mm a')}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={12} /> {event.venue}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="glass p-10 rounded-2xl text-center border-dashed">
              <CalendarIcon size={28} className="mx-auto text-secondary/40 mb-3" />
              <p className="text-sm font-semibold mb-1">No events on this date</p>
              <button
                onClick={() => navigate('/explore')}
                className="text-xs font-semibold text-primary hover:underline mt-1"
              >
                Explore all upcoming events
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
