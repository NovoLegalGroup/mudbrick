/**
 * Mudbrick v2 -- Document Store (Zustand)
 *
 * Manages PDF document state: session, pages, loading status.
 */

import { create } from 'zustand';
import type { DocumentInfo, PageInfo, VersionInfo } from '../types/pdf';

interface DocumentState {
  /** Current document info (null if no document loaded) */
  document: DocumentInfo | null;

  /** Whether a document is currently loading */
  loading: boolean;

  /** Upload progress (0-100) */
  uploadProgress: number;

  /** Current page number (1-indexed for display) */
  currentPage: number;

  /** Error message if something went wrong */
  error: string | null;

  /** Actions */
  setDocument: (doc: DocumentInfo | null) => void;
  setLoading: (loading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  setCurrentPage: (page: number) => void;
  setPageCount: (count: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  document: null,
  loading: false,
  uploadProgress: 0,
  currentPage: 1,
  error: null,
};

export const useDocumentStore = create<DocumentState>((set) => ({
  ...initialState,

  setDocument: (doc) => set({ document: doc, error: null }),
  setLoading: (loading) => set({ loading }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
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
