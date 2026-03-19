/**
 * Mudbrick v2 -- UI Store (Zustand)
 *
 * Manages UI state: sidebar, panels, modals, theme, toasts.
 */

import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface UIState {
  /** Whether the sidebar is open */
  sidebarOpen: boolean;

  /** Currently active sidebar tab */
  sidebarTab: 'pages' | 'outline';

  /** Whether a right panel is open (e.g., properties, redaction) */
  panelOpen: boolean;

  /** Which panel is active */
  activePanel: string | null;

  /** Current modal (null = none) */
  activeModal: string | null;

  /** Theme: 'light' | 'dark' */
  theme: 'light' | 'dark';

  /** Toast messages queue */
  toasts: ToastMessage[];

  /** Whether the app is in fullscreen mode */
  fullscreen: boolean;

  /** Actions */
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: 'pages' | 'outline') => void;
  togglePanel: (panel?: string) => void;
  setPanelOpen: (open: boolean, panel?: string) => void;
  openModal: (modal: string) => void;
  closeModal: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  setFullscreen: (fs: boolean) => void;
  reset: () => void;
}

let toastIdCounter = 0;

const initialState = {
  sidebarOpen: true,
  sidebarTab: 'pages' as const,
  panelOpen: false,
  activePanel: null as string | null,
  activeModal: null as string | null,
  theme: 'light' as const,
  toasts: [] as ToastMessage[],
  fullscreen: false,
};

export const useUIStore = create<UIState>((set) => ({
  ...initialState,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  togglePanel: (panel) =>
    set((s) => {
      if (s.panelOpen && s.activePanel === panel) {
        return { panelOpen: false, activePanel: null };
      }
      return { panelOpen: true, activePanel: panel ?? null };
    }),

  setPanelOpen: (open, panel) =>
    set({
      panelOpen: open,
      activePanel: open ? panel ?? null : null,
    }),

  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

  addToast: (toast) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { ...toast, id: `toast-${++toastIdCounter}` },
      ],
    })),

  removeToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  setFullscreen: (fs) => set({ fullscreen: fs }),

  reset: () => set(initialState),
}));
