/**
 * Mudbrick v2 -- Security Panel
 *
 * Tabs: Encrypt (password + permissions), Metadata (view/edit), Sanitize (strip all).
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import type { MetadataResponse } from '../../types/api';
import styles from './SecurityPanel.module.css';

type SecurityTab = 'encrypt' | 'metadata' | 'sanitize';

interface SecurityPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SecurityPanel({ open, onClose }: SecurityPanelProps) {
  const document = useDocumentStore((s) => s.document);
  const addToast = useUIStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<SecurityTab>('encrypt');

  // Encrypt state
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowModify, setAllowModify] = useState(false);
  const [allowAnnotate, setAllowAnnotate] = useState(true);
  const [encrypting, setEncrypting] = useState(false);

  // Metadata state
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaAuthor, setMetaAuthor] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Sanitize state
  const [sanitizeResult, setSanitizeResult] = useState<string[] | null>(null);
  const [sanitizing, setSanitizing] = useState(false);

  // Load metadata when tab switches
  useEffect(() => {
    if (open && document && activeTab === 'metadata' && !metadata) {
      api.getSecurityMetadata(document.sessionId).then((meta) => {
        setMetadata(meta);
        setMetaTitle(meta.title);
        setMetaAuthor(meta.author);
        setMetaSubject(meta.subject);
        setMetaKeywords(meta.keywords);
      }).catch(() => {
        // ignore
      });
    }
  }, [open, document, activeTab, metadata]);

  const handleEncrypt = useCallback(async () => {
    if (!document || !ownerPassword) return;
    setEncrypting(true);
    try {
      await api.encryptDocument(document.sessionId, {
        user_password: userPassword,
        owner_password: ownerPassword,
        allow_print: allowPrint,
        allow_copy: allowCopy,
        allow_modify: allowModify,
        allow_annotate: allowAnnotate,
      });
      addToast({ type: 'success', message: 'Document encrypted successfully' });
      setOwnerPassword('');
      setUserPassword('');
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Encryption failed',
      });
    } finally {
      setEncrypting(false);
    }
  }, [document, ownerPassword, userPassword, allowPrint, allowCopy, allowModify, allowAnnotate, addToast]);

  const handleSaveMetadata = useCallback(async () => {
    if (!document) return;
    setSavingMeta(true);
    try {
      await api.updateSecurityMetadata(document.sessionId, {
        title: metaTitle,
        author: metaAuthor,
        subject: metaSubject,
        keywords: metaKeywords,
      });
      addToast({ type: 'success', message: 'Metadata updated' });
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update metadata',
      });
    } finally {
      setSavingMeta(false);
    }
  }, [document, metaTitle, metaAuthor, metaSubject, metaKeywords, addToast]);

  const handleSanitize = useCallback(async () => {
    if (!document) return;
    setSanitizing(true);
    setSanitizeResult(null);
    try {
      const resp = await api.sanitizeDocument(document.sessionId);
      setSanitizeResult(resp.removed);
      addToast({ type: 'success', message: 'Document sanitized' });
      // Reset metadata cache since it was stripped
      setMetadata(null);
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Sanitization failed',
      });
    } finally {
      setSanitizing(false);
    }
  }, [document, addToast]);

  const handleClose = useCallback(() => {
    setSanitizeResult(null);
    setMetadata(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Security</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            x
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'encrypt' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('encrypt')}
          >
            Encrypt
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'metadata' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            Metadata
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'sanitize' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('sanitize')}
          >
            Sanitize
          </button>
        </div>

        <div className={styles.body}>
          {activeTab === 'encrypt' && (
            <div className={styles.section}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Owner Password (required)</label>
                <input
                  className={styles.fieldInput}
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Password for permission control"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>User Password (optional)</label>
                <input
                  className={styles.fieldInput}
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Password to open the PDF"
                />
                <span className={styles.hint}>
                  Leave empty to allow opening without a password
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Permissions</label>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={allowPrint}
                      onChange={(e) => setAllowPrint(e.target.checked)}
                    />
                    Allow printing
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={allowCopy}
                      onChange={(e) => setAllowCopy(e.target.checked)}
                    />
                    Allow copying text
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={allowModify}
                      onChange={(e) => setAllowModify(e.target.checked)}
                    />
                    Allow modifying
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={allowAnnotate}
                      onChange={(e) => setAllowAnnotate(e.target.checked)}
                    />
                    Allow annotations
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className={styles.section}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Title</label>
                <input
                  className={styles.fieldInput}
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Document title"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Author</label>
                <input
                  className={styles.fieldInput}
                  value={metaAuthor}
                  onChange={(e) => setMetaAuthor(e.target.value)}
                  placeholder="Document author"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Subject</label>
                <input
                  className={styles.fieldInput}
                  value={metaSubject}
                  onChange={(e) => setMetaSubject(e.target.value)}
                  placeholder="Document subject"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Keywords</label>
                <input
                  className={styles.fieldInput}
                  value={metaKeywords}
                  onChange={(e) => setMetaKeywords(e.target.value)}
                  placeholder="Comma-separated keywords"
                />
              </div>

              {metadata && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Creator</label>
                    <span className={styles.metadataReadonly}>{metadata.creator || '(none)'}</span>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Producer</label>
                    <span className={styles.metadataReadonly}>{metadata.producer || '(none)'}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'sanitize' && (
            <div className={styles.section}>
              <p style={{ fontSize: '13px', color: 'var(--mb-text-secondary)', margin: 0 }}>
                Remove all metadata, XMP data, JavaScript, and hidden content from the document.
                This cannot be undone.
              </p>

              {sanitizeResult && (
                <div className={styles.sanitizeReport}>
                  <span className={styles.successMsg}>Sanitization complete. Removed:</span>
                  {sanitizeResult.map((item, i) => (
                    <div key={i} className={styles.sanitizeItem}>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={handleClose}>
            Cancel
          </button>

          {activeTab === 'encrypt' && (
            <button
              className={styles.primaryBtn}
              onClick={handleEncrypt}
              disabled={encrypting || !ownerPassword}
            >
              {encrypting ? 'Encrypting...' : 'Encrypt'}
            </button>
          )}

          {activeTab === 'metadata' && (
            <button
              className={styles.primaryBtn}
              onClick={handleSaveMetadata}
              disabled={savingMeta}
            >
              {savingMeta ? 'Saving...' : 'Save Metadata'}
            </button>
          )}

          {activeTab === 'sanitize' && (
            <button
              className={styles.dangerBtn}
              onClick={handleSanitize}
              disabled={sanitizing}
            >
              {sanitizing ? 'Sanitizing...' : 'Sanitize Document'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
