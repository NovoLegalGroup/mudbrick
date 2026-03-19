/**
 * Tests for FocusTrap component.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FocusTrap } from '../FocusTrap';

describe('FocusTrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <FocusTrap active={false}>
        <button>Button 1</button>
        <button>Button 2</button>
      </FocusTrap>,
    );
    expect(screen.getByText('Button 1')).toBeInTheDocument();
    expect(screen.getByText('Button 2')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <FocusTrap active={false} className="custom-trap">
        <button>Test</button>
      </FocusTrap>,
    );
    expect(container.firstElementChild?.classList.contains('custom-trap')).toBe(true);
  });

  it('renders in a div wrapper', () => {
    const { container } = render(
      <FocusTrap active={true}>
        <button>Focusable</button>
      </FocusTrap>,
    );
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('contains focusable children when active', () => {
    render(
      <FocusTrap active={true}>
        <button>First</button>
        <input type="text" placeholder="Middle" />
        <button>Last</button>
      </FocusTrap>,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Middle')).toBeInTheDocument();
    expect(screen.getByText('Last')).toBeInTheDocument();
  });
});
