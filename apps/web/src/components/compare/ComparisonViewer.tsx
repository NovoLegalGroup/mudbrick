/**
 * Mudbrick v2 -- Document Comparison Viewer
 *
 * Side-by-side comparison: select a second PDF, compare page-level diffs.
 * Shows change indicators per page (green=added, red=deleted, yellow=modified).
 */

import { useCallback, useState } from 'react';
import { api } from '../../services/api';
import { useDocumentStore } from '../../stores/documentStore';
import { useTauri } from '../../hooks/useTauri';
import type { CompareResponse, PageChangeItem } from '../../types/api';
import styles from './ComparisonViewer.module.css';

interface ComparisonViewerProps {
  open: boolean;
  onClose: () => void;
}

export function ComparisonViewer({ open, onClose }: ComparisonViewerProps) {
  const document = useDocumentStore((s) => s.document);
  const { openFile } = useTauri();

  const [comparisonPath, setComparisonPath] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = useCallback(async () => {
    const path = await openFile();
    if (path) {
      setComparisonPath(path);
      setResult(null);
      setError(null);
    }
  }, [openFile]);

  const handleCompare = useCallback(async () => {
    if (!document || !comparisonPath) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await api.compareDocuments(document.filePath, comparisonPath);
      setResult(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }, [document, comparisonPath]);

  const handleClose = useCallback(() => {
    setResult(null);
    setComparisonPath(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const comparisonFileName = comparisonPath?.split(/[/\\]/).pop() ?? '';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Document Comparison</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            x
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.controls}>
            <div className={styles.fileInput}>
              <label>Original:</label>
              <span className={styles.fileName}>{document?.fileName ?? 'No document'}</span>
            </div>

            <div className={styles.fileInput}>
              <label>Compare with:</label>
              <button className={styles.browseBtn} onClick={handleBrowse}>
                Browse...
              </button>
              {comparisonFileName && (
                <span className={styles.fileName}>{comparisonFileName}</span>
              )}
            </div>

            <button
              className={styles.compareBtn}
              onClick={handleCompare}
              disabled={!comparisonPath || loading}
            >
              {loading ? 'Comparing...' : 'Compare'}
            </button>
          </div>

          {error && (
            <div style={{ color: 'var(--mb-danger)', fontSize: '13px' }}>{error}</div>
          )}

          {loading && (
            <div className={styles.loading}>Comparing documents page by page...</div>
          )}

          {result && !loading && (
            <>
              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <span className={`${styles.badge} ${styles.badgeAdded}`}>
                    {result.summary.added}
                  </span>
                  Added
                </div>
                <div className={styles.summaryItem}>
                  <span className={`${styles.badge} ${styles.badgeDeleted}`}>
                    {result.summary.deleted}
                  </span>
                  Deleted
                </div>
                <div className={styles.summaryItem}>
                  <span className={`${styles.badge} ${styles.badgeModified}`}>
                    {result.summary.modified}
                  </span>
                  Modified
                </div>
                <div className={styles.summaryItem}>
                  <span className={`${styles.badge} ${styles.badgeUnchanged}`}>
                    {result.summary.unchanged}
                  </span>
                  Unchanged
                </div>
              </div>

              <div className={styles.changesList}>
                {result.changes.map((change) => (
                  <div key={change.page} className={styles.changeRow}>
                    <span className={styles.pageNum}>Page {change.page}</span>
                    <span
                      className={`${styles.changeType} ${
                        change.type === 'added'
                          ? styles.typeAdded
                          : change.type === 'deleted'
                            ? styles.typeDeleted
                            : change.type === 'modified'
                              ? styles.typeModified
                              : styles.typeUnchanged
                      }`}
                    >
                      {change.type}
                    </span>
                    {change.type === 'modified' && (
                      <span className={styles.diffScore}>
                        {(change.diff_score * 100).toFixed(1)}% different
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {!result && !loading && !error && (
            <div className={styles.emptyState}>
              Select a PDF to compare with the current document
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
