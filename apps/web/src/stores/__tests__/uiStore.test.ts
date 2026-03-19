/**
 * Tests for UI store: modals, sidebar, theme, toasts.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  describe('sidebar', () => {
    it('starts open', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('toggles sidebar', () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('sets sidebar open state directly', () => {
      useUIStore.getState().setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it('starts with pages tab', () => {
      expect(useUIStore.getState().sidebarTab).toBe('pages');
    });

    it('switches sidebar tab', () => {
      useUIStore.getState().setSidebarTab('outline');
      expect(useUIStore.getState().sidebarTab).toBe('outline');
    });
  });

  describe('panels', () => {
    it('starts with panel closed', () => {
      expect(useUIStore.getState().panelOpen).toBe(false);
      expect(useUIStore.getState().activePanel).toBeNull();
    });

    it('toggles panel open', () => {
      useUIStore.getState().togglePanel('properties');
      expect(useUIStore.getState().panelOpen).toBe(true);
      expect(useUIStore.getState().activePanel).toBe('properties');
    });

    it('closes panel on second toggle of same panel', () => {
      useUIStore.getState().togglePanel('properties');
      useUIStore.getState().togglePanel('properties');
      expect(useUIStore.getState().panelOpen).toBe(false);
      expect(useUIStore.getState().activePanel).toBeNull();
    });

    it('switches panel when different panel is toggled', () => {
      useUIStore.getState().togglePanel('properties');
      useUIStore.getState().togglePanel('redaction');
      expect(useUIStore.getState().panelOpen).toBe(true);
      expect(useUIStore.getState().activePanel).toBe('redaction');
    });
  });

  describe('modals', () => {
    it('starts with no modal', () => {
      expect(useUIStore.getState().activeModal).toBeNull();
    });

    it('opens a modal', () => {
      useUIStore.getState().openModal('export');
      expect(useUIStore.getState().activeModal).toBe('export');
    });

    it('closes modal', () => {
      useUIStore.getState().openModal('export');
      useUIStore.getState().closeModal();
      expect(useUIStore.getState().activeModal).toBeNull();
    });
  });

  describe('theme', () => {
    it('starts with light theme', () => {
      expect(useUIStore.getState().theme).toBe('light');
    });

    it('sets theme directly', () => {
      useUIStore.getState().setTheme('dark');
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('toggles theme', () => {
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('dark');
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('light');
    });
  });

  describe('toasts', () => {
    it('starts with no toasts', () => {
      expect(useUIStore.getState().toasts).toEqual([]);
    });

    it('adds a toast', () => {
      useUIStore.getState().addToast({ type: 'success', message: 'Saved!' });
      const toasts = useUIStore.getState().toasts;
      expect(toasts.length).toBe(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('Saved!');
      expect(toasts[0].id).toBeTruthy();
    });

    it('adds multiple toasts', () => {
      useUIStore.getState().addToast({ type: 'success', message: 'One' });
      useUIStore.getState().addToast({ type: 'error', message: 'Two' });
      expect(useUIStore.getState().toasts.length).toBe(2);
    });

    it('removes a toast by id', () => {
      useUIStore.getState().addToast({ type: 'info', message: 'Test' });
      const id = useUIStore.getState().toasts[0].id;
      useUIStore.getState().removeToast(id);
      expect(useUIStore.getState().toasts.length).toBe(0);
    });

    it('assigns unique ids to toasts', () => {
      useUIStore.getState().addToast({ type: 'info', message: 'A' });
      useUIStore.getState().addToast({ type: 'info', message: 'B' });
      const [a, b] = useUIStore.getState().toasts;
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('fullscreen', () => {
    it('starts not fullscreen', () => {
      expect(useUIStore.getState().fullscreen).toBe(false);
    });

    it('sets fullscreen', () => {
      useUIStore.getState().setFullscreen(true);
      expect(useUIStore.getState().fullscreen).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all state', () => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().openModal('export');
      useUIStore.getState().setTheme('dark');
      useUIStore.getState().addToast({ type: 'info', message: 'Test' });
      useUIStore.getState().setFullscreen(true);

      useUIStore.getState().reset();

      const state = useUIStore.getState();
      expect(state.sidebarOpen).toBe(true);
      expect(state.activeModal).toBeNull();
      expect(state.theme).toBe('light');
      expect(state.toasts).toEqual([]);
      expect(state.fullscreen).toBe(false);
    });
  });
});
