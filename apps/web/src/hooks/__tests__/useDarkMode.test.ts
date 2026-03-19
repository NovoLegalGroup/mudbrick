/**
 * Tests for useDarkMode hook.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDarkMode } from '../useDarkMode';
import { useUIStore } from '../../stores/uiStore';

describe('useDarkMode', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('returns current theme from store', () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('sets data-theme attribute on document element', () => {
    renderHook(() => useDarkMode());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles theme', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorage.getItem('mudbrick-theme')).toBe('dark');
  });

  it('reads stored theme from localStorage on init', () => {
    localStorage.setItem('mudbrick-theme', 'dark');
    renderHook(() => useDarkMode());
    // The hook reads from localStorage and sets the store
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('provides toggleTheme function', () => {
    const { result } = renderHook(() => useDarkMode());
    expect(typeof result.current.toggleTheme).toBe('function');
  });
});
