import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import {
  LEGAL_FONT_OPTIONS,
  actionsStyle,
  checkboxRowStyle,
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
  sixZoneGridStyle,
  textareaStyle,
} from './primitives';

interface HeaderFooterDialogProps {
  open: boolean;
  onClose: () => void;
  onApplied?: () => Promise<void> | void;
}

function replacePreviewTokens(
  template: string,
  pageCount: number,
  fileName: string,
): string {
  if (!template.trim()) {
    return '';
  }

  const now = new Date();
  const date = now.toLocaleDateString('en-US');
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return template
    .replaceAll('{page}', '1')
    .replaceAll('{pages}', String(pageCount))
    .replaceAll('{date}', date)
    .replaceAll('{time}', time)
    .replaceAll('{filename}', fileName)
    .replaceAll('{author}', '')
    .replaceAll('{title}', '');
}

export function HeaderFooterDialog({
  open,
  onClose,
  onApplied,
}: HeaderFooterDialogProps) {
  const document = useDocumentStore((s) => s.document);
  const addToast = useUIStore((s) => s.addToast);

  const [topLeft, setTopLeft] = useState('');
  const [topCenter, setTopCenter] = useState('');
  const [topRight, setTopRight] = useState('');
  const [bottomLeft, setBottomLeft] = useState('');
  const [bottomCenter, setBottomCenter] = useState('');
  const [bottomRight, setBottomRight] = useState('{page}/{pages}');
  const [font, setFont] = useState('Helvetica');
  const [fontSize, setFontSize] = useState(10);
  const [color, setColor] = useState('#000000');
  const [margin, setMargin] = useState(0.5);
  const [filename, setFilename] = useState('');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState('');
  const [skipFirst, setSkipFirst] = useState(false);
  const [skipLast, setSkipLast] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [drawLine, setDrawLine] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setTopLeft('');
    setTopCenter('');
    setTopRight('');
    setBottomLeft('');
    setBottomCenter('');
    setBottomRight('{page}/{pages}');
    setFont('Helvetica');
    setFontSize(10);
    setColor('#000000');
    setMargin(0.5);
    setFilename(document?.fileName ?? '');
    setStartPage(1);
    setEndPage('');
    setSkipFirst(false);
    setSkipLast(false);
    setMirror(false);
    setDrawLine(false);
    setErrorMessage('');
  }, [document?.fileName, open]);

  const previewFileName = filename.trim() || document?.fileName || 'document.pdf';
  const previewPageCount = document?.pageCount ?? 1;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!document || submitting) {
        return;
      }

      setSubmitting(true);
      setErrorMessage('');

      try {
        await api.applyHeadersFooters(document.sessionId, {
          top_left: topLeft,
          top_center: topCenter,
          top_right: topRight,
          bottom_left: bottomLeft,
          bottom_center: bottomCenter,
          bottom_right: bottomRight,
          font,
          font_size: fontSize,
          color,
          margin,
          filename: previewFileName,
          start_page: startPage,
          end_page: endPage ? Number(endPage) : 0,
          skip_first: skipFirst,
          skip_last: skipLast,
          mirror,
          draw_line: drawLine,
        });

        addToast({ type: 'success', message: 'Applied headers and footers' });
        await onApplied?.();
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply headers and footers';
        setErrorMessage(message);
        addToast({ type: 'error', message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      addToast,
      bottomCenter,
      bottomLeft,
      bottomRight,
      color,
      document,
      drawLine,
      endPage,
      font,
      fontSize,
      margin,
      mirror,
      onApplied,
      onClose,
      previewFileName,
      skipFirst,
      skipLast,
      startPage,
      submitting,
      topCenter,
      topLeft,
      topRight,
    ],
  );

  return (
    <Modal open={open} onClose={onClose} title="Headers and Footers">
      <form onSubmit={handleSubmit} style={dialogBodyStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Content Zones</div>
          <div style={sixZoneGridStyle}>
            <label htmlFor="hf-top-left" style={fieldStyle}>
              <span style={labelStyle}>Top left</span>
              <textarea id="hf-top-left" value={topLeft} onChange={(e) => setTopLeft(e.target.value)} style={textareaStyle} />
            </label>
            <label htmlFor="hf-top-center" style={fieldStyle}>
              <span style={labelStyle}>Top center</span>
              <textarea id="hf-top-center" value={topCenter} onChange={(e) => setTopCenter(e.target.value)} style={textareaStyle} />
            </label>
            <label htmlFor="hf-top-right" style={fieldStyle}>
              <span style={labelStyle}>Top right</span>
              <textarea id="hf-top-right" value={topRight} onChange={(e) => setTopRight(e.target.value)} style={textareaStyle} />
            </label>
            <label htmlFor="hf-bottom-left" style={fieldStyle}>
              <span style={labelStyle}>Bottom left</span>
              <textarea id="hf-bottom-left" value={bottomLeft} onChange={(e) => setBottomLeft(e.target.value)} style={textareaStyle} />
            </label>
            <label htmlFor="hf-bottom-center" style={fieldStyle}>
              <span style={labelStyle}>Bottom center</span>
              <textarea id="hf-bottom-center" value={bottomCenter} onChange={(e) => setBottomCenter(e.target.value)} style={textareaStyle} />
            </label>
            <label htmlFor="hf-bottom-right" style={fieldStyle}>
              <span style={labelStyle}>Bottom right</span>
              <textarea id="hf-bottom-right" value={bottomRight} onChange={(e) => setBottomRight(e.target.value)} style={textareaStyle} />
            </label>
          </div>
          <div style={helperTextStyle}>
            Tokens: <code>{'{page}'}</code>, <code>{'{pages}'}</code>, <code>{'{date}'}</code>,{' '}
            <code>{'{time}'}</code>, <code>{'{filename}'}</code>, <code>{'{author}'}</code>,{' '}
            <code>{'{title}'}</code>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Preview</div>
          <div style={previewStyle}>
            <div><strong>Top left:</strong> {replacePreviewTokens(topLeft, previewPageCount, previewFileName) || '—'}</div>
            <div><strong>Top center:</strong> {replacePreviewTokens(topCenter, previewPageCount, previewFileName) || '—'}</div>
            <div><strong>Top right:</strong> {replacePreviewTokens(topRight, previewPageCount, previewFileName) || '—'}</div>
            <div><strong>Bottom left:</strong> {replacePreviewTokens(bottomLeft, previewPageCount, previewFileName) || '—'}</div>
            <div><strong>Bottom center:</strong> {replacePreviewTokens(bottomCenter, previewPageCount, previewFileName) || '—'}</div>
            <div><strong>Bottom right:</strong> {replacePreviewTokens(bottomRight, previewPageCount, previewFileName) || '—'}</div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Formatting and Range</div>
          <div style={gridStyle}>
            <label htmlFor="hf-font" style={fieldStyle}>
              <span style={labelStyle}>Font</span>
              <select id="hf-font" value={font} onChange={(e) => setFont(e.target.value)} style={inputStyle}>
                {LEGAL_FONT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="hf-font-size" style={fieldStyle}>
              <span style={labelStyle}>Font size</span>
              <input
                id="hf-font-size"
                type="number"
                min={6}
                max={48}
                step={0.5}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value) || 10)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="hf-color" style={fieldStyle}>
              <span style={labelStyle}>Color</span>
              <input
                id="hf-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ ...inputStyle, padding: '6px 10px' }}
              />
            </label>
            <label htmlFor="hf-margin" style={fieldStyle}>
              <span style={labelStyle}>Margin (inches)</span>
              <input
                id="hf-margin"
                type="number"
                min={0}
                max={3}
                step={0.05}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="hf-filename" style={fieldStyle}>
              <span style={labelStyle}>Filename token value</span>
              <input
                id="hf-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="hf-start-page" style={fieldStyle}>
              <span style={labelStyle}>Start page</span>
              <input
                id="hf-start-page"
                type="number"
                min={1}
                max={document?.pageCount ?? 1}
                value={startPage}
                onChange={(e) => setStartPage(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="hf-end-page" style={fieldStyle}>
              <span style={labelStyle}>End page</span>
              <input
                id="hf-end-page"
                type="number"
                min={startPage}
                max={document?.pageCount ?? 1}
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
                placeholder={`All pages (${document?.pageCount ?? 0})`}
                style={inputStyle}
              />
            </label>
          </div>
          <label htmlFor="hf-skip-first" style={checkboxRowStyle}>
            <input id="hf-skip-first" type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} />
            Skip first page
          </label>
          <label htmlFor="hf-skip-last" style={checkboxRowStyle}>
            <input id="hf-skip-last" type="checkbox" checked={skipLast} onChange={(e) => setSkipLast(e.target.checked)} />
            Skip last page
          </label>
          <label htmlFor="hf-mirror" style={checkboxRowStyle}>
            <input id="hf-mirror" type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
            Mirror left and right content on even pages
          </label>
          <label htmlFor="hf-draw-line" style={checkboxRowStyle}>
            <input id="hf-draw-line" type="checkbox" checked={drawLine} onChange={(e) => setDrawLine(e.target.checked)} />
            Draw separator line above headers and below footers
          </label>
        </div>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

        <div style={actionsStyle}>
          <button type="button" onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button type="submit" disabled={!document || submitting} style={primaryButtonStyle}>
            {submitting ? 'Applying...' : 'Apply Headers/Footers'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
