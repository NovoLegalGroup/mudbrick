/**
 * Mudbrick v2 -- Skip to Main Content Link
 *
 * Hidden by default, becomes visible on keyboard focus.
 * Allows keyboard users to skip the toolbar and go straight to main content.
 */

import styles from './SkipLink.module.css';

interface SkipLinkProps {
  /** CSS selector or id of the target element (without #) */
  targetId?: string;
  label?: string;
}

export function SkipLink({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipLinkProps) {
  return (
    <a className={styles.skipLink} href={`#${targetId}`}>
      {label}
    </a>
  );
}
