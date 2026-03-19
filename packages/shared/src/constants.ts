/**
 * Mudbrick v2 -- Shared Constants (Desktop)
 * Ported from v1 js/pdf-engine.js
 */

/** 17 discrete zoom levels matching v1 behavior */
export const ZOOM_LEVELS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0,
  2.5, 3.0, 4.0, 5.0,
] as const;

export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
export const DEFAULT_ZOOM = 1.0;

/** Session settings */
export const MAX_VERSIONS = 50;
export const AUTO_SAVE_INTERVAL_MS = 60_000;

/** Thumbnail defaults */
export const THUMBNAIL_WIDTH = 200;

/** API base URL -- localhost sidecar */
export const API_BASE = '/api';
export const API_DIRECT_BASE = 'http://localhost:8000/api';

/** Annotation tool identifiers */
export const TOOLS = {
  SELECT: 'select',
  DRAW: 'draw',
  HIGHLIGHT: 'highlight',
  TEXT: 'text',
  SHAPE: 'shape',
  STAMP: 'stamp',
  REDACT: 'redact',
  ERASER: 'eraser',
} as const;

export type ToolId = (typeof TOOLS)[keyof typeof TOOLS];

/** Shape sub-types */
export const SHAPES = {
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  LINE: 'line',
  ARROW: 'arrow',
} as const;

export type ShapeId = (typeof SHAPES)[keyof typeof SHAPES];
