/**
 * Tests for Toast/ToastContainer component.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContainer } from '../Toast';
import { useUIStore } from '../../../stores/uiStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a toast message', () => {
    useUIStore.getState().addToast({ type: 'success', message: 'File saved!' });
    render(<ToastContainer />);
    expect(screen.getByText('File saved!')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    useUIStore.getState().addToast({ type: 'success', message: 'First' });
    useUIStore.getState().addToast({ type: 'error', message: 'Second' });
    render(<ToastContainer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders toast with role="alert"', () => {
    useUIStore.getState().addToast({ type: 'error', message: 'Error!' });
    render(<ToastContainer />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('removes toast on click', () => {
    useUIStore.getState().addToast({ type: 'info', message: 'Click me' });
    render(<ToastContainer />);

    fireEvent.click(screen.getByText('Click me'));

    // Toast should be removed from store
    expect(useUIStore.getState().toasts.length).toBe(0);
  });

  it('auto-dismisses after duration', () => {
    useUIStore.getState().addToast({ type: 'info', message: 'Temporary' });
    render(<ToastContainer />);

    expect(screen.getByText('Temporary')).toBeInTheDocument();

    // Advance past the default 4000ms duration
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(useUIStore.getState().toasts.length).toBe(0);
  });

  it('has aria-live="polite" on container', () => {
    useUIStore.getState().addToast({ type: 'info', message: 'Test' });
    render(<ToastContainer />);
    const container = document.querySelector('[aria-live="polite"]');
    expect(container).not.toBeNull();
  });
});

// Need to import afterEach
import { afterEach } from 'vitest';
