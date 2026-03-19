/**
 * Mudbrick v2 -- Toast Notification Component
 *
 * Renders toast messages from the UI store with auto-dismiss.
 */

import { useEffect } from 'react';
import { useUIStore, type ToastMessage } from '../../stores/uiStore';

const TOAST_DURATION = 4000;

const typeStyles: Record<ToastMessage['type'], { bg: string; icon: string }> = {
  success: { bg: 'var(--mb-toast-success)', icon: '✓' },
  error: { bg: 'var(--mb-toast-error)', icon: '!' },
  warning: { bg: 'var(--mb-toast-warning)', icon: '⚠' },
  info: { bg: 'var(--mb-toast-info)', icon: 'i' },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const removeToast = useUIStore((s) => s.removeToast);
  const duration = toast.duration ?? TOAST_DURATION;

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, removeToast]);

  const style = typeStyles[toast.type];

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: 'var(--mb-radius-sm)',
        backgroundColor: style.bg,
        color: '#fff',
        fontSize: '14px',
        boxShadow: 'var(--mb-shadow-md)',
        animation: 'toast-in 200ms ease',
        cursor: 'pointer',
      }}
      onClick={() => removeToast(toast.id)}
    >
      <span style={{ fontWeight: 700, width: '18px', textAlign: 'center' }}>
        {style.icon}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 'var(--z-toast)' as unknown as number,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
