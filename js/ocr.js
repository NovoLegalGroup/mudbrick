/**
 * Mudbrick — OCR via Tesseract.js (Phase 2, W5.1)
 * Lazy-loads Tesseract.js from CDN, renders pages at 300 DPI,
 * runs OCR, and creates synthetic text layer spans for search.
 */

let tesseractLoaded = false;
let ocrResults = {};   // pageNum → { words, lines, fullText }
let worker = null;

const OCR_DPI = 300;
const PDF_DPI = 72;
const SCALE_FACTOR = OCR_DPI / PDF_DPI;

/* ── Lazy-load Tesseract.js from CDN ── */

async function ensureTesseract() {
  if (tesseractLoaded && window.Tesseract) return;

  return new Promise((resolve, reject) => {
    if (window.Tesseract) {
      tesseractLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => {
      tesseractLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'));
    document.head.appendChild(script);
  });
}

/* ── Render PDF page to offscreen canvas at high DPI ── */

async function renderPageToCanvas(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: SCALE_FACTOR });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  return { canvas, viewport, nativeViewport: page.getViewport({ scale: 1 }) };
}

/* ── Public API ── */

/**
 * Run OCR on specified pages.
 * @param {PDFDocumentProxy} pdfDoc — PDF.js document
 * @param {number[]} pageNumbers — 1-based page numbers
 * @param {function} onProgress — callback({current, total, status, progress})
 * @returns {Object} ocrResults map
 */
export async function runOCR(pdfDoc, pageNumbers, onProgress) {
  // Load Tesseract.js
  onProgress?.({
    current: 0, total: pageNumbers.length,
    status: 'Loading OCR engine…', progress: 0,
  });
  await ensureTesseract();

  // Create / reuse worker
  if (!worker) {
    worker = await window.Tesseract.createWorker('eng');
  }

  for (let i = 0; i < pageNumbers.length; i++) {
    const pageNum = pageNumbers[i];
    const pct = Math.round((i / pageNumbers.length) * 100);

    onProgress?.({
      current: i + 1, total: pageNumbers.length,
      pageNum,
      status: `OCR page ${pageNum} of ${pageNumbers.length}…`,
      progress: pct,
    });

    // Render page at 300 DPI
    const { canvas, nativeViewport } = await renderPageToCanvas(pdfDoc, pageNum);
    const pageHeight = nativeViewport.height; // in PDF pts (72 DPI)

    // Run OCR with blocks output for bounding boxes
    const result = await worker.recognize(canvas, {}, { blocks: true });

    // Parse results — extract words with bounding boxes
    const words = [];
    const lines = [];
    let fullText = '';

    if (result.data.blocks) {
      for (const block of result.data.blocks) {
        if (!block.paragraphs) continue;
        for (const para of block.paragraphs) {
          if (!para.lines) continue;
          for (const line of para.lines) {
            const lineWords = [];
            if (!line.words) continue;
            for (const word of line.words) {
              // Convert image coords (300 DPI) back to PDF coords (72 DPI)
              const pdfBbox = {
                x0: word.bbox.x0 / SCALE_FACTOR,
                y0: word.bbox.y0 / SCALE_FACTOR,
                x1: word.bbox.x1 / SCALE_FACTOR,
                y1: word.bbox.y1 / SCALE_FACTOR,
              };
              words.push({
                text: word.text,
                bbox: pdfBbox,
                confidence: word.confidence,
              });
              lineWords.push(word.text);
            }
            const lineText = lineWords.join(' ');
            lines.push({
              text: lineText,
              bbox: {
                x0: line.bbox.x0 / SCALE_FACTOR,
                y0: line.bbox.y0 / SCALE_FACTOR,
                x1: line.bbox.x1 / SCALE_FACTOR,
                y1: line.bbox.y1 / SCALE_FACTOR,
              },
            });
            fullText += lineText + '\n';
          }
        }
      }
    } else {
      // Fallback: just store the raw text without positions
      fullText = result.data.text || '';
    }

    ocrResults[pageNum] = {
      words,
      lines,
      fullText: fullText.trim(),
      pageHeight,
    };
  }

  onProgress?.({
    current: pageNumbers.length, total: pageNumbers.length,
    status: 'OCR complete', progress: 100,
  });

  return ocrResults;
}

/**
 * Check if a page has OCR results stored.
 */
export function hasOCRResults(pageNum) {
  return !!ocrResults[pageNum];
}

/**
 * Get OCR results for a page.
 */
export function getOCRResults(pageNum) {
  return ocrResults[pageNum] || null;
}

/**
 * Check if a page appears to be scanned (very little native text).
 * @param {PDFDocumentProxy} pdfDoc
 * @param {number} pageNum — 1-based
 * @returns {boolean}
 */
export async function isPageScanned(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const content = await page.getTextContent();
  const text = content.items.map(i => i.str).join('').trim();
  return text.length < 20;
}

/**
 * Render OCR text as invisible spans in the text layer container.
 * These spans enable text selection and make Find (Ctrl+F) highlights work.
 * @param {number} pageNum
 * @param {HTMLElement} container — the #text-layer div
 * @param {object} viewport — PDF.js viewport at current zoom
 */
export function renderOCRTextLayer(pageNum, container, viewport) {
  const result = ocrResults[pageNum];
  if (!result || !result.words.length) return;

  // Don't duplicate if already rendered
  if (container.querySelector('.ocr-text-span')) return;

  const scale = viewport.scale;

  for (const word of result.words) {
    const span = document.createElement('span');
    span.className = 'ocr-text-span';
    span.textContent = word.text + ' ';

    // Position based on PDF coordinates scaled to current zoom
    const left = word.bbox.x0 * scale;
    const top = word.bbox.y0 * scale;
    const width = (word.bbox.x1 - word.bbox.x0) * scale;
    const height = (word.bbox.y1 - word.bbox.y0) * scale;

    span.style.cssText = [
      'position:absolute',
      `left:${left}px`,
      `top:${top}px`,
      `width:${width}px`,
      `height:${height}px`,
      `font-size:${Math.max(1, height * 0.8)}px`,
      'color:transparent',
      'white-space:nowrap',
      'overflow:hidden',
      'line-height:1',
      'pointer-events:none',
    ].join(';');

    container.appendChild(span);
  }
}

/**
 * Build OCR text entries compatible with find.js text indexing.
 * Returns array of {pageNum, text, items} matching find.js format.
 */
export function getOCRTextEntries() {
  const entries = [];

  for (const [key, result] of Object.entries(ocrResults)) {
    const pageNum = parseInt(key);
    if (!result.fullText) continue;

    // Build contiguous text and items array (words separated by spaces)
    let offset = 0;
    const items = [];

    for (let i = 0; i < result.words.length; i++) {
      const word = result.words[i];
      const str = i < result.words.length - 1 ? word.text + ' ' : word.text;
      items.push({
        str,
        start: offset,
        // PDF.js-compatible transform: [scaleX, skew, skew, scaleY, tx, ty]
        // ty is from bottom-left in PDF coords, but our bbox is from top-left
        // We use a sentinel flag so renderHighlights can detect OCR transforms
        transform: [1, 0, 0, 1, word.bbox.x0, word.bbox.y0],
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        _ocr: true, // flag for highlight positioning
      });
      offset += str.length;
    }

    const fullText = items.map(it => it.str).join('');
    entries.push({ pageNum, text: fullText, items });
  }

  return entries;
}

/**
 * Terminate the Tesseract worker.
 */
export async function terminateOCR() {
  if (worker) {
    try { await worker.terminate(); } catch (_) { /* ignore */ }
    worker = null;
  }
}

/**
 * Clear all stored OCR results.
 */
export function clearOCRResults() {
  ocrResults = {};
}
