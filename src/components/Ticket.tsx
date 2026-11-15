import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'motion/react';
import { Ticket as TicketIcon, QrCode, MapPin, Calendar, Clock } from 'lucide-react';
import { Registration, Event } from '../types';
import { formatDate, formatTime } from '../lib/utils';

interface TicketProps {
  registration: Registration;
  event: Event;
}

export default function Ticket({ registration, event }: TicketProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-sm mx-auto"
    >
      <div className="glass rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Ticket Top */}
        <div className="p-5 sm:p-8 border-b-2 border-dashed border-border-subtle relative">
          <div className="flex justify-between items-start gap-3 mb-5">
            <div className="bg-primary/20 p-3 rounded-2xl text-primary shrink-0">
              <TicketIcon size={24} />
            </div>
            <div className="text-right min-w-0">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-wider">Ticket ID</p>
              <p className="text-xs font-mono font-bold truncate">#{registration.id.slice(0, 8)}</p>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black mb-4 break-words">{event.title}</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm min-w-0">
              <Calendar size={16} className="text-primary shrink-0" />
              <span className="truncate">{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm min-w-0">
              <Clock size={16} className="text-primary shrink-0" />
              <span className="truncate">{formatTime(event.date)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm min-w-0">
              <MapPin size={16} className="text-primary shrink-0" />
              <span className="line-clamp-1">{event.venue}</span>
            </div>
          </div>

          {/* Ticket Notches */}
          <div className="hidden sm:block absolute -bottom-4 -left-4 w-8 h-8 bg-background rounded-full z-10" />
          <div className="hidden sm:block absolute -bottom-4 -right-4 w-8 h-8 bg-background rounded-full z-10" />
        </div>

        {/* Ticket Bottom (QR) */}
        <div className="p-5 sm:p-8 bg-background/40 flex flex-col items-center">
          <div className="bg-white p-3.5 sm:p-4 rounded-3xl mb-4 shadow-inner max-w-full">
            <QRCodeSVG
              value={registration.id}
              size={168}
              level="H"
              includeMargin={false}
              className="w-full max-w-[168px] h-auto"
            />
          </div>
          <p className="text-xs text-secondary font-medium mb-5 text-center">Scan at the venue for attendance</p>
          
          <div className="w-full h-px bg-border-subtle mb-5" />
          
          <div className="flex items-center gap-2 text-primary font-bold">
            <QrCode size={20} />
            <span>Attendance QR</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
