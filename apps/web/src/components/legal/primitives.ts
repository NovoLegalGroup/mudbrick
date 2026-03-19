import type { CSSProperties } from 'react';

export const LEGAL_FONT_OPTIONS = [
  'Helvetica',
  'HelveticaBold',
  'HelveticaOblique',
  'HelveticaBoldOblique',
  'TimesRoman',
  'TimesRomanBold',
  'TimesRomanItalic',
  'TimesRomanBoldItalic',
  'Courier',
  'CourierBold',
  'CourierOblique',
  'CourierBoldOblique',
] as const;

export const BATES_POSITION_OPTIONS = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
] as const;

export const dialogBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  minWidth: '460px',
  maxWidth: '680px',
};

export const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '14px',
  border: '1px solid var(--mb-border)',
  borderRadius: 'var(--mb-radius-sm)',
  backgroundColor: 'var(--mb-surface-alt)',
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--mb-text-secondary)',
};

export const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
};

export const sixZoneGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '12px',
};

export const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

export const labelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--mb-text-secondary)',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '36px',
  padding: '8px 10px',
  border: '1px solid var(--mb-border)',
  borderRadius: 'var(--mb-radius-sm)',
  backgroundColor: 'var(--mb-surface)',
  color: 'var(--mb-text)',
  fontSize: '13px',
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '72px',
  resize: 'vertical',
  fontFamily: 'inherit',
};

export const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: 'var(--mb-text)',
};

export const previewStyle: CSSProperties = {
  padding: '12px',
  borderRadius: 'var(--mb-radius-sm)',
  backgroundColor: 'var(--mb-surface)',
  border: '1px dashed var(--mb-border)',
  fontSize: '13px',
};

export const helperTextStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--mb-text-secondary)',
  lineHeight: 1.5,
};

export const errorStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--mb-danger)',
};

export const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
};

export const secondaryButtonStyle: CSSProperties = {
  padding: '9px 14px',
  backgroundColor: 'var(--mb-surface)',
  color: 'var(--mb-text)',
  border: '1px solid var(--mb-border)',
  borderRadius: 'var(--mb-radius-sm)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

export const primaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  backgroundColor: 'var(--mb-brand)',
  color: '#fff',
  border: '1px solid var(--mb-brand-dark)',
};
