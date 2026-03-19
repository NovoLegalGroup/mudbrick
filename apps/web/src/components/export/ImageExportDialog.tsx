import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { useTauri } from '../../hooks/useTauri';
import { api } from '../../services/api';
import {
  actionsStyle,
  dialogBodyStyle,
  errorStyle,
  fieldStyle,
  gridStyle,
  helperTextStyle,
  inputStyle,
  labelStyle,
  previewStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  sectionStyle,
  sectionTitleStyle,
} from '../legal/primitives';

interface ImageExportDialogProps {
  open: boolean;
  onClose: () => void;
}

function parsePages(input: string): number[] {
  if (!input.trim()) return [];

  const pages = new Set<number>();
  for (const part of input.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map((value) => Number(value.trim()));
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        for (let page = min; page <= max; page += 1) {
          pages.add(page);
        }
      }
      continue;
    }

    const page = Number(trimmed);
    if (!Number.isNaN(page)) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export function ImageExportDialog({ open, onClose }: ImageExportDialogProps) {
  const document = useDocumentStore((s) => s.document);
  const currentPage = useDocumentStore((s) => s.currentPage);
  const addToast = useUIStore((s) => s.addToast);
  const { chooseDirectory } = useTauri();

  const [outputDir, setOutputDir] = useState('');
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [dpi, setDpi] = useState(150);
  const [pageMode, setPageMode] = useState<'all' | 'current' | 'custom'>('all');
  const [customPages, setCustomPages] = useState('');
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [exportedFiles, setExportedFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;

    setOutputDir('');
    setFormat('png');
    setDpi(150);
    setPageMode('all');
    setCustomPages('');
    setExporting(false);
    setErrorMessage('');
    setExportedFiles([]);
  }, [open]);

  const handleChooseDirectory = useCallback(async () => {
    const selected = await chooseDirectory();
    if (selected) {
      setOutputDir(selected);
    }
  }, [chooseDirectory]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!document || !outputDir || exporting) return;

      setExporting(true);
      setErrorMessage('');
      setExportedFiles([]);

      try {
        const pages =
          pageMode === 'all'
            ? undefined
            : pageMode === 'current'
              ? [currentPage]
              : parsePages(customPages);

        const result = await api.exportDocumentImages(document.sessionId, {
          output_dir: outputDir,
          format,
          dpi,
          pages,
        });

        setExportedFiles(result.file_paths);
        addToast({
          type: 'success',
          message: `Exported ${result.exported_count} image${result.exported_count !== 1 ? 's' : ''}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export images';
        setErrorMessage(message);
        addToast({ type: 'error', message });
      } finally {
        setExporting(false);
      }
    },
    [addToast, currentPage, customPages, dpi, document, exporting, format, outputDir, pageMode],
  );

  const selectedPages =
    pageMode === 'all'
      ? `All ${document?.pageCount ?? 0} pages`
      : pageMode === 'current'
        ? `Current page ${currentPage}`
        : customPages || 'No pages selected';

  const previewName = `${document?.fileName?.replace(/\.pdf$/i, '') ?? 'document'}_page_001.${format}`;

  return (
    <Modal open={open} onClose={onClose} title="Export to Images">
      <form onSubmit={handleSubmit} style={dialogBodyStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Output</div>
          <div style={gridStyle}>
            <label htmlFor="image-export-dir" style={fieldStyle}>
              <span style={labelStyle}>Output directory</span>
              <input
                id="image-export-dir"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="Choose or type a folder path"
                style={inputStyle}
              />
            </label>
            <div style={fieldStyle}>
              <span style={labelStyle}>Browse</span>
              <button
                type="button"
                onClick={handleChooseDirectory}
                style={{ ...secondaryButtonStyle, height: '36px' }}
              >
                Choose Folder
              </button>
            </div>
            <label htmlFor="image-export-format" style={fieldStyle}>
              <span style={labelStyle}>Format</span>
              <select
                id="image-export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as 'png' | 'jpg')}
                style={inputStyle}
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </label>
            <label htmlFor="image-export-dpi" style={fieldStyle}>
              <span style={labelStyle}>Resolution (DPI)</span>
              <select
                id="image-export-dpi"
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                style={inputStyle}
              >
                <option value={144}>144</option>
                <option value={150}>150</option>
                <option value={200}>200</option>
                <option value={300}>300</option>
              </select>
            </label>
          </div>
          <div style={previewStyle}>
            <strong>Preview filename:</strong> {previewName}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Page Selection</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px' }}>
              <input
                type="radio"
                name="image-export-pages"
                checked={pageMode === 'all'}
                onChange={() => setPageMode('all')}
              />
              All pages
            </label>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px' }}>
              <input
                type="radio"
                name="image-export-pages"
                checked={pageMode === 'current'}
                onChange={() => setPageMode('current')}
              />
              Current page
            </label>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px' }}>
              <input
                type="radio"
                name="image-export-pages"
                checked={pageMode === 'custom'}
                onChange={() => setPageMode('custom')}
              />
              Custom range
            </label>
          </div>
          {pageMode === 'custom' ? (
            <label htmlFor="image-export-pages-custom" style={fieldStyle}>
              <span style={labelStyle}>Pages (e.g. 1,3,5-8)</span>
              <input
                id="image-export-pages-custom"
                value={customPages}
                onChange={(e) => setCustomPages(e.target.value)}
                placeholder={`All pages (1-${document?.pageCount ?? 0})`}
                style={inputStyle}
              />
            </label>
          ) : null}
          <div style={helperTextStyle}>{selectedPages} will be exported as separate image files.</div>
        </div>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

        {exportedFiles.length > 0 ? (
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Exported Files</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {exportedFiles.slice(0, 6).map((filePath) => (
                <div key={filePath} style={helperTextStyle}>
                  {filePath}
                </div>
              ))}
              {exportedFiles.length > 6 ? (
                <div style={helperTextStyle}>...and {exportedFiles.length - 6} more</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={actionsStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {exportedFiles.length > 0 ? 'Done' : 'Cancel'}
          </button>
          {exportedFiles.length === 0 ? (
            <button type="submit" disabled={!document || !outputDir || exporting} style={primaryButtonStyle}>
              {exporting ? 'Exporting...' : 'Export Images'}
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
