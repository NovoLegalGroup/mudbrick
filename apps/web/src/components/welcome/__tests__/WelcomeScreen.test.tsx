/**
 * Tests for WelcomeScreen component.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { useSessionStore } from '../../../stores/sessionStore';
import { useUIStore } from '../../../stores/uiStore';

// Mock the Tauri hook
vi.mock('../../../hooks/useTauri', () => ({
  useTauri: () => ({
    openFile: vi.fn().mockResolvedValue(null),
    saveFile: vi.fn(),
    isTauri: false,
  }),
}));

// Mock UpdatePanel to avoid Tauri deps
vi.mock('../../shared/UpdatePanel', () => ({
  UpdatePanel: () => null,
}));

describe('WelcomeScreen', () => {
  const onOpenFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().clearRecentFiles();
    useUIStore.getState().reset();
  });

  it('renders the title', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.getByText('Mudbrick')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.getByText('PDF Editor for Desktop')).toBeInTheDocument();
  });

  it('renders Open PDF button', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.getByText('Open PDF')).toBeInTheDocument();
  });

  it('renders drag-and-drop hint', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.getByText('Drag and drop a PDF here')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.getByText('Ctrl+O')).toBeInTheDocument();
  });

  it('disables Open PDF button when loading', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={true} />);
    const btn = screen.getByText('Open PDF');
    expect(btn).toBeDisabled();
  });

  it('does not show recent files when empty', () => {
    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.queryByText('Recent Files')).not.toBeInTheDocument();
  });

  it('shows recent files section when files exist', () => {
    useSessionStore.getState().addRecentFile({
      filePath: 'C:/docs/test.pdf',
      fileName: 'test.pdf',
      fileSize: 1024,
      pageCount: 5,
      openedAt: new Date().toISOString(),
    });

    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    expect(screen.getByText('Recent Files')).toBeInTheDocument();
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('calls onOpenFile when recent file is clicked', () => {
    useSessionStore.getState().addRecentFile({
      filePath: 'C:/docs/test.pdf',
      fileName: 'test.pdf',
      fileSize: 1024,
      pageCount: 5,
      openedAt: new Date().toISOString(),
    });

    render(<WelcomeScreen onOpenFile={onOpenFile} loading={false} />);
    fireEvent.click(screen.getByText('test.pdf'));
    expect(onOpenFile).toHaveBeenCalledWith('C:/docs/test.pdf');
  });
});
