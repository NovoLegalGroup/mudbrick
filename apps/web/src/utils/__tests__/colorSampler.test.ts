/**
 * Tests for color sampler utility functions.
 *
 * These functions operate on HTMLCanvasElement which is mocked in jsdom.
 * We test the null/edge-case paths and the logic branches.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  sampleBackgroundColor,
  sampleTextColor,
  samplePixelColor,
} from '../colorSampler';

function createMockCanvas(
  width: number,
  height: number,
  pixelData?: Uint8ClampedArray,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'offsetWidth', { value: width });
  canvas.style.width = `${width}px`;

  const context = {
    canvas,
    getImageData: vi.fn().mockReturnValue({
      data: pixelData ?? new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb',
    } as ImageData),
    putImageData: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
  };

  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn().mockReturnValue(context),
  });

  return canvas;
}

describe('sampleBackgroundColor', () => {
  it('returns #ffffff for null canvas', () => {
    expect(sampleBackgroundColor(null, 0, 0, 100, 100)).toBe('#ffffff');
  });

  it('returns #ffffff for zero-area region', () => {
    const canvas = createMockCanvas(100, 100);
    expect(sampleBackgroundColor(canvas, 0, 0, 0, 0)).toBe('#ffffff');
  });

  it('returns #ffffff when all pixels are dark (below luminance 150)', () => {
    // All black pixels -- luminance 0, all skipped
    const data = new Uint8ClampedArray(16); // 4 pixels, all 0 (black)
    const canvas = createMockCanvas(2, 2, data);
    expect(sampleBackgroundColor(canvas, 0, 0, 2, 2)).toBe('#ffffff');
  });

  it('returns the dominant light color', () => {
    // 4 pixels of white (255,255,255) -- luminance ~255, above 150
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]);
    const canvas = createMockCanvas(2, 2, data);
    const result = sampleBackgroundColor(canvas, 0, 0, 2, 2);
    // Quantized: (255 >> 2) << 2 = 252
    expect(result).toBe('#fcfcfc');
  });
});

describe('sampleTextColor', () => {
  it('returns #000000 for null canvas', () => {
    expect(sampleTextColor(null, 0, 0, 100, 100)).toBe('#000000');
  });

  it('returns #000000 for zero-area region', () => {
    const canvas = createMockCanvas(100, 100);
    expect(sampleTextColor(canvas, 0, 0, 0, 0)).toBe('#000000');
  });

  it('returns #000000 when all pixels are light (skipped as background)', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]);
    const canvas = createMockCanvas(2, 1, data);
    expect(sampleTextColor(canvas, 0, 0, 2, 1)).toBe('#000000');
  });

  it('detects dark text pixels', () => {
    // 4 pixels of black text (0,0,0) with full alpha
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
    ]);
    const canvas = createMockCanvas(2, 2, data);
    const result = sampleTextColor(canvas, 0, 0, 2, 2);
    expect(result).toBe('#000000');
  });

  it('uses bgHex to adjust skip threshold', () => {
    const data = new Uint8ClampedArray([
      50, 50, 50, 255,
      50, 50, 50, 255,
    ]);
    const canvas = createMockCanvas(2, 1, data);
    const result = sampleTextColor(canvas, 0, 0, 2, 1, '#ffffff');
    // Luminance 50 is below threshold (255-40=215), so counted
    expect(result).toBe('#303030'); // quantized (50>>2)<<2 = 48 = 0x30
  });
});

describe('samplePixelColor', () => {
  it('returns null for null canvas', () => {
    expect(samplePixelColor(null, 0, 0)).toBeNull();
  });

  it('returns null for negative coordinates', () => {
    const canvas = createMockCanvas(100, 100);
    expect(samplePixelColor(canvas, -1, -1)).toBeNull();
  });

  it('returns null for out-of-bounds coordinates', () => {
    const canvas = createMockCanvas(100, 100);
    expect(samplePixelColor(canvas, 200, 200)).toBeNull();
  });

  it('returns hex color for valid pixel', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const canvas = createMockCanvas(1, 1, data);
    const result = samplePixelColor(canvas, 0, 0);
    expect(result).toBe('#ff0000');
  });
});
