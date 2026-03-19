/**
 * Tests for useZoom hook.
 */

import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoom } from '../useZoom';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@mudbrick/shared/src/constants';

describe('useZoom', () => {
  it('starts at default zoom', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoom.level).toBe(DEFAULT_ZOOM);
    expect(result.current.zoom.fitMode).toBe('none');
  });

  it('starts at custom initial zoom', () => {
    const { result } = renderHook(() => useZoom({ initialZoom: 1.5 }));
    expect(result.current.zoom.level).toBe(1.5);
  });

  it('zooms in', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.zoom.level).toBeGreaterThan(DEFAULT_ZOOM);
    expect(result.current.zoom.fitMode).toBe('none');
  });

  it('zooms out', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      result.current.zoomOut();
    });

    expect(result.current.zoom.level).toBeLessThan(DEFAULT_ZOOM);
    expect(result.current.zoom.fitMode).toBe('none');
  });

  it('sets zoom to a specific level', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      result.current.setZoom(2.0);
    });

    expect(result.current.zoom.level).toBe(2.0);
    expect(result.current.zoom.fitMode).toBe('none');
  });

  it('clamps zoom to MIN_ZOOM', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      result.current.setZoom(0.01);
    });

    expect(result.current.zoom.level).toBe(MIN_ZOOM);
  });

  it('clamps zoom to MAX_ZOOM', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      result.current.setZoom(100);
    });

    expect(result.current.zoom.level).toBe(MAX_ZOOM);
  });

  it('resets zoom to default', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      result.current.zoomIn();
      result.current.zoomIn();
    });

    act(() => {
      result.current.resetZoom();
    });

    expect(result.current.zoom.level).toBe(DEFAULT_ZOOM);
    expect(result.current.zoom.fitMode).toBe('none');
  });

  it('zoom in does not exceed MAX_ZOOM', () => {
    const { result } = renderHook(() => useZoom({ initialZoom: MAX_ZOOM }));

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.zoom.level).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it('zoom out does not go below MIN_ZOOM', () => {
    const { result } = renderHook(() => useZoom({ initialZoom: MIN_ZOOM }));

    act(() => {
      result.current.zoomOut();
    });

    expect(result.current.zoom.level).toBeGreaterThanOrEqual(MIN_ZOOM);
  });
});
