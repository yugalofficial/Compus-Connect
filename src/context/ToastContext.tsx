import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  confirm: async () => false,
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmResult = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}
      {createPortal(
        <>
          {/* Toast Container */}
          <div className="fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-[2500] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
              {toasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md ${
                    toast.type === 'success'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : toast.type === 'error'
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-slate-900 text-white border-slate-700'
                  }`}
                >
                  {toast.type === 'success' && <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
                  {toast.type === 'error' && <AlertCircle size={18} className="shrink-0 mt-0.5" />}
                  {toast.type === 'info' && <Info size={18} className="shrink-0 mt-0.5" />}
                  <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
                  <button
                    onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                    className="opacity-70 hover:opacity-100 p-0.5"
                    aria-label="Dismiss notification"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Confirm Dialog */}
          <AnimatePresence>
            {confirmState && (
              <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => handleConfirmResult(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-sm glass rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                    confirmState.options.destructive ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-primary'
                  }`}>
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{confirmState.options.title}</h3>
                  <p className="text-sm text-secondary mb-6 leading-relaxed">{confirmState.options.message}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleConfirmResult(false)}
                      className="flex-1 py-3 px-4 rounded-xl border border-border-subtle text-sm font-semibold hover:bg-secondary/10 transition-colors"
                    >
                      {confirmState.options.cancelText || 'Cancel'}
                    </button>
                    <button
                      onClick={() => handleConfirmResult(true)}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
                        confirmState.options.destructive ? 'bg-red-600' : 'bg-primary'
                      }`}
                    >
                      {confirmState.options.confirmText || 'Confirm'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
