/**
 * Mudbrick v2 -- Keyboard Shortcuts Hook
 *
 * Ported from v1 js/keyboard-shortcuts.js
 * Centralized keyboard event handling for the application.
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Shortcut definition matching v1 catalog format.
 */
export interface ShortcutDef {
  label: string;
  keys: string;
  mac?: string;
}

/**
 * Shortcut catalog ported from v1 keyboard-shortcuts.js.
 */
export const SHORTCUT_CATALOG: Record<string, ShortcutDef[]> = {
  File: [
    { label: 'Open file', keys: 'Ctrl+O' },
    { label: 'Save / Export', keys: 'Ctrl+S' },
    { label: 'Print', keys: 'Ctrl+P' },
  ],
  Edit: [
    { label: 'Undo', keys: 'Ctrl+Z' },
    { label: 'Redo', keys: 'Ctrl+Shift+Z' },
    { label: 'Cut', keys: 'Ctrl+X' },
    { label: 'Copy', keys: 'Ctrl+C' },
    { label: 'Paste', keys: 'Ctrl+V' },
    { label: 'Delete selection', keys: 'Delete' },
    { label: 'Select All', keys: 'Ctrl+A' },
    { label: 'Find & Replace', keys: 'Ctrl+F' },
  ],
  Navigation: [
    { label: 'Previous page', keys: 'Ctrl+[' },
    { label: 'Next page', keys: 'Ctrl+]' },
    { label: 'First page', keys: 'Home' },
    { label: 'Last page', keys: 'End' },
  ],
  View: [
    { label: 'Zoom in', keys: 'Ctrl+=' },
    { label: 'Zoom out', keys: 'Ctrl+-' },
    { label: 'Actual Size', keys: 'Ctrl+0' },
    { label: 'Full Screen', keys: 'F11' },
  ],
  Tools: [
    { label: 'Select tool', keys: 'V' },
    { label: 'Hand / Pan', keys: 'H' },
    { label: 'Text tool', keys: 'T' },
    { label: 'Draw tool', keys: 'D' },
  ],
  'Text Editing': [
    { label: 'Bold', keys: 'Ctrl+B' },
    { label: 'Italic', keys: 'Ctrl+I' },
    { label: 'Apply changes', keys: 'Ctrl+Enter' },
  ],
  General: [
    { label: 'Show shortcuts', keys: '?' },
    { label: 'Close modal / Deselect', keys: 'Esc' },
    { label: 'Cycle app regions', keys: 'F6' },
    { label: 'Page context menu', keys: 'Shift+F10' },
  ],
};

export function getCategories(): string[] {
  return Object.keys(SHORTCUT_CATALOG);
}

export function getShortcuts(category: string): ShortcutDef[] {
  return SHORTCUT_CATALOG[category] ?? [];
}

export function searchShortcuts(
  query: string,
): Array<ShortcutDef & { category: string }> {
  const q = query.toLowerCase();
  const results: Array<ShortcutDef & { category: string }> = [];
  for (const [category, shortcuts] of Object.entries(SHORTCUT_CATALOG)) {
    for (const s of shortcuts) {
      if (
        s.label.toLowerCase().includes(q) ||
        s.keys.toLowerCase().includes(q)
      ) {
        results.push({ category, ...s });
      }
    }
  }
  return results;
}

type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
}

/**
 * Parse a shortcut string like "Ctrl+Shift+Z" into a binding object.
 */
function parseShortcut(keys: string): Omit<ShortcutBinding, 'handler'> {
  const parts = keys.split('+').map((p) => p.trim().toLowerCase());
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter((p) => !['ctrl', 'shift', 'alt'].includes(p))[0] ?? '',
  };
}

/**
 * Hook to register keyboard shortcuts.
 *
 * @param bindings Map of shortcut strings to handlers
 * @param enabled Whether shortcuts are active (default true)
 *
 * @example
 * useKeyboardShortcuts({
 *   'Ctrl+Z': () => handleUndo(),
 *   'Ctrl+Shift+Z': () => handleRedo(),
 *   'Escape': () => handleEscape(),
 * });
 */
export function useKeyboardShortcuts(
  bindings: Record<string, ShortcutHandler>,
  enabled = true,
): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape and some Ctrl+ shortcuts even in inputs
        if (e.key !== 'Escape' && !(e.ctrlKey || e.metaKey)) {
          return;
        }
      }

      for (const [shortcutStr, handler] of Object.entries(
        bindingsRef.current,
      )) {
        const binding = parseShortcut(shortcutStr);

        const ctrlMatch =
          binding.ctrl === (e.ctrlKey || e.metaKey) || !binding.ctrl;
        const shiftMatch = binding.shift === e.shiftKey || !binding.shift;
        const altMatch = binding.alt === e.altKey || !binding.alt;

        // More precise matching: require ctrl/shift/alt to match exactly
        const ctrlExact = !!binding.ctrl === (e.ctrlKey || e.metaKey);
        const shiftExact = !!binding.shift === e.shiftKey;

        if (
          ctrlExact &&
          shiftExact &&
          altMatch &&
          e.key.toLowerCase() === binding.key
        ) {
          e.preventDefault();
          handler(e);
          return;
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
