/**
 * Mudbrick v2 -- OutlinePanel Component
 *
 * Displays the PDF document outline/bookmarks if available.
 * Falls back to a "no outline" message.
 */

interface OutlineItem {
  title: string;
  pageNum: number;
  children?: OutlineItem[];
}

interface OutlinePanelProps {
  items: OutlineItem[];
  onNavigate: (pageNum: number) => void;
}

export function OutlinePanel({ items, onNavigate }: OutlinePanelProps) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--mb-text-muted)',
          fontSize: '12px',
        }}
      >
        No outline available for this document.
      </div>
    );
  }

  return (
    <div
      role="tree"
      aria-label="Document outline"
      style={{ padding: '4px' }}
    >
      {items.map((item, idx) => (
        <OutlineNode key={idx} item={item} onNavigate={onNavigate} depth={0} />
      ))}
    </div>
  );
}

function OutlineNode({
  item,
  onNavigate,
  depth,
}: {
  item: OutlineItem;
  onNavigate: (pageNum: number) => void;
  depth: number;
}) {
  return (
    <div role="treeitem">
      <button
        onClick={() => onNavigate(item.pageNum)}
        title={`Go to page ${item.pageNum}`}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: `4px 8px 4px ${8 + depth * 16}px`,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          color: 'var(--mb-text)',
          borderRadius: 'var(--mb-radius-xs)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          transition: 'background-color var(--mb-transition)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--mb-surface-hover)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {item.title}
      </button>
      {item.children && item.children.length > 0 && (
        <div role="group">
          {item.children.map((child, idx) => (
            <OutlineNode
              key={idx}
              item={child}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
