/**
 * Mudbrick — PDF Edit (Phase 2-3)
 * pdf-lib wrapper: merge, split, rotate, delete, reorder, watermark.
 * All operations mutate the internal pdfLibDoc, then call save() to
 * produce new bytes which the caller reloads into PDF.js.
 */

const getPDFLib = () => window.PDFLib;

let pdfLibDoc = null;

/* ── Lazy Initialization ── */

export async function ensurePdfLib(pdfBytes) {
  if (!pdfLibDoc) {
    const { PDFDocument } = getPDFLib();
    pdfLibDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  }
  return pdfLibDoc;
}

export function getPdfLibDoc() { return pdfLibDoc; }
export function setPdfLibDoc(doc) { pdfLibDoc = doc; }
export function resetPdfLib() { pdfLibDoc = null; }

/** Save current pdf-lib doc to bytes (for reloading into PDF.js) */
export async function saveToBytes() {
  if (!pdfLibDoc) throw new Error('No pdf-lib document loaded');
  return pdfLibDoc.save();
}

/* ═══════════════════ Phase 2: Page Operations ═══════════════════ */

/** Rotate a page by the given degrees (90, 180, 270, -90, etc.) */
export async function rotatePage(pdfBytes, pageIndex, degrees) {
  const doc = await ensurePdfLib(pdfBytes);
  const page = doc.getPage(pageIndex);
  const current = page.getRotation().angle;
  page.setRotation(getPDFLib().degrees((current + degrees) % 360));
  return doc.save();
}

/** Delete a page by index (0-based). Returns new bytes. */
export async function deletePage(pdfBytes, pageIndex) {
  const doc = await ensurePdfLib(pdfBytes);
  if (doc.getPageCount() <= 1) {
    throw new Error('Cannot delete the only remaining page');
  }
  doc.removePage(pageIndex);
  return doc.save();
}

/**
 * Reorder pages: move page at fromIndex to toIndex.
 * pdf-lib has no native move, so we rebuild the document.
 * Returns new bytes.
 */
export async function reorderPages(pdfBytes, fromIndex, toIndex) {
  const doc = await ensurePdfLib(pdfBytes);
  const count = doc.getPageCount();
  if (fromIndex === toIndex) return doc.save();

  // Build new page order
  const order = Array.from({ length: count }, (_, i) => i);
  const [removed] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, removed);

  // Create new document with reordered pages
  const { PDFDocument } = getPDFLib();
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(doc, order);
  copiedPages.forEach(p => newDoc.addPage(p));

  // Replace internal doc reference
  pdfLibDoc = newDoc;
  return newDoc.save();
}

/* ═══════════════════ Phase 3: Merge & Split ═══════════════════ */

/**
 * Merge multiple PDFs. fileList = [{ bytes: Uint8Array }, ...]
 * Returns new bytes for the merged document.
 */
export async function mergePDFs(fileList) {
  const { PDFDocument } = getPDFLib();
  const merged = await PDFDocument.create();

  for (const { bytes } of fileList) {
    const donor = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const indices = donor.getPageIndices();
    const pages = await merged.copyPages(donor, indices);
    pages.forEach(p => merged.addPage(p));
  }

  pdfLibDoc = merged;
  return merged.save();
}

/**
 * Split PDF into multiple documents by page ranges.
 * ranges = [[0,1,2], [4], [6,7,8]] (0-indexed)
 * Returns array of { bytes: Uint8Array, label: string }
 */
export async function splitPDF(pdfBytes, ranges) {
  const doc = await ensurePdfLib(pdfBytes);
  const { PDFDocument } = getPDFLib();
  const results = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(doc, range);
    pages.forEach(p => newDoc.addPage(p));
    const savedBytes = await newDoc.save();

    // Label: "pages 1-3" or "page 5"
    const first = range[0] + 1;
    const last = range[range.length - 1] + 1;
    const label = first === last ? `page-${first}` : `pages-${first}-${last}`;

    results.push({ bytes: savedBytes, label });
  }

  return results;
}

/* ═══════════════════ Phase 7: Watermark (stub) ═══════════════════ */

export async function addWatermark(text, options) { /* Phase 7 */ }
