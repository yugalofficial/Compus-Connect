import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="fixed left-4 z-[140] md:!bottom-4 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>Offline Mode — Cached data active</span>
    </div>
  );
};
