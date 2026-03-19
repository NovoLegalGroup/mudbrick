/**
 * Tests for SkipLink component.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from '../SkipLink';

// Mock CSS module
vi.mock('../SkipLink.module.css', () => ({
  default: { skipLink: 'skipLink' },
}));

import { vi } from 'vitest';

describe('SkipLink', () => {
  it('renders a link', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
  });

  it('links to #main-content by default', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link.getAttribute('href')).toBe('#main-content');
  });

  it('uses custom targetId', () => {
    render(<SkipLink targetId="viewer" />);
    const link = screen.getByText('Skip to main content');
    expect(link.getAttribute('href')).toBe('#viewer');
  });

  it('uses custom label', () => {
    render(<SkipLink label="Skip navigation" />);
    expect(screen.getByText('Skip navigation')).toBeInTheDocument();
  });
});
