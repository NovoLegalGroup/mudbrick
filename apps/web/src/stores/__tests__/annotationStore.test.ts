/**
 * Tests for annotation store: per-page CRUD, tool properties.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { useAnnotationStore } from '../annotationStore';
import { TOOLS } from '@mudbrick/shared/src/constants';

describe('annotationStore', () => {
  beforeEach(() => {
    useAnnotationStore.getState().reset();
  });

  it('starts with select tool active', () => {
    expect(useAnnotationStore.getState().activeTool).toBe(TOOLS.SELECT);
  });

  it('changes active tool', () => {
    useAnnotationStore.getState().setActiveTool(TOOLS.DRAW);
    expect(useAnnotationStore.getState().activeTool).toBe(TOOLS.DRAW);
  });

  it('starts with empty page annotations', () => {
    expect(useAnnotationStore.getState().pageAnnotations).toEqual({});
  });

  it('sets page annotations', () => {
    const annotations = { version: '6.0.0', objects: [{ type: 'rect' }] };
    useAnnotationStore.getState().setPageAnnotations(0, annotations as any);
    expect(useAnnotationStore.getState().pageAnnotations[0]).toEqual(annotations);
  });

  it('sets annotations for multiple pages independently', () => {
    const page0 = { version: '6.0.0', objects: [{ type: 'rect' }] };
    const page1 = { version: '6.0.0', objects: [{ type: 'path' }] };
    useAnnotationStore.getState().setPageAnnotations(0, page0 as any);
    useAnnotationStore.getState().setPageAnnotations(1, page1 as any);
    expect(useAnnotationStore.getState().pageAnnotations[0]).toEqual(page0);
    expect(useAnnotationStore.getState().pageAnnotations[1]).toEqual(page1);
  });

  it('clears page annotations for a single page', () => {
    useAnnotationStore.getState().setPageAnnotations(0, { version: '6.0.0', objects: [] } as any);
    useAnnotationStore.getState().setPageAnnotations(1, { version: '6.0.0', objects: [] } as any);
    useAnnotationStore.getState().clearPageAnnotations(0);
    expect(useAnnotationStore.getState().pageAnnotations[0]).toBeUndefined();
    expect(useAnnotationStore.getState().pageAnnotations[1]).toBeDefined();
  });

  it('clears all annotations', () => {
    useAnnotationStore.getState().setPageAnnotations(0, { version: '6.0.0', objects: [] } as any);
    useAnnotationStore.getState().setPageAnnotations(1, { version: '6.0.0', objects: [] } as any);
    useAnnotationStore.getState().clearAllAnnotations();
    expect(useAnnotationStore.getState().pageAnnotations).toEqual({});
  });

  it('updates tool properties', () => {
    useAnnotationStore.getState().updateToolProperty('color', '#00ff00');
    expect(useAnnotationStore.getState().toolProperties.color).toBe('#00ff00');
  });

  it('updates stroke width', () => {
    useAnnotationStore.getState().updateToolProperty('strokeWidth', 5);
    expect(useAnnotationStore.getState().toolProperties.strokeWidth).toBe(5);
  });

  it('updates opacity', () => {
    useAnnotationStore.getState().updateToolProperty('opacity', 0.5);
    expect(useAnnotationStore.getState().toolProperties.opacity).toBe(0.5);
  });

  it('tracks selection state', () => {
    expect(useAnnotationStore.getState().hasSelection).toBe(false);
    useAnnotationStore.getState().setHasSelection(true);
    expect(useAnnotationStore.getState().hasSelection).toBe(true);
  });

  it('resets to initial state', () => {
    useAnnotationStore.getState().setActiveTool(TOOLS.DRAW);
    useAnnotationStore.getState().setPageAnnotations(0, { version: '6.0.0', objects: [] } as any);
    useAnnotationStore.getState().setHasSelection(true);
    useAnnotationStore.getState().updateToolProperty('color', '#00ff00');

    useAnnotationStore.getState().reset();

    const state = useAnnotationStore.getState();
    expect(state.activeTool).toBe(TOOLS.SELECT);
    expect(state.pageAnnotations).toEqual({});
    expect(state.hasSelection).toBe(false);
    expect(state.toolProperties.color).toBe('#ff0000');
  });
});
