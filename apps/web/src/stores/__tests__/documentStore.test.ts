/**
 * Tests for document store state transitions.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { useDocumentStore } from '../documentStore';

const mockDocument = {
  sessionId: 'session-1',
  filePath: 'C:/docs/test.pdf',
  fileName: 'test.pdf',
  fileSize: 2048,
  pageCount: 5,
  currentVersion: 1,
  pages: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('documentStore', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('starts in idle state', () => {
    const state = useDocumentStore.getState();
    expect(state.document).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.currentPage).toBe(1);
    expect(state.error).toBeNull();
  });

  it('transitions to loading state', () => {
    useDocumentStore.getState().setLoading(true);
    expect(useDocumentStore.getState().loading).toBe(true);
  });

  it('transitions to loaded state with document', () => {
    useDocumentStore.getState().setDocument(mockDocument);
    const state = useDocumentStore.getState();
    expect(state.document).toEqual(mockDocument);
    expect(state.error).toBeNull();
  });

  it('transitions to error state', () => {
    useDocumentStore.getState().setError('File not found');
    const state = useDocumentStore.getState();
    expect(state.error).toBe('File not found');
    expect(state.loading).toBe(false);
  });

  it('clears error when document is set', () => {
    useDocumentStore.getState().setError('Some error');
    useDocumentStore.getState().setDocument(mockDocument);
    expect(useDocumentStore.getState().error).toBeNull();
  });

  it('navigates to a page', () => {
    useDocumentStore.getState().setCurrentPage(3);
    expect(useDocumentStore.getState().currentPage).toBe(3);
  });

  it('updates page count on loaded document', () => {
    useDocumentStore.getState().setDocument(mockDocument);
    useDocumentStore.getState().setPageCount(10);
    expect(useDocumentStore.getState().document?.pageCount).toBe(10);
  });

  it('does not update page count when no document loaded', () => {
    useDocumentStore.getState().setPageCount(10);
    expect(useDocumentStore.getState().document).toBeNull();
  });

  it('resets to initial state', () => {
    useDocumentStore.getState().setDocument(mockDocument);
    useDocumentStore.getState().setCurrentPage(5);
    useDocumentStore.getState().setLoading(true);
    useDocumentStore.getState().reset();

    const state = useDocumentStore.getState();
    expect(state.document).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.currentPage).toBe(1);
    expect(state.error).toBeNull();
  });

  it('handles full lifecycle: idle -> loading -> loaded -> error -> reset', () => {
    const store = useDocumentStore;

    // idle
    expect(store.getState().loading).toBe(false);
    expect(store.getState().document).toBeNull();

    // loading
    store.getState().setLoading(true);
    expect(store.getState().loading).toBe(true);

    // loaded
    store.getState().setLoading(false);
    store.getState().setDocument(mockDocument);
    expect(store.getState().document?.sessionId).toBe('session-1');

    // error
    store.getState().setError('Connection lost');
    expect(store.getState().error).toBe('Connection lost');

    // reset
    store.getState().reset();
    expect(store.getState().document).toBeNull();
    expect(store.getState().error).toBeNull();
  });
});
