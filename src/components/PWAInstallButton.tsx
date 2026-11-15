import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, X, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'ios'>(
    isIOS ? 'ios' : 'android'
  );

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className={`glass rounded-2xl p-4 border border-emerald-500/30 flex items-center gap-3 ${className}`}>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-bold">Campus Connect App Installed</p>
            <p className="text-xs text-secondary">Running in full-screen app mode on your device.</p>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setActivePlatformTab(isIOS ? 'ios' : 'android');
    setShowGuideModal(true);
  };

  const buttonLabel = isInstallable
    ? 'Install App'
    : isIOS
      ? 'Install iOS App'
      : isAndroid
        ? 'Install Android App'
        : 'Install App';

  const modal = showGuideModal
    ? createPortal(
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGuideModal(false)}
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
                  <h3 className="text-lg font-extrabold tracking-tight">Install Campus Connect</h3>
                  <p className="text-xs text-secondary">Get the native-like app on Android & iOS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="w-9 h-9 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-foreground shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex p-1 rounded-xl bg-background/70 border border-border-subtle mb-4">
              <button
                type="button"
                onClick={() => setActivePlatformTab('android')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activePlatformTab === 'android'
                    ? 'bg-primary text-white'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                Android (APK / WebApp)
              </button>
              <button
                type="button"
                onClick={() => setActivePlatformTab('ios')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activePlatformTab === 'ios'
                    ? 'bg-primary text-white'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                iOS (iPhone / iPad)
              </button>
            </div>

            {activePlatformTab === 'android' ? (
              <div className="space-y-3 text-sm">
                {isInstallable ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setShowGuideModal(false);
                    }}
                    className="w-full py-3 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:opacity-90"
                  >
                    <Download size={16} />
                    One-Tap Install Android App Now
                  </button>
                ) : (
                  <p className="text-xs text-secondary leading-relaxed">
                    Open Campus Connect directly in <strong>Google Chrome</strong> (not inside an in-app browser) to install it on your Android home screen & app drawer:
                  </p>
                )}

                <div className="space-y-2.5 rounded-2xl bg-background/60 border border-border-subtle p-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      Tap the <MoreVertical size={14} className="inline mx-0.5" /> <strong>Menu</strong> button at the top-right of Chrome.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>) and confirm <strong>Install</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <p>
                      Android packages and installs Campus Connect to your app drawer with offline support and full-screen camera QR scanning.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-secondary leading-relaxed">
                  Open Campus Connect in <strong>Safari</strong> on iPhone or iPad to install it to your Home Screen:
                </p>
                <div className="space-y-2.5 rounded-2xl bg-background/60 border border-border-subtle p-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      Tap the <Share size={14} className="inline mx-0.5 text-primary" /> <strong>Share</strong> icon in the Safari toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      Scroll down and tap <PlusSquare size={14} className="inline mx-0.5 text-primary" /> <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <p>
                      Tap <strong>Add</strong> in the top-right corner to launch Campus Connect like a native iOS app.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl border border-border-subtle text-sm font-semibold hover:bg-secondary/10 transition-colors"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  if (variant === 'card') {
    return (
      <>
        <div
          className={`glass rounded-2xl p-4 sm:p-5 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Smartphone size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base">Install Campus Connect Mobile App</h4>
              <p className="text-xs text-secondary">
                Fast full-screen launch, offline pass access & QR scanning on Android and iOS.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shrink-0"
          >
            <Download size={16} />
            {buttonLabel}
          </button>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Install Campus Connect App"
        className={`h-10 px-3 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${className}`}
      >
        <Download size={15} />
        <span className="hidden sm:inline">{buttonLabel}</span>
        <span className="sm:hidden">Install</span>
      </button>
      {modal}
    </>
  );
};
