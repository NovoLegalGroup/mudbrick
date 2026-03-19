/**
 * Tests for AnnouncerProvider and useAnnouncer.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AnnouncerProvider, useAnnouncer } from '../Announcer';

function TestComponent() {
  const { announce } = useAnnouncer();
  return (
    <div>
      <button onClick={() => announce('Page 3 of 10')}>Announce Polite</button>
      <button onClick={() => announce('Error occurred', 'assertive')}>Announce Assertive</button>
    </div>
  );
}

describe('Announcer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders ARIA live regions', () => {
    render(
      <AnnouncerProvider>
        <div>App</div>
      </AnnouncerProvider>,
    );
    expect(document.getElementById('a11y-announcer-polite')).not.toBeNull();
    expect(document.getElementById('a11y-announcer-assertive')).not.toBeNull();
  });

  it('polite region has role="status"', () => {
    render(
      <AnnouncerProvider>
        <div>App</div>
      </AnnouncerProvider>,
    );
    const polite = document.getElementById('a11y-announcer-polite');
    expect(polite?.getAttribute('role')).toBe('status');
    expect(polite?.getAttribute('aria-live')).toBe('polite');
  });

  it('assertive region has role="alert"', () => {
    render(
      <AnnouncerProvider>
        <div>App</div>
      </AnnouncerProvider>,
    );
    const assertive = document.getElementById('a11y-announcer-assertive');
    expect(assertive?.getAttribute('role')).toBe('alert');
    expect(assertive?.getAttribute('aria-live')).toBe('assertive');
  });

  it('both regions have aria-atomic="true"', () => {
    render(
      <AnnouncerProvider>
        <div>App</div>
      </AnnouncerProvider>,
    );
    expect(
      document.getElementById('a11y-announcer-polite')?.getAttribute('aria-atomic'),
    ).toBe('true');
    expect(
      document.getElementById('a11y-announcer-assertive')?.getAttribute('aria-atomic'),
    ).toBe('true');
  });

  it('renders children', () => {
    render(
      <AnnouncerProvider>
        <p>Child content</p>
      </AnnouncerProvider>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('provides announce function via context', () => {
    render(
      <AnnouncerProvider>
        <TestComponent />
      </AnnouncerProvider>,
    );
    expect(screen.getByText('Announce Polite')).toBeInTheDocument();
  });
});
