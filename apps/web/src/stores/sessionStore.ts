/**
 * Mudbrick v2 -- Session Store (Zustand)
 *
 * Manages recent files and user preferences persisted in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentFile {
  sessionId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  openedAt: string;
}

interface SessionState {
  /** Recent files (most recent first, max 10) */
  recentFiles: RecentFile[];

  /** User preferences */
  preferences: {
    defaultZoom: number;
    autoSaveEnabled: boolean;
    showOnboarding: boolean;
  };

  /** Actions */
  addRecentFile: (file: RecentFile) => void;
  removeRecentFile: (sessionId: string) => void;
  clearRecentFiles: () => void;
  updatePreference: <K extends keyof SessionState['preferences']>(
    key: K,
    value: SessionState['preferences'][K],
  ) => void;
}

const MAX_RECENT_FILES = 10;

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      recentFiles: [],
      preferences: {
        defaultZoom: 1.0,
        autoSaveEnabled: true,
        showOnboarding: true,
      },

      addRecentFile: (file) =>
        set((state) => {
          const filtered = state.recentFiles.filter(
            (f) => f.sessionId !== file.sessionId,
          );
          return {
            recentFiles: [file, ...filtered].slice(0, MAX_RECENT_FILES),
          };
        }),

      removeRecentFile: (sessionId) =>
        set((state) => ({
          recentFiles: state.recentFiles.filter(
            (f) => f.sessionId !== sessionId,
          ),
        })),

      clearRecentFiles: () => set({ recentFiles: [] }),

      updatePreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),
    }),
    {
      name: 'mudbrick-session',
    },
  ),
);
