/**
 * Mudbrick v2 -- Tauri Bridge Service
 *
 * Wraps Tauri API calls for file dialogs, app data paths, window controls.
 * Falls back gracefully when not running inside Tauri (e.g., browser dev mode).
 */

/** Check if running inside a Tauri WebView */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Open a file dialog to select one or more PDF files.
 * Returns an array of local file paths.
 */
export async function openFileDialog(multiple = false): Promise<string[]> {
  if (!isTauri()) {
    // Browser fallback: use standard file input
    return browserFileDialog(multiple);
  }

  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({
    multiple,
    filters: [
      {
        name: 'PDF Documents',
        extensions: ['pdf'],
      },
      {
        name: 'All Files',
        extensions: ['*'],
      },
    ],
  });

  if (!result) return [];
  if (typeof result === 'string') return [result];
  return result;
}

/**
 * Open a save dialog for choosing where to save a file.
 * Returns the chosen file path, or null if cancelled.
 */
export async function saveFileDialog(defaultName = 'document.pdf'): Promise<string | null> {
  if (!isTauri()) {
    // Browser fallback: return a fake path
    return null;
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const result = await save({
    defaultPath: defaultName,
    filters: [
      {
        name: 'PDF Documents',
        extensions: ['pdf'],
      },
    ],
  });

  return result;
}

/**
 * Get the app data directory path (%APPDATA%/mudbrick).
 */
export async function getAppDataDir(): Promise<string | null> {
  if (!isTauri()) return null;

  const { appDataDir } = await import('@tauri-apps/api/path');
  return appDataDir();
}

// -- Browser fallback for file dialog --

function browserFileDialog(multiple: boolean): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.multiple = multiple;

    input.onchange = () => {
      const files = Array.from(input.files || []);
      // In browser mode, we can't get local file paths.
      // Return file names as placeholders.
      resolve(files.map((f) => f.name));
    };

    input.oncancel = () => resolve([]);
    input.click();
  });
}
