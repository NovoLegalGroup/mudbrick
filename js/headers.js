/**
 * Mudbrick — Headers & Footers (Phase 2, W2.2)
 * Draws user-defined text into 6 zones (top/bottom × left/center/right)
 * on each page via pdf-lib drawText().
 * Supports tokens: {page}, {pages}, {date}, {filename}.
 * Returns new PDF bytes.
 */

const getPDFLib = () => window.PDFLib;

const DEFAULT_MARGIN = 36; // 0.5 inch

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
 * @property {string}  [fontFamily='Helvetica'] - pdf-lib StandardFonts key
 * @property {number}  [margin=0.5]          - Margin in inches
 * @property {string}  [filename='']         - Replacement for {filename}
 * @property {number}  [startPage=1]         - First page to stamp (1-based)
 * @property {number}  [endPage=0]           - Last page (0 = all)
 * @property {boolean} [skipFirst=false]     - Skip first page
 * @property {boolean} [skipLast=false]      - Skip last page
 * @property {boolean} [mirror=false]        - Mirror left/right on even pages
 * @property {boolean} [drawLine=false]      - Draw separator line
 */

/**
 * Replace tokens in a text template.
 * @param {string} template
 * @param {number} pageNum   - 1-based current page
 * @param {number} totalPages
 * @param {string} filename
 * @returns {string}
 */
function replaceTokens(template, pageNum, totalPages, filename, pdfDoc) {
  if (!template) return '';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const author = (pdfDoc && typeof pdfDoc.getAuthor === 'function') ? (pdfDoc.getAuthor() || '') : '';
  const title = (pdfDoc && typeof pdfDoc.getTitle === 'function') ? (pdfDoc.getTitle() || '') : '';
  return template
    .replace(/\{page\}/gi, String(pageNum))
    .replace(/\{pages\}/gi, String(totalPages))
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{filename\}/gi, filename)
    .replace(/\{author\}/gi, author)
    .replace(/\{title\}/gi, title);
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
    fontFamily = 'Helvetica',
    margin: marginInches = 0.5,
    filename = '',
    startPage = 1,
    endPage = 0,
    skipFirst = false,
    skipLast = false,
    mirror = false,
    drawLine = false,
  } = opts;

  const margin = marginInches * 72; // Convert inches to points

  // Parse color
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;

  const fontKey = PDFLib.StandardFonts[fontFamily] || PDFLib.StandardFonts.Helvetica;
  const font = await doc.embedFont(fontKey);
  const pageCount = doc.getPageCount();

  const first = Math.max(1, startPage) - 1;
  const last = endPage > 0 ? Math.min(endPage, pageCount) : pageCount;

  const zoneTemplates = {
    topLeft, topCenter, topRight,
    bottomLeft, bottomCenter, bottomRight,
  };

  // Skip if nothing to draw
  const hasContent = Object.values(zoneTemplates).some(t => t.trim());
  if (!hasContent) {
    return doc.save();
  }

  const zoneKeys = ['topLeft', 'topCenter', 'topRight', 'bottomLeft', 'bottomCenter', 'bottomRight'];

  for (let i = first; i < last; i++) {
    const pageNum = i + 1;

    // Skip first/last page if requested
    if (skipFirst && pageNum === 1) continue;
    if (skipLast && pageNum === pageCount) continue;

    const page = doc.getPage(i);
    const { width, height } = page.getSize();

    let hasTopContent = false;
    let hasBottomContent = false;

    for (const key of zoneKeys) {
      // Mirror: swap left/right on even pages
      let templateKey = key;
      if (mirror && pageNum % 2 === 0) {
        if (key.endsWith('Left')) templateKey = key.replace('Left', 'Right');
        else if (key.endsWith('Right')) templateKey = key.replace('Right', 'Left');
      }

      const text = replaceTokens(zoneTemplates[templateKey], pageNum, pageCount, filename, doc);
      if (!text) continue;

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const { x, y } = calcZonePosition(key, width, height, textWidth, fontSize, margin);

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: PDFLib.rgb(r, g, b),
      });

      if (key.startsWith('top')) hasTopContent = true;
      else hasBottomContent = true;
    }

    // Draw separator lines if requested
    if (drawLine) {
      const pdfColor = PDFLib.rgb(r, g, b);
      if (hasTopContent) {
        const lineY = height - margin - fontSize - 4;
        page.drawLine({
          start: { x: margin, y: lineY },
          end: { x: width - margin, y: lineY },
          thickness: 0.5,
          color: pdfColor,
        });
      }
      if (hasBottomContent) {
        const lineY = margin + fontSize + 4;
        page.drawLine({
          start: { x: margin, y: lineY },
          end: { x: width - margin, y: lineY },
          thickness: 0.5,
          color: pdfColor,
        });
      }
    }
  }

  const bytes = await doc.save();
  return bytes;
}

/**
 * Calculate x,y for one of 6 zones.
 */
function calcZonePosition(zone, pageW, pageH, textW, fontSize, margin = DEFAULT_MARGIN) {
  let x, y;

  // Vertical: top row or bottom row
  if (zone.startsWith('top')) {
    y = pageH - margin - fontSize;
  } else {
    y = margin;
  }

  // Horizontal: left, center, right
  if (zone.endsWith('Left')) {
    x = margin;
  } else if (zone.endsWith('Right')) {
    x = pageW - margin - textW;
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
export function previewHeaderText(template, filename = 'document.pdf', pdfDoc = null) {
  return replaceTokens(template, 1, 10, filename, pdfDoc);
}
