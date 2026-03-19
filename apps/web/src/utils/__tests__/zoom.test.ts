/**
 * Tests for zoom utility functions.
 */

import { describe, expect, it } from 'vitest';
import {
  getNextZoom,
  snapToZoomLevel,
  calculateFitWidth,
  calculateFitPage,
  clampZoom,
  formatZoomPercent,
  getZoomLevelIndex,
} from '../zoom';
import { ZOOM_LEVELS, MIN_ZOOM, MAX_ZOOM } from '@mudbrick/shared/src/constants';

describe('getNextZoom', () => {
  it('zooms in from 1.0 to the next level', () => {
    const next = getNextZoom(1.0, 1);
    expect(next).toBe(1.1);
  });

  it('zooms out from 1.0 to the previous level', () => {
    const prev = getNextZoom(1.0, -1);
    expect(prev).toBe(0.9);
  });

  it('returns MAX_ZOOM when at maximum', () => {
    const next = getNextZoom(MAX_ZOOM, 1);
    expect(next).toBe(MAX_ZOOM);
  });

  it('returns MIN_ZOOM when at minimum', () => {
    const prev = getNextZoom(MIN_ZOOM, -1);
    expect(prev).toBe(MIN_ZOOM);
  });

  it('zooms in from 0.25 to 0.33', () => {
    expect(getNextZoom(0.25, 1)).toBe(0.33);
  });

  it('zooms out from 5.0 to 4.0', () => {
    expect(getNextZoom(5.0, -1)).toBe(4.0);
  });

  it('snaps to next level from an intermediate value', () => {
    const next = getNextZoom(0.95, 1);
    expect(next).toBe(1.0);
  });
});

describe('snapToZoomLevel', () => {
  it('snaps exactly to a zoom level', () => {
    expect(snapToZoomLevel(1.0)).toBe(1.0);
  });

  it('snaps to the closest level', () => {
    expect(snapToZoomLevel(0.96)).toBe(1.0);
  });

  it('snaps to MIN_ZOOM for very small values', () => {
    expect(snapToZoomLevel(0.1)).toBe(MIN_ZOOM);
  });

  it('snaps to MAX_ZOOM for very large values', () => {
    expect(snapToZoomLevel(10.0)).toBe(MAX_ZOOM);
  });
});

describe('calculateFitWidth', () => {
  it('calculates zoom to fit page width in container', () => {
    const zoom = calculateFitWidth(612, 652); // 652 - 40 padding = 612
    expect(zoom).toBe(1.0);
  });

  it('scales down for wide pages in small containers', () => {
    const zoom = calculateFitWidth(1000, 540);
    expect(zoom).toBe(0.5);
  });

  it('uses custom padding', () => {
    const zoom = calculateFitWidth(612, 712, 100);
    expect(zoom).toBe(1.0);
  });
});

describe('calculateFitPage', () => {
  it('fits page within container respecting both dimensions', () => {
    const zoom = calculateFitPage(612, 792, 652, 832);
    // Width: (652-40)/612 = 1.0, Height: (832-40)/792 = 1.0
    expect(zoom).toBe(1.0);
  });

  it('constrains by height when container is short', () => {
    const zoom = calculateFitPage(612, 792, 1000, 400);
    // Width: (1000-40)/612 = 1.57, Height: (400-40)/792 = 0.45
    expect(zoom).toBeCloseTo(0.4545, 2);
  });

  it('constrains by width when container is narrow', () => {
    const zoom = calculateFitPage(612, 792, 300, 2000);
    // Width: (300-40)/612 = 0.42, Height: (2000-40)/792 = 2.47
    expect(zoom).toBeCloseTo(0.4248, 2);
  });
});

describe('clampZoom', () => {
  it('returns MIN_ZOOM for values below minimum', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
  });

  it('returns MAX_ZOOM for values above maximum', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });

  it('returns the value unchanged if within bounds', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('handles exact boundaries', () => {
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM);
  });
});

describe('formatZoomPercent', () => {
  it('formats 1.0 as 100%', () => {
    expect(formatZoomPercent(1.0)).toBe('100%');
  });

  it('formats 0.5 as 50%', () => {
    expect(formatZoomPercent(0.5)).toBe('50%');
  });

  it('formats 2.5 as 250%', () => {
    expect(formatZoomPercent(2.5)).toBe('250%');
  });

  it('rounds to nearest integer', () => {
    expect(formatZoomPercent(0.33)).toBe('33%');
    expect(formatZoomPercent(0.67)).toBe('67%');
  });
});

describe('getZoomLevelIndex', () => {
  it('returns 0 for MIN_ZOOM', () => {
    expect(getZoomLevelIndex(MIN_ZOOM)).toBe(0);
  });

  it('returns last index for MAX_ZOOM', () => {
    expect(getZoomLevelIndex(MAX_ZOOM)).toBe(ZOOM_LEVELS.length - 1);
  });

  it('returns correct index for 1.0', () => {
    const idx = getZoomLevelIndex(1.0);
    expect(ZOOM_LEVELS[idx]).toBe(1.0);
  });

  it('returns closest index for intermediate values', () => {
    const idx = getZoomLevelIndex(0.95);
    expect(ZOOM_LEVELS[idx]).toBe(0.9); // or 1.0, closest
  });
});

describe('ZOOM_LEVELS', () => {
  it('has 17 zoom levels', () => {
    expect(ZOOM_LEVELS.length).toBe(17);
  });

  it('is sorted ascending', () => {
    for (let i = 1; i < ZOOM_LEVELS.length; i++) {
      expect(ZOOM_LEVELS[i]).toBeGreaterThan(ZOOM_LEVELS[i - 1]!);
    }
  });

  it('starts at 0.25 and ends at 5.0', () => {
    expect(ZOOM_LEVELS[0]).toBe(0.25);
    expect(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]).toBe(5.0);
  });

  it('includes 1.0 (100%)', () => {
    expect(ZOOM_LEVELS).toContain(1.0);
  });
});
