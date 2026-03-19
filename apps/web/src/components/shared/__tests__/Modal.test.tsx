/**
 * Tests for Modal component.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders content when open', () => {
    render(
      <Modal open={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal open={true} onClose={onClose} title="Test Title">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders close button with title', () => {
    render(
      <Modal open={true} onClose={onClose} title="Title">
        <p>Content</p>
      </Modal>,
    );
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <Modal open={true} onClose={onClose} title="Title">
        <p>Content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop (dialog element) is clicked', () => {
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    // Click on the dialog element itself (backdrop)
    const dialog = document.querySelector('dialog');
    if (dialog) {
      fireEvent.click(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('does not call onClose when content is clicked', () => {
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText('Content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <Modal open={true} onClose={onClose} className="custom-modal">
        <p>Content</p>
      </Modal>,
    );
    const dialog = document.querySelector('dialog');
    expect(dialog?.classList.contains('custom-modal')).toBe(true);
  });

  it('has aria-labelledby when title provided', () => {
    render(
      <Modal open={true} onClose={onClose} title="Accessible Title">
        <p>Content</p>
      </Modal>,
    );
    const dialog = document.querySelector('dialog');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('modal-title');
  });

  it('does not have aria-labelledby when no title', () => {
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = document.querySelector('dialog');
    expect(dialog?.getAttribute('aria-labelledby')).toBeNull();
  });
});
