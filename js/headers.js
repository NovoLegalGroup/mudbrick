/**
 * Mudbrick — Headers & Footers (Phase 2, W2.2)
 * Draws user-defined text into 6 zones (top/bottom × left/center/right)
 * on each page via pdf-lib drawText().
 * Supports tokens: {page}, {pages}, {date}, {filename}.
 * Returns new PDF bytes.
 */

const getPDFLib = () => window.PDFLib;

const MARGIN = 36; // 0.5 inch

/**
 * @typedef {Object} HeaderFooterOptions
 * @property {string}  [topLeft='']
 * @property {string}  [topCenter='']
 * @property {string}  [topRight='']
 * @property {string}  [bottomLeft='']
 * @property {string}  [bottomCenter='']
 * @property {string}  [bottomRight='']
 * @property {number}  [fontSize=10]
 * @property {string}  [color='#000000']
 * @property {string}  [filename='']         - Replacement for {filename}
 * @property {number}  [startPage=1]         - First page to stamp (1-based)
 * @property {number}  [endPage=0]           - Last page (0 = all)
 */

/**
 * Replace tokens in a text template.
 * @param {string} template
 * @param {number} pageNum   - 1-based current page
 * @param {number} totalPages
 * @param {string} filename
 * @returns {string}
 */
function replaceTokens(template, pageNum, totalPages, filename) {
  if (!template) return '';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return template
    .replace(/\{page\}/gi, String(pageNum))
    .replace(/\{pages\}/gi, String(totalPages))
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{filename\}/gi, filename);
}

/**
 * Apply headers and footers to a PDF document.
 * @param {Uint8Array} pdfBytes
 * @param {HeaderFooterOptions} opts
 * @returns {Promise<Uint8Array>}
 */
export async function applyHeadersFooters(pdfBytes, opts = {}) {
  const PDFLib = getPDFLib();
  const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const {
    topLeft = '',
    topCenter = '',
    topRight = '',
    bottomLeft = '',
    bottomCenter = '',
    bottomRight = '',
    fontSize = 10,
    color = '#000000',
    filename = '',
    startPage = 1,
    endPage = 0,
  } = opts;

  // Parse color
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;

  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const pageCount = doc.getPageCount();

  const first = Math.max(1, startPage) - 1;
  const last = endPage > 0 ? Math.min(endPage, pageCount) : pageCount;

  const zones = [
    { key: 'topLeft', template: topLeft },
    { key: 'topCenter', template: topCenter },
    { key: 'topRight', template: topRight },
    { key: 'bottomLeft', template: bottomLeft },
    { key: 'bottomCenter', template: bottomCenter },
    { key: 'bottomRight', template: bottomRight },
  ];

  // Skip if nothing to draw
  const hasContent = zones.some(z => z.template.trim());
  if (!hasContent) {
    return doc.save();
  }

  for (let i = first; i < last; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const pageNum = i + 1;

    for (const zone of zones) {
      const text = replaceTokens(zone.template, pageNum, pageCount, filename);
      if (!text) continue;

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const { x, y } = calcZonePosition(zone.key, width, height, textWidth, fontSize);

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: PDFLib.rgb(r, g, b),
      });
    }
  }

  const bytes = await doc.save();
  return bytes;
}

/**
 * Calculate x,y for one of 6 zones.
 */
function calcZonePosition(zone, pageW, pageH, textW, fontSize) {
  let x, y;

  // Vertical: top row or bottom row
  if (zone.startsWith('top')) {
    y = pageH - MARGIN - fontSize;
  } else {
    y = MARGIN;
  }

  // Horizontal: left, center, right
  if (zone.endsWith('Left')) {
    x = MARGIN;
  } else if (zone.endsWith('Right')) {
    x = pageW - MARGIN - textW;
  } else {
    // Center
    x = (pageW - textW) / 2;
  }

  return { x, y };
}

/**
 * Preview a single token-replaced string (for live preview in the modal).
 * @param {string} template
 * @param {string} filename
 * @returns {string}
 */
export function previewHeaderText(template, filename = 'document.pdf') {
  return replaceTokens(template, 1, 10, filename);
}
