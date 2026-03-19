/**
 * Mudbrick v2 -- Modal Component
 *
 * Accessible modal dialog with focus trap and backdrop click-to-close.
 */

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      previousFocusRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`}
      onClick={handleBackdropClick}
      aria-labelledby={title ? 'modal-title' : undefined}
      style={{
        border: 'none',
        borderRadius: 'var(--mb-radius-md)',
        padding: 0,
        maxWidth: '90vw',
        maxHeight: '90vh',
        backgroundColor: 'var(--mb-surface)',
        color: 'var(--mb-text)',
        boxShadow: 'var(--mb-shadow-lg)',
      }}
    >
      <div className="modal-content" style={{ padding: '20px', minWidth: '300px' }}>
        {title && (
          <header className="modal-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <h2 id="modal-title" style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: 'var(--mb-text-secondary)',
                padding: '4px 8px',
              }}
            >
              &times;
            </button>
          </header>
        )}
        {children}
      </div>
    </dialog>
  );
}
