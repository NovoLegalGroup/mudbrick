/**
 * Mudbrick v2 -- ARIA Live Region Announcer
 *
 * Global screen reader announcement provider. Components call announce()
 * to have messages spoken by assistive technology without visual change.
 * Ported from v1 js/a11y.js announceToScreenReader pattern.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface AnnouncerContextValue {
  /** Announce a message to screen readers via the ARIA live region. */
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue>({
  announce: () => {},
});

/**
 * Hook to access the announcer. Call announce("message") to speak to screen readers.
 *
 * Example:
 *   const { announce } = useAnnouncer();
 *   announce("Page 3 of 10");
 *   announce("Document saved", "assertive");
 */
export function useAnnouncer(): AnnouncerContextValue {
  return useContext(AnnouncerContext);
}

interface AnnouncerProviderProps {
  children: ReactNode;
}

/**
 * Wrap the app in <AnnouncerProvider> to enable screen reader announcements.
 * Renders a visually hidden ARIA live region at the bottom of the DOM.
 */
export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback(
    (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
      // Clear previous message first so identical consecutive messages
      // still trigger a DOM mutation and re-announce.
      if (politeness === 'assertive') {
        setAssertiveMessage('');
        requestAnimationFrame(() => setAssertiveMessage(message));
      } else {
        setPoliteMessage('');
        requestAnimationFrame(() => setPoliteMessage(message));
      }

      // Auto-clear after a few seconds to keep the live region clean
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = setTimeout(() => {
        setPoliteMessage('');
        setAssertiveMessage('');
      }, 5000);
    },
    [],
  );

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}

      {/* Visually hidden ARIA live regions */}
      <div
        id="a11y-announcer-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnlyStyle}
      >
        {politeMessage}
      </div>
      <div
        id="a11y-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={srOnlyStyle}
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

/** Visually hidden but available to screen readers */
const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
