import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useTauri } from '../../hooks/useTauri';
import { useUIStore } from '../../stores/uiStore';
import type { AttachmentInfo } from '../../types/api';

interface AttachmentsPanelProps {
  sessionId: string;
  onDocumentUpdated?: () => void | Promise<void>;
}

const actionButtonStyle = {
  padding: '4px 8px',
  border: '1px solid var(--mb-border)',
  borderRadius: 'var(--mb-radius-xs)',
  background: 'var(--mb-surface)',
  color: 'var(--mb-text)',
  fontSize: '11px',
  cursor: 'pointer',
} as const;

export function AttachmentsPanel({ sessionId, onDocumentUpdated }: AttachmentsPanelProps) {
  const { openAnyFiles, chooseAnySavePath } = useTauri();
  const addToast = useUIStore((s) => s.addToast);

  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyName, setBusyName] = useState<string | null>(null);

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listAttachments(sessionId);
      setAttachments(response.attachments);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load attachments';
      addToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, [addToast, sessionId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const notifyDocumentUpdated = useCallback(async () => {
    await onDocumentUpdated?.();
  }, [onDocumentUpdated]);

  const handleAddAttachments = useCallback(async () => {
    const paths = await openAnyFiles();
    if (paths.length === 0) return;

    setBusyName('__add__');
    try {
      const response = await api.addAttachments(sessionId, paths);
      await loadAttachments();
      await notifyDocumentUpdated();
      addToast({
        type: 'success',
        message: `Added ${response.attachments_added} attachment${response.attachments_added !== 1 ? 's' : ''}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add attachments';
      addToast({ type: 'error', message });
    } finally {
      setBusyName(null);
    }
  }, [addToast, loadAttachments, notifyDocumentUpdated, openAnyFiles, sessionId]);

  const handleExportAttachment = useCallback(
    async (attachment: AttachmentInfo) => {
      const savePath = await chooseAnySavePath(attachment.file_name || attachment.name);
      if (!savePath) return;

      setBusyName(attachment.name);
      try {
        await api.exportAttachment(sessionId, attachment.name, savePath);
        addToast({ type: 'success', message: `Saved ${attachment.file_name}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save attachment';
        addToast({ type: 'error', message });
      } finally {
        setBusyName(null);
      }
    },
    [addToast, chooseAnySavePath, sessionId],
  );

  const handleDeleteAttachment = useCallback(
    async (attachment: AttachmentInfo) => {
      if (!window.confirm(`Remove attachment "${attachment.file_name}" from this PDF?`)) {
        return;
      }

      setBusyName(attachment.name);
      try {
        await api.deleteAttachment(sessionId, attachment.name);
        await loadAttachments();
        await notifyDocumentUpdated();
        addToast({ type: 'success', message: `Removed ${attachment.file_name}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove attachment';
        addToast({ type: 'error', message });
      } finally {
        setBusyName(null);
      }
    },
    [addToast, loadAttachments, notifyDocumentUpdated, sessionId],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mb-text)' }}>
            Attachments
          </div>
          <div style={{ fontSize: '11px', color: 'var(--mb-text-muted)' }}>
            Embed supporting files into the PDF.
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddAttachments}
          disabled={loading || busyName !== null}
          style={actionButtonStyle}
        >
          Add Files
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '12px', color: 'var(--mb-text-muted)' }}>
          Loading attachments...
        </div>
      ) : attachments.length === 0 ? (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--mb-text-muted)',
            padding: '12px',
            border: '1px dashed var(--mb-border)',
            borderRadius: 'var(--mb-radius-sm)',
          }}
        >
          No attachments yet. Add files to embed them in the document.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {attachments.map((attachment) => {
            const isBusy = busyName === attachment.name;
            return (
              <div
                key={attachment.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '10px',
                  background: 'var(--mb-surface)',
                  border: '1px solid var(--mb-border)',
                  borderRadius: 'var(--mb-radius-sm)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--mb-text)',
                      wordBreak: 'break-word',
                    }}
                    title={attachment.file_name}
                  >
                    {attachment.file_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--mb-text-muted)' }}>
                    {formatFileSize(attachment.size)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleExportAttachment(attachment)}
                    disabled={isBusy || busyName === '__add__'}
                    style={actionButtonStyle}
                  >
                    Save As
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(attachment)}
                    disabled={isBusy || busyName === '__add__'}
                    style={actionButtonStyle}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
