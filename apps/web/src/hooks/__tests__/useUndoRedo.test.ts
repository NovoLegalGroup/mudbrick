/**
 * Tests for useUndoRedo hook.
 */

import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../useUndoRedo';

describe('useUndoRedo', () => {
  it('initializes with no undo/redo available', () => {
    const { result } = renderHook(() => useUndoRedo<string>());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
  });

  it('initializes with initial state', () => {
    const { result } = renderHook(() => useUndoRedo<string>('initial'));
    expect(result.current.current()).toBe('initial');
    expect(result.current.canUndo).toBe(false);
  });

  it('pushes state and enables undo', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.current()).toBe('v2');
  });

  it('undoes to previous state', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
    });

    let restored: string | null = null;
    act(() => {
      restored = result.current.undo();
    });

    expect(restored).toBe('v1');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes to next state', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
    });
    act(() => {
      result.current.undo();
    });

    let restored: string | null = null;
    act(() => {
      restored = result.current.redo();
    });

    expect(restored).toBe('v2');
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('returns null when undo at beginning', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    let restored: string | null = 'not-null';
    act(() => {
      restored = result.current.undo();
    });

    expect(restored).toBeNull();
  });

  it('returns null when redo at end', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    let restored: string | null = 'not-null';
    act(() => {
      restored = result.current.redo();
    });

    expect(restored).toBeNull();
  });

  it('clears redo stack on new push after undo', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
      result.current.push('v3');
    });

    act(() => {
      result.current.undo(); // back to v2
    });

    act(() => {
      result.current.push('v4'); // v3 redo branch is lost
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.current()).toBe('v4');
  });

  it('respects max history limit', () => {
    const { result } = renderHook(() =>
      useUndoRedo<number>(0, { maxHistory: 5 }),
    );

    act(() => {
      for (let i = 1; i <= 10; i++) {
        result.current.push(i);
      }
    });

    // Should have trimmed to 5 entries
    expect(result.current.undoCount).toBeLessThanOrEqual(4);
  });

  it('resets all history', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
      result.current.push('v3');
    });

    act(() => {
      result.current.reset('fresh');
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.current()).toBe('fresh');
  });

  it('resets to empty when no initial state given', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.current()).toBeNull();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('tracks undo and redo counts correctly', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.push('v2');
      result.current.push('v3');
      result.current.push('v4');
    });

    expect(result.current.undoCount).toBe(3);
    expect(result.current.redoCount).toBe(0);

    act(() => {
      result.current.undo();
    });

    expect(result.current.undoCount).toBe(2);
    expect(result.current.redoCount).toBe(1);

    act(() => {
      result.current.undo();
    });

    expect(result.current.undoCount).toBe(1);
    expect(result.current.redoCount).toBe(2);
  });
});
