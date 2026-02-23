/**
 * Mudbrick — Bates Numbering (Phase 2, W2.1)
 * Stamps sequential Bates numbers onto each page via pdf-lib drawText().
 * Returns new PDF bytes.
 */

const getPDFLib = () => window.PDFLib;

/**
 * @typedef {Object} BatesOptions
 * @property {string}  [prefix='']       - Text before the number
 * @property {string}  [suffix='']       - Text after the number
 * @property {number}  [startNumber=1]   - First Bates number
 * @property {number}  [zeroPad=6]       - Digits to zero-pad
 * @property {string}  [position='bottom-center'] - One of 6 positions
 * @property {number}  [fontSize=10]     - Font size in points
 * @property {string}  [color='#000000'] - Hex color
 * @property {number}  [startPage=1]     - First page to stamp (1-based)
 * @property {number}  [endPage=0]       - Last page to stamp (1-based, 0 = all)
 */

const MARGIN = 36; // 0.5 inch margin from edge

/**
 * Apply Bates numbers to a PDF document.
 * @param {Uint8Array} pdfBytes - Source PDF
 * @param {BatesOptions} opts
 * @returns {Promise<{bytes: Uint8Array, firstLabel: string, lastLabel: string}>}
 */
export async function applyBatesNumbers(pdfBytes, opts = {}) {
  const PDFLib = getPDFLib();
  const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const {
    prefix = '',
    suffix = '',
    startNumber = 1,
    zeroPad = 6,
    position = 'bottom-center',
    fontSize = 10,
    color = '#000000',
    startPage = 1,
    endPage = 0,
  } = opts;

  // Parse color
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;

  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const pageCount = doc.getPageCount();

  const first = Math.max(1, startPage) - 1;          // 0-based
  const last = endPage > 0 ? Math.min(endPage, pageCount) : pageCount; // exclusive

  let num = startNumber;
  let firstLabel = '';
  let lastLabel = '';

  for (let i = first; i < last; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();

    const label = prefix + String(num).padStart(zeroPad, '0') + suffix;
    if (i === first) firstLabel = label;
    lastLabel = label;

    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x, y } = calcPosition(position, width, height, textWidth, fontSize);

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: PDFLib.rgb(r, g, b),
    });

    num++;
  }

  const bytes = await doc.save();
  return { bytes, firstLabel, lastLabel };
}

/**
 * Calculate x,y for the 6 standard positions.
 */
function calcPosition(position, pageW, pageH, textW, fontSize) {
  let x, y;

  switch (position) {
    case 'top-left':
      x = MARGIN;
      y = pageH - MARGIN - fontSize;
      break;
    case 'top-center':
      x = (pageW - textW) / 2;
      y = pageH - MARGIN - fontSize;
      break;
    case 'top-right':
      x = pageW - MARGIN - textW;
      y = pageH - MARGIN - fontSize;
      break;
    case 'bottom-left':
      x = MARGIN;
      y = MARGIN;
      break;
    case 'bottom-right':
      x = pageW - MARGIN - textW;
      y = MARGIN;
      break;
    case 'bottom-center':
    default:
      x = (pageW - textW) / 2;
      y = MARGIN;
      break;
  }

  return { x, y };
}

/**
 * Build a preview label string (does NOT apply to PDF).
 * @param {BatesOptions} opts
 * @returns {string} e.g. "DOC-000001-R1"
 */
export function previewBatesLabel(opts = {}) {
  const {
    prefix = '',
    suffix = '',
    startNumber = 1,
    zeroPad = 6,
  } = opts;
  return prefix + String(startNumber).padStart(zeroPad, '0') + suffix;
}
