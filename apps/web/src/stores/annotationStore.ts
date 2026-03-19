/**
 * Mudbrick v2 -- Annotation Store (Zustand)
 *
 * Manages per-page annotation state and tool properties.
 */

import { create } from 'zustand';
import { TOOLS } from '@mudbrick/shared/src/constants';
import type { ToolId, ShapeId } from '@mudbrick/shared/src/constants';
import type { PageAnnotations, ToolProperties } from '../types/annotation';

interface AnnotationState {
  /** Active annotation tool */
  activeTool: ToolId;

  /** Per-page annotations indexed by page number (0-indexed) */
  pageAnnotations: Record<number, PageAnnotations>;

  /** Current tool properties */
  toolProperties: ToolProperties;

  /** Whether an annotation is currently selected */
  hasSelection: boolean;

  /** Actions */
  setActiveTool: (tool: ToolId) => void;
  setPageAnnotations: (page: number, annotations: PageAnnotations) => void;
  updateToolProperty: <K extends keyof ToolProperties>(
    key: K,
    value: ToolProperties[K],
  ) => void;
  setHasSelection: (has: boolean) => void;
  clearPageAnnotations: (page: number) => void;
  clearAllAnnotations: () => void;
  reset: () => void;
}

const defaultToolProperties: ToolProperties = {
  color: '#ff0000',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,
  fontFamily: 'Arial',
  shapeType: 'rect' as ShapeId,
};

const initialState = {
  activeTool: TOOLS.SELECT as ToolId,
  pageAnnotations: {} as Record<number, PageAnnotations>,
  toolProperties: { ...defaultToolProperties },
  hasSelection: false,
};

export const useAnnotationStore = create<AnnotationState>((set) => ({
  ...initialState,

  setActiveTool: (tool) => set({ activeTool: tool }),

  setPageAnnotations: (page, annotations) =>
    set((state) => ({
      pageAnnotations: {
        ...state.pageAnnotations,
        [page]: annotations,
      },
    })),

  updateToolProperty: (key, value) =>
    set((state) => ({
      toolProperties: {
        ...state.toolProperties,
        [key]: value,
      },
    })),

  setHasSelection: (has) => set({ hasSelection: has }),

  clearPageAnnotations: (page) =>
    set((state) => {
      const updated = { ...state.pageAnnotations };
      delete updated[page];
      return { pageAnnotations: updated };
    }),

  clearAllAnnotations: () => set({ pageAnnotations: {} }),

  reset: () => set(initialState),
}));
