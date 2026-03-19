/**
 * Tests for DropZone component.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropZone } from '../DropZone';

describe('DropZone', () => {
  const onFileDrop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Drop files here</p>
      </DropZone>,
    );
    expect(screen.getByText('Drop files here')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Content</p>
      </DropZone>,
    );
    expect(screen.getByLabelText('Drop PDF files here')).toBeInTheDocument();
  });

  it('shows drag-over state on dragEnter', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Content</p>
      </DropZone>,
    );
    const zone = screen.getByLabelText('Drop PDF files here');
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(zone.classList.contains('dropzone--active')).toBe(true);
  });

  it('removes drag-over state on dragLeave', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Content</p>
      </DropZone>,
    );
    const zone = screen.getByLabelText('Drop PDF files here');
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    fireEvent.dragLeave(zone, { dataTransfer: { files: [] } });
    expect(zone.classList.contains('dropzone--active')).toBe(false);
  });

  it('calls onFileDrop with PDF file names on drop', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Content</p>
      </DropZone>,
    );
    const zone = screen.getByLabelText('Drop PDF files here');

    const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    const dataTransfer = {
      files: [pdfFile],
      items: [],
      types: ['Files'],
    };

    fireEvent.drop(zone, { dataTransfer });
    expect(onFileDrop).toHaveBeenCalledTimes(1);
  });

  it('filters out non-PDF files', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Content</p>
      </DropZone>,
    );
    const zone = screen.getByLabelText('Drop PDF files here');

    const txtFile = new File([''], 'readme.txt', { type: 'text/plain' });
    const dataTransfer = {
      files: [txtFile],
      items: [],
      types: ['Files'],
    };

    fireEvent.drop(zone, { dataTransfer });
    expect(onFileDrop).not.toHaveBeenCalled();
  });

  it('does not call onFileDrop when disabled', () => {
    render(
      <DropZone onFileDrop={onFileDrop} disabled>
        <p>Content</p>
      </DropZone>,
    );
    const zone = screen.getByLabelText('Drop PDF files here');

    const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    const dataTransfer = {
      files: [pdfFile],
      items: [],
      types: ['Files'],
    };

    fireEvent.drop(zone, { dataTransfer });
    expect(onFileDrop).not.toHaveBeenCalled();
  });

  it('shows overlay text during drag-over', () => {
    render(
      <DropZone onFileDrop={onFileDrop}>
        <p>Content</p>
      </DropZone>,
    );
    const zone = screen.getByLabelText('Drop PDF files here');
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(screen.getByText('Drop PDF here')).toBeInTheDocument();
  });
});
