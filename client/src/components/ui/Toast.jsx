import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Check, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Toasts (§7 chrome): top-right desktop / top-center mobile, max 360px,
 * 8px radius, surface + subtle border + shadow-md, auto-dismiss 4s,
 * role="status" aria-live="polite" (§12). Never modal, never blocking.
 */

const ToastContext = createContext(null);

const icons = {
  success: Check,
  info: Info,
  undo: null,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++idRef.current;
      const entry = { id, tone: 'info', duration: 4000, ...toast };
      setToasts((current) => [...current, entry]);
      if (entry.duration > 0) {
        setTimeout(() => dismiss(id), entry.duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div
        className="fixed right-4 top-4 z-[60] flex max-w-[360px] flex-col gap-2 max-md:left-1/2 max-md:right-auto max-md:-translate-x-1/2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone in icons ? icons[toast.tone] : Info;
          return (
            <div
              key={toast.id}
              className={cn(
                'flex items-center gap-3 rounded-card border border-line-subtle bg-surface p-3 shadow-md',
                'text-sm text-ink-primary'
              )}
            >
              {Icon ? <Icon size={16} aria-hidden="true" className="shrink-0 text-matcha" /> : null}
              <span className="flex-1">{toast.message}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action.onClick();
                    dismiss(toast.id);
                  }}
                  className="rounded-control px-2 py-1 text-xs font-medium text-vermillion transition-colors duration-fast ease-out hover:bg-subtle"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="rounded-control p-1 text-ink-muted transition-colors duration-fast ease-out hover:text-ink-primary"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
