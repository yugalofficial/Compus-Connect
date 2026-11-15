import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../context/AuthContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { user, isApproved } = useAuth();

  if (isOnline) return null;

  const hasBottomNav = Boolean(user && isApproved);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        bottom: hasBottomNav
          ? 'calc(4.75rem + env(safe-area-inset-bottom, 0px))'
          : 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      className="fixed left-3 right-3 sm:right-auto sm:left-4 sm:max-w-xs z-[140] md:!bottom-4 flex items-center justify-center sm:justify-start gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff size={14} className="shrink-0" />
      <span className="truncate">Offline Mode — Cached data active</span>
    </div>
  );
};
