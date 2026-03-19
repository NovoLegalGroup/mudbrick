/**
 * Mudbrick v2 -- Tauri Hook
 *
 * Provides Tauri-specific functionality (file dialogs, window controls)
 * with graceful fallback when running in browser dev mode.
 */

import { useCallback } from 'react';
import {
  isTauri,
  openDirectoryDialog,
  openFileDialog,
  saveFileDialog,
} from '../services/tauriBridge';

export function useTauri() {
  const isDesktop = isTauri();

  const openFile = useCallback(async (): Promise<string | null> => {
    const paths = await openFileDialog(false);
    return paths.length > 0 ? paths[0] : null;
  }, []);

  const openMultipleFiles = useCallback(async (): Promise<string[]> => {
    return openFileDialog(true);
  }, []);

  const chooseSavePath = useCallback(
    async (defaultName = 'document.pdf'): Promise<string | null> => {
      return saveFileDialog(defaultName);
    },
    [],
  );

  const chooseDirectory = useCallback(async (): Promise<string | null> => {
    return openDirectoryDialog();
  }, []);

  return {
    isDesktop,
    openFile,
    openMultipleFiles,
    chooseSavePath,
    chooseDirectory,
  };
}
