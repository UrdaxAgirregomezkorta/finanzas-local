import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(() => {});

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = { success: 'text-gain', error: 'text-loss', info: 'text-accent' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    ({ title, description, tone = 'success', action, duration = 5000 }) => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-2), { id, title, description, tone, action }]);
      setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] ?? Info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-xl border border-zinc-700/70 bg-ink-850/95 px-4 py-3 shadow-pop backdrop-blur-md"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONES[t.tone]}`} strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-100">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] text-zinc-400">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-accent-strong hover:bg-accent/10"
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="shrink-0 text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
