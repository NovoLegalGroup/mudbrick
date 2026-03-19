/**
 * Mudbrick v2 -- Offline Indicator Component
 *
 * Shows a banner when the browser goes offline.
 */

import { useOnline } from '../../hooks/useOnline';

export function OfflineIndicator() {
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        backgroundColor: 'var(--mb-toast-warning)',
        color: '#fff',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 500,
        zIndex: 1200,
      }}
    >
      You are offline. Some features require an internet connection.
    </div>
  );
}
