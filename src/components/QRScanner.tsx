import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { motion } from 'motion/react';
import { X, Camera, RefreshCw, AlertCircle, Keyboard } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export default function QRScanner({ onScan, onClose, title = 'Scan QR Code' }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const scanLockedRef = useRef(false);
  const lastScannedRef = useRef<{ qrId: string; time: number }>({ qrId: '', time: 0 });
  const containerId = 'qr-reader-container';

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopCamera = useCallback(async () => {
    if (qrRef.current) {
      try {
        if (qrRef.current.isScanning) {
          await qrRef.current.stop();
        }
        qrRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
    }
    setIsScanning(false);
  }, []);

  const handleDecodedScan = useCallback(
    (rawText: string, shouldStopCamera: boolean) => {
      const qrId = rawText.trim();
      const now = Date.now();
      if (
        !qrId ||
        scanLockedRef.current ||
        (lastScannedRef.current.qrId === qrId && now - lastScannedRef.current.time < 3000)
      ) {
        return;
      }
      scanLockedRef.current = true;
      lastScannedRef.current = { qrId, time: now };
      if (shouldStopCamera) {
        void stopCamera();
      } else {
        window.setTimeout(() => {
          scanLockedRef.current = false;
        }, 1500);
      }
      onScanRef.current(qrId);
    },
    [stopCamera]
  );

  const handleDecodedScanRef = useRef(handleDecodedScan);
  useEffect(() => {
    handleDecodedScanRef.current = handleDecodedScan;
  }, [handleDecodedScan]);

  useEffect(() => {
    if (manualMode) return;

    let mounted = true;
    scanLockedRef.current = false;
    const html5QrCode = new Html5Qrcode(containerId);
    qrRef.current = html5QrCode;

    const startScanner = async () => {
      setError(null);
      try {
        setIsScanning(true);
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDecodedScanRef.current(decodedText, true);
          },
          () => {}
        );
      } catch {
        if (mounted) {
          setError('Camera unavailable or permission denied. You can switch to Manual Entry below.');
          setIsScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      void stopCamera();
    };
  }, [manualMode, restartKey, stopCamera]);

  useEffect(() => {
    scanLockedRef.current = false;
  }, [manualMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDecodedScanRef.current(manualCode, false);
  };

  const scannerContent = (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="relative glass w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[90dvh] overflow-y-auto"
      >
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="w-10 h-10 rounded-xl border border-border-subtle flex items-center justify-center text-secondary hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex p-1 rounded-xl bg-background/70 border border-border-subtle">
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                !manualMode ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
              }`}
            >
              <Camera size={14} /> Camera Scan
            </button>
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                manualMode ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
              }`}
            >
              <Keyboard size={14} /> Manual Entry
            </button>
          </div>
        </div>

        <div className="p-5">
          {!manualMode ? (
            <>
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-border-subtle bg-black">
                <div id={containerId} className="w-full h-full" />

                {error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90">
                    <AlertCircle size={40} className="text-red-500 mb-3" />
                    <p className="text-sm text-white font-medium mb-4">{error}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRestartKey((k) => k + 1)}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <RefreshCw size={14} /> Retry Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualMode(true)}
                        className="px-4 py-2.5 bg-white/10 text-white rounded-xl text-xs font-semibold"
                      >
                        Enter Code
                      </button>
                    </div>
                  </div>
                )}

                {!error && isScanning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[230px] h-[230px] border-2 border-primary rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs text-secondary text-center">
                Align the student&apos;s QR code inside the frame to verify automatically.
              </p>
            </>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-secondary block mb-2">
                  Paste QR Payload String
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. attendance:eventId:userId:token"
                  className="w-full bg-background border border-border-subtle rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Verify Code
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(scannerContent, document.body);
}
