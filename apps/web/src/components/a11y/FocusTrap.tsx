/**
 * Mudbrick v2 -- Focus Trap Component
 *
 * Traps keyboard focus within a container element (modals, panels).
 * Tab and Shift+Tab cycle through focusable children without escaping.
 * Ported from v1 js/a11y.js trapFocus/releaseFocus pattern.
 */

import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface FocusTrapProps {
  /** Whether the focus trap is active */
  active: boolean;
  /** Content to render inside the trap */
  children: ReactNode;
  /** Optional: element to restore focus to when trap deactivates */
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional className for the wrapper */
  className?: string;
}

export function FocusTrap({
  active,
  children,
  restoreFocusRef,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Store the currently focused element so we can restore later
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the trap
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
    ).filter(
      (el) =>
        !el.closest('[hidden]') &&
        getComputedStyle(el).display !== 'none',
    );

    if (focusable.length > 0) {
      requestAnimationFrame(() => focusable[0].focus());
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const currentFocusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter(
        (el) =>
          !el.closest('[hidden]') &&
          getComputedStyle(el).display !== 'none',
      );

      if (currentFocusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus when trap deactivates
      const restoreTarget = restoreFocusRef?.current ?? previousFocusRef.current;
      if (restoreTarget && typeof restoreTarget.focus === 'function') {
        requestAnimationFrame(() => restoreTarget.focus());
      }
    };
  }, [active, restoreFocusRef]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
