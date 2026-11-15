import React from 'react';
import { MapPin, Calendar, Users, ArrowRight } from 'lucide-react';
import { Event } from '../types';
import { format } from 'date-fns';
import { getEventCover } from '../lib/media';

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  compact?: boolean;
}

export default function EventCard({ event, onClick, compact }: EventCardProps) {
  const isPaid = event.type === 'paid';
  const coverSrc = getEventCover(event.posterUrl, event.category);

  let formattedDate = 'TBA';
  try {
    if (event.date) formattedDate = format(new Date(event.date), 'MMM d, yyyy · h:mm a');
  } catch {
    formattedDate = 'TBA';
  }

  return (
    <article
      onClick={onClick}
      className={`glass rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-200 hover:-translate-y-1 flex flex-col h-full ${
        compact ? 'w-full' : ''
      }`}
    >
      <div className="aspect-[16/10] relative overflow-hidden bg-slate-900">
        <img
          src={coverSrc}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-medium text-white">
          <span>
            {event.category}
            {event.status === 'ongoing' ? ' · Live now' : ''}
          </span>
          <span className="tabular-nums font-semibold">
            {isPaid ? `₹${event.fee || 0}` : 'Free'}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          <div className="space-y-1.5 text-xs text-secondary">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-primary shrink-0" />
              <span className="truncate">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-primary shrink-0" />
              <span className="line-clamp-1">{event.venue}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between">
          <span className="text-xs text-secondary flex items-center gap-1.5 tabular-nums">
            <Users size={14} className="text-primary" />
            {event.registeredCount || 0} / {event.registrationLimit} registered
          </span>
          <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            View
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}
