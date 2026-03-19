/**
 * Tests for session store: recent files, preferences.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { useSessionStore, type RecentFile } from '../sessionStore';

const makeRecentFile = (path: string, overrides?: Partial<RecentFile>): RecentFile => ({
  filePath: path,
  fileName: path.split('/').pop() || path.split('\\').pop() || path,
  fileSize: 1024,
  pageCount: 5,
  openedAt: new Date().toISOString(),
  ...overrides,
});

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().clearRecentFiles();
    useSessionStore.getState().updatePreference('defaultZoom', 1.0);
    useSessionStore.getState().updatePreference('autoSaveEnabled', true);
    useSessionStore.getState().updatePreference('showOnboarding', true);
  });

  describe('recent files', () => {
    it('starts with empty recent files', () => {
      expect(useSessionStore.getState().recentFiles).toEqual([]);
    });

    it('adds a recent file', () => {
      const file = makeRecentFile('C:/docs/test.pdf');
      useSessionStore.getState().addRecentFile(file);
      expect(useSessionStore.getState().recentFiles.length).toBe(1);
      expect(useSessionStore.getState().recentFiles[0].filePath).toBe('C:/docs/test.pdf');
    });

    it('adds most recent file at the beginning', () => {
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/first.pdf'));
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/second.pdf'));
      expect(useSessionStore.getState().recentFiles[0].filePath).toBe('C:/second.pdf');
      expect(useSessionStore.getState().recentFiles[1].filePath).toBe('C:/first.pdf');
    });

    it('deduplicates by file path (moves to top)', () => {
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/a.pdf'));
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/b.pdf'));
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/a.pdf'));
      const files = useSessionStore.getState().recentFiles;
      expect(files.length).toBe(2);
      expect(files[0].filePath).toBe('C:/a.pdf');
    });

    it('limits to 10 recent files', () => {
      for (let i = 0; i < 15; i++) {
        useSessionStore.getState().addRecentFile(makeRecentFile(`C:/file${i}.pdf`));
      }
      expect(useSessionStore.getState().recentFiles.length).toBe(10);
    });

    it('keeps the 10 most recent files when limit exceeded', () => {
      for (let i = 0; i < 12; i++) {
        useSessionStore.getState().addRecentFile(makeRecentFile(`C:/file${i}.pdf`));
      }
      const files = useSessionStore.getState().recentFiles;
      // Most recent (file11) should be first
      expect(files[0].filePath).toBe('C:/file11.pdf');
      // Oldest kept should be file2
      expect(files[9].filePath).toBe('C:/file2.pdf');
    });

    it('removes a recent file by path', () => {
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/a.pdf'));
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/b.pdf'));
      useSessionStore.getState().removeRecentFile('C:/a.pdf');
      const files = useSessionStore.getState().recentFiles;
      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('C:/b.pdf');
    });

    it('clears all recent files', () => {
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/a.pdf'));
      useSessionStore.getState().addRecentFile(makeRecentFile('C:/b.pdf'));
      useSessionStore.getState().clearRecentFiles();
      expect(useSessionStore.getState().recentFiles).toEqual([]);
    });
  });

  describe('preferences', () => {
    it('has default preferences', () => {
      const prefs = useSessionStore.getState().preferences;
      expect(prefs.defaultZoom).toBe(1.0);
      expect(prefs.autoSaveEnabled).toBe(true);
      expect(prefs.showOnboarding).toBe(true);
    });

    it('updates default zoom', () => {
      useSessionStore.getState().updatePreference('defaultZoom', 1.5);
      expect(useSessionStore.getState().preferences.defaultZoom).toBe(1.5);
    });

    it('updates auto-save preference', () => {
      useSessionStore.getState().updatePreference('autoSaveEnabled', false);
      expect(useSessionStore.getState().preferences.autoSaveEnabled).toBe(false);
    });

    it('updates onboarding preference', () => {
      useSessionStore.getState().updatePreference('showOnboarding', false);
      expect(useSessionStore.getState().preferences.showOnboarding).toBe(false);
    });
  });
});
