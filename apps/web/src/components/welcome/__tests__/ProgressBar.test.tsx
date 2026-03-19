/**
 * Tests for ProgressBar component.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders a progressbar role element', () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows correct percentage value', () => {
    render(<ProgressBar value={75} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('75');
  });

  it('has aria-valuemin and aria-valuemax', () => {
    render(<ProgressBar value={50} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('clamps value to 0-100', () => {
    render(<ProgressBar value={150} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps negative value to 0', () => {
    render(<ProgressBar value={-10} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('shows label when showLabel is true', () => {
    render(<ProgressBar value={42} showLabel />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('does not show label by default', () => {
    render(<ProgressBar value={42} />);
    expect(screen.queryByText('42%')).not.toBeInTheDocument();
  });

  it('does not show label for indeterminate mode', () => {
    render(<ProgressBar showLabel />);
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('renders in indeterminate mode when no value', () => {
    render(<ProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
  });

  it('shows 0% at zero', () => {
    render(<ProgressBar value={0} showLabel />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% at completion', () => {
    render(<ProgressBar value={100} showLabel />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
