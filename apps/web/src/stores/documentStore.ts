/**
 * Mudbrick v2 -- Document Store (Zustand) -- Desktop
 *
 * Manages PDF document state: session, pages, loading status.
 * No upload progress -- files are opened by local path.
 */

import { create } from 'zustand';
import type { DocumentInfo, PageInfo, VersionInfo } from '../types/pdf';

interface DocumentState {
  /** Current document info (null if no document loaded) */
  document: DocumentInfo | null;

  /** Whether a document is currently loading */
  loading: boolean;

  /** Current page number (1-indexed for display) */
  currentPage: number;

  /** Error message if something went wrong */
  error: string | null;

  /** Actions */
  setDocument: (doc: DocumentInfo | null) => void;
  setLoading: (loading: boolean) => void;
  setCurrentPage: (page: number) => void;
  setPageCount: (count: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  document: null,
  loading: false,
  currentPage: 1,
  error: null,
};

export const useDocumentStore = create<DocumentState>((set) => ({
  ...initialState,

  setDocument: (doc) => set({ document: doc, error: null }),
  setLoading: (loading) => set({ loading }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageCount: (count) =>
    set((state) => ({
      document: state.document
        ? { ...state.document, pageCount: count }
        : null,
    })),
  setError: (error) => set({ error, loading: false }),
  reset: () => set(initialState),
}));
