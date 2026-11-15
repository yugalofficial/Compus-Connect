import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  BeforeInstallPromptEvent,
  clearCachedDeferredPrompt,
  getCachedDeferredPrompt,
} from '../hooks/usePWAInstall';

const DISMISS_STORAGE_KEY = 'cc_pwa_banner_dismissed_at';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export const BeforeInstallPromptBanner: React.FC = () => {
  const { user, isApproved } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY) || '0');
      const isRecentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
      setDismissed(isRecentlyDismissed);
    } catch {
      setDismissed(false);
    }

    const existingPrompt = getCachedDeferredPrompt();
    if (existingPrompt) {
      setDeferredPrompt(existingPrompt);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      clearCachedDeferredPrompt();
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstructionsModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  };

  const handleInstallAction = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        clearCachedDeferredPrompt();
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return;
    }
    setShowInstructionsModal(true);
  };

  const shouldShowBanner = !isInstalled && !dismissed && (!!deferredPrompt || isIOS || isAndroid);

  if (isInstalled || (!shouldShowBanner && !showInstructionsModal)) {
    return null;
  }

  const hasBottomNav = Boolean(user && isApproved);

  return (
    <>
      <AnimatePresence>
        {shouldShowBanner && (
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22 }}
            role="region"
            aria-label="Install Campus Connect app"
            style={{
              bottom: hasBottomNav
                ? 'calc(4.75rem + env(safe-area-inset-bottom, 0px))'
                : 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
            className="fixed inset-x-3 sm:inset-x-auto sm:right-5 sm:w-[400px] md:!bottom-5 z-[145]"
          >
            <div className="glass rounded-2xl p-3.5 sm:p-4 border border-primary/35 shadow-2xl flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold leading-tight truncate">
                  Install Campus Connect
                </p>
                <p className="text-[11px] sm:text-xs text-secondary mt-0.5 leading-snug">
                  {deferredPrompt
                    ? 'Install as an app for offline passes & instant QR scanning.'
                    : isIOS
                      ? 'Add to your iPhone/iPad Home Screen for full-screen access.'
                      : 'Install on Android for home-screen access & offline support.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleInstallAction}
                className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0"
              >
                <Download size={14} />
                <span>{deferredPrompt ? 'Install' : 'How to'}</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss install banner"
                className="w-8 h-8 rounded-lg text-secondary hover:text-foreground hover:bg-secondary/10 flex items-center justify-center shrink-0 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {showInstructionsModal &&
        createPortal(
          <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowInstructionsModal(false)}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass rounded-3xl p-6 border border-border-subtle shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Smartphone size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight">
                      {isIOS ? 'Install on iOS (Safari)' : 'Install on Android'}
                    </h3>
                    <p className="text-xs text-secondary">
                      Add Campus Connect directly to your home screen
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(false)}
                  aria-label="Close install dialog"
                  className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-foreground shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-2.5 rounded-2xl bg-background/60 border border-border-subtle p-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      Tap the <Share size={14} className="inline mx-0.5 text-primary" />{' '}
                      <strong>Share</strong> button in Safari&apos;s toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      Scroll and tap{' '}
                      <PlusSquare size={14} className="inline mx-0.5 text-primary" />{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <p>
                      Tap <strong>Add</strong> to launch Campus Connect full-screen from your Home
                      Screen.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 rounded-2xl bg-background/60 border border-border-subtle p-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      Open in <strong>Google Chrome</strong> and tap the{' '}
                      <MoreVertical size={14} className="inline mx-0.5" /> <strong>Menu</strong>{' '}
                      icon.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      Select <strong>Install app</strong> (or <strong>Add to Home screen</strong>)
                      and confirm.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
