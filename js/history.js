/**
 * Mudbrick — Undo / Redo (Command History)
 *
 * Snapshot-based undo/redo for the Fabric.js annotation canvas.
 * Each change captures the full canvas JSON state.
 * Per-page history stacks keep undo scoped to the active page.
 *
 * Usage:
 *   import { pushState, undo, redo, canUndo, canRedo, clearHistory } from './history.js';
 *   pushState(pageNum, canvasJSON);  // after each annotation change
 *   undo(pageNum);                    // returns canvasJSON or null
 *   redo(pageNum);                    // returns canvasJSON or null
 */

const MAX_HISTORY = 50;

// Per-page history: { pageNum: { undoStack: [], redoStack: [] } }
const pageHistory = {};

function getPageHistory(pageNum) {
  if (!pageHistory[pageNum]) {
    pageHistory[pageNum] = { undoStack: [], redoStack: [] };
  }
  return pageHistory[pageNum];
}

/**
 * Push a new canvas state snapshot. Clears redo stack.
 * @param {number} pageNum - The page this state belongs to
 * @param {object} canvasJSON - Fabric canvas.toJSON() result
 */
export function pushState(pageNum, canvasJSON) {
  const hist = getPageHistory(pageNum);
  hist.undoStack.push(JSON.stringify(canvasJSON));
  if (hist.undoStack.length > MAX_HISTORY) {
    hist.undoStack.shift();
  }
  hist.redoStack.length = 0; // clear redo on new action
}

/**
 * Undo the last action on the given page.
 * @returns {object|null} The previous canvas JSON state, or null if nothing to undo
 */
export function undo(pageNum) {
  const hist = getPageHistory(pageNum);
  if (hist.undoStack.length <= 1) return null; // keep at least the initial state

  const current = hist.undoStack.pop();
  hist.redoStack.push(current);

  const previous = hist.undoStack[hist.undoStack.length - 1];
  return JSON.parse(previous);
}

/**
 * Redo the last undone action on the given page.
 * @returns {object|null} The next canvas JSON state, or null if nothing to redo
 */
export function redo(pageNum) {
  const hist = getPageHistory(pageNum);
  if (hist.redoStack.length === 0) return null;

  const next = hist.redoStack.pop();
  hist.undoStack.push(next);

  return JSON.parse(next);
}

/**
 * Whether undo is available for the given page.
 */
export function canUndo(pageNum) {
  const hist = pageHistory[pageNum];
  return hist ? hist.undoStack.length > 1 : false;
}

/**
 * Whether redo is available for the given page.
 */
export function canRedo(pageNum) {
  const hist = pageHistory[pageNum];
  return hist ? hist.redoStack.length > 0 : false;
}

/**
 * Clear history for a specific page or all pages.
 */
export function clearHistory(pageNum) {
  if (pageNum !== undefined) {
    delete pageHistory[pageNum];
  } else {
    Object.keys(pageHistory).forEach(k => delete pageHistory[k]);
  }
}
