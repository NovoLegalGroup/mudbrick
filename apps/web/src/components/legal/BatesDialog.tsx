import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import {
  BATES_POSITION_OPTIONS,
  LEGAL_FONT_OPTIONS,
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
} from './primitives';

interface BatesDialogProps {
  open: boolean;
  onClose: () => void;
  onApplied?: () => Promise<void> | void;
}

export function BatesDialog({ open, onClose, onApplied }: BatesDialogProps) {
  const document = useDocumentStore((s) => s.document);
  const addToast = useUIStore((s) => s.addToast);

  const [prefix, setPrefix] = useState('MB-');
  const [suffix, setSuffix] = useState('');
  const [startNum, setStartNum] = useState(1);
  const [zeroPad, setZeroPad] = useState(4);
  const [position, setPosition] = useState('bottom-right');
  const [font, setFont] = useState('Helvetica');
  const [fontSize, setFontSize] = useState(10);
  const [color, setColor] = useState('#000000');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState('');
  const [margin, setMargin] = useState(0.5);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setPrefix('MB-');
    setSuffix('');
    setStartNum(1);
    setZeroPad(4);
    setPosition('bottom-right');
    setFont('Helvetica');
    setFontSize(10);
    setColor('#000000');
    setStartPage(1);
    setEndPage('');
    setMargin(0.5);
    setErrorMessage('');
  }, [open]);

  const previewLabel = `${prefix}${String(startNum).padStart(Math.max(1, zeroPad), '0')}${suffix}`;
  const finalPage = endPage ? Number(endPage) : document?.pageCount ?? 0;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!document || submitting) {
        return;
      }

      setSubmitting(true);
      setErrorMessage('');

      try {
        const result = await api.applyBatesNumbers(document.sessionId, {
          prefix,
          suffix,
          start_num: startNum,
          zero_pad: zeroPad,
          position,
          font,
          font_size: fontSize,
          color,
          start_page: startPage,
          end_page: endPage ? Number(endPage) : 0,
          margin,
        });

        const labelRange =
          result.first_label && result.last_label
            ? `${result.first_label} - ${result.last_label}`
            : 'Applied Bates numbers';

        addToast({ type: 'success', message: labelRange });
        await onApplied?.();
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply Bates numbers';
        setErrorMessage(message);
        addToast({ type: 'error', message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      addToast,
      color,
      document,
      endPage,
      font,
      fontSize,
      margin,
      onApplied,
      onClose,
      position,
      prefix,
      startNum,
      startPage,
      submitting,
      suffix,
      zeroPad,
    ],
  );

  return (
    <Modal open={open} onClose={onClose} title="Bates Numbering">
      <form onSubmit={handleSubmit} style={dialogBodyStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Number Format</div>
          <div style={gridStyle}>
            <label htmlFor="bates-prefix" style={fieldStyle}>
              <span style={labelStyle}>Prefix</span>
              <input
                id="bates-prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="bates-suffix" style={fieldStyle}>
              <span style={labelStyle}>Suffix</span>
              <input
                id="bates-suffix"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="bates-start-num" style={fieldStyle}>
              <span style={labelStyle}>Starting number</span>
              <input
                id="bates-start-num"
                type="number"
                min={1}
                value={startNum}
                onChange={(e) => setStartNum(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="bates-zero-pad" style={fieldStyle}>
              <span style={labelStyle}>Zero padding</span>
              <input
                id="bates-zero-pad"
                type="number"
                min={1}
                max={12}
                value={zeroPad}
                onChange={(e) => setZeroPad(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={previewStyle}>
            <strong>Preview:</strong> {previewLabel}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Placement</div>
          <div style={gridStyle}>
            <label htmlFor="bates-position" style={fieldStyle}>
              <span style={labelStyle}>Position</span>
              <select
                id="bates-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                style={inputStyle}
              >
                {BATES_POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="bates-font" style={fieldStyle}>
              <span style={labelStyle}>Font</span>
              <select
                id="bates-font"
                value={font}
                onChange={(e) => setFont(e.target.value)}
                style={inputStyle}
              >
                {LEGAL_FONT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="bates-font-size" style={fieldStyle}>
              <span style={labelStyle}>Font size</span>
              <input
                id="bates-font-size"
                type="number"
                min={6}
                max={48}
                step={0.5}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value) || 10)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="bates-color" style={fieldStyle}>
              <span style={labelStyle}>Color</span>
              <input
                id="bates-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ ...inputStyle, padding: '6px 10px' }}
              />
            </label>
            <label htmlFor="bates-margin" style={fieldStyle}>
              <span style={labelStyle}>Margin (inches)</span>
              <input
                id="bates-margin"
                type="number"
                min={0}
                max={3}
                step={0.05}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Page Range</div>
          <div style={gridStyle}>
            <label htmlFor="bates-start-page" style={fieldStyle}>
              <span style={labelStyle}>Start page</span>
              <input
                id="bates-start-page"
                type="number"
                min={1}
                max={document?.pageCount ?? 1}
                value={startPage}
                onChange={(e) => setStartPage(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>
            <label htmlFor="bates-end-page" style={fieldStyle}>
              <span style={labelStyle}>End page</span>
              <input
                id="bates-end-page"
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
          <div style={helperTextStyle}>
            Document pages {startPage} through {finalPage || document?.pageCount || 0} will receive
            sequential Bates labels.
          </div>
        </div>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

        <div style={actionsStyle}>
          <button type="button" onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button type="submit" disabled={!document || submitting} style={primaryButtonStyle}>
            {submitting ? 'Applying...' : 'Apply Bates'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
