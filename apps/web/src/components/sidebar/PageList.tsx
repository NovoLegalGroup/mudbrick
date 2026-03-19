/**
 * Mudbrick v2 -- PageList Component
 *
 * Renders a vertical list of thumbnail items for page navigation.
 * Each item shows a thumbnail image and page number.
 * Click to navigate, supports active page highlighting.
 */

import { memo } from 'react';

export interface PageListItem {
  pageNum: number;
  thumbnailUrl: string | null;
  label?: string;
}

interface PageListProps {
  pages: PageListItem[];
  currentPage: number;
  onPageClick: (pageNum: number) => void;
  /** Whether page operations (drag, context menu) are enabled. Wired up in D4. */
  operationsEnabled?: boolean;
}

export const PageList = memo(function PageList({
  pages,
  currentPage,
  onPageClick,
}: PageListProps) {
  return (
    <div
      role="listbox"
      aria-label="Page thumbnails"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '4px',
      }}
    >
      {pages.map((page) => {
        const isActive = page.pageNum === currentPage;
        return (
          <button
            key={page.pageNum}
            role="option"
            aria-selected={isActive}
            aria-label={`Page ${page.pageNum}`}
            onClick={() => onPageClick(page.pageNum)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px',
              background: 'none',
              border: `2px solid ${isActive ? 'var(--mb-sidebar-thumb-active)' : 'transparent'}`,
              borderRadius: 'var(--mb-radius-sm)',
              cursor: 'pointer',
              transition: 'border-color var(--mb-transition), background-color var(--mb-transition)',
            }}
            onMouseOver={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--mb-surface-hover)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                width: '100%',
                maxWidth: '160px',
                aspectRatio: '8.5 / 11',
                backgroundColor: 'var(--mb-sidebar-thumb-bg)',
                border: `1px solid ${isActive ? 'var(--mb-sidebar-thumb-active)' : 'var(--mb-sidebar-thumb-border)'}`,
                borderRadius: 'var(--mb-radius-xs)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {page.thumbnailUrl ? (
                <img
                  src={page.thumbnailUrl}
                  alt={`Page ${page.pageNum} thumbnail`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                  loading="lazy"
                />
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--mb-text-muted)',
                  }}
                >
                  Loading...
                </span>
              )}
            </div>

            {/* Page number */}
            <span
              style={{
                fontSize: '11px',
                color: isActive ? 'var(--mb-brand)' : 'var(--mb-text-secondary)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {page.label ?? page.pageNum}
            </span>
          </button>
        );
      })}
    </div>
  );
});
