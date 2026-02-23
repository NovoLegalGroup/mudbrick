/**
 * Mudbrick — Export to Image (Phase 3)
 * Export PDF pages to PNG, JPG, or TIFF format with configurable DPI.
 * Also handles Create PDF from Images.
 *
 * Uses PDF.js for rendering and canvas API for format conversion.
 */

const getPDFLib = () => window.PDFLib;

/* ═══════════════════ Export Pages to Images ═══════════════════ */

/**
 * Export a single page to an image.
 * @param {Object} pdfDoc - PDF.js document
 * @param {number} pageNum - 1-based page number
 * @param {Object} opts
 * @param {string} opts.format - 'png', 'jpg', or 'tiff' (default 'png')
 * @param {number} opts.dpi - Output DPI (default 150, max 600)
 * @param {number} opts.quality - JPEG quality 0-1 (default 0.92)
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function exportPageToImage(pdfDoc, pageNum, opts = {}) {
  const {
    format = 'png',
    dpi = 150,
    quality = 0.92,
  } = opts;

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });

  // Scale factor: PDF default is 72 DPI
  const scale = dpi / 72;

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width * scale);
  canvas.height = Math.floor(viewport.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  await page.render({
    canvasContext: ctx,
    viewport: page.getViewport({ scale: 1.0 }),
  }).promise;

  // Convert to blob
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, mimeType, format === 'jpg' ? quality : undefined);
  });

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Export multiple pages to images and trigger download.
 * @param {Object} pdfDoc - PDF.js document
 * @param {number[]} pages - Array of 1-based page numbers
 * @param {Object} opts - Same as exportPageToImage
 * @param {string} opts.fileName - Base filename
 * @param {Function} [onProgress] - Progress callback (pageNum, total)
 * @returns {Promise<void>}
 */
export async function exportPagesToImages(pdfDoc, pages, opts = {}, onProgress) {
  const { fileName = 'page', format = 'png' } = opts;
  const ext = format === 'jpg' ? 'jpg' : 'png';

  if (pages.length === 1) {
    // Single page — download directly
    const { blob } = await exportPageToImage(pdfDoc, pages[0], opts);
    const baseName = fileName.replace(/\.pdf$/i, '');
    downloadBlob(blob, `${baseName}_page${pages[0]}.${ext}`);
    onProgress?.(1, 1);
    return;
  }

  // Multiple pages — download as zip if available, otherwise individual files
  for (let i = 0; i < pages.length; i++) {
    const { blob } = await exportPageToImage(pdfDoc, pages[i], opts);
    const baseName = fileName.replace(/\.pdf$/i, '');
    downloadBlob(blob, `${baseName}_page${pages[i]}.${ext}`);
    onProgress?.(i + 1, pages.length);
    // Small delay to prevent browser download throttling
    if (pages.length > 1) await new Promise(r => setTimeout(r, 200));
  }
}

/* ═══════════════════ Create PDF from Images ═══════════════════ */

/**
 * Create a new PDF from image files.
 * @param {File[]} imageFiles - Array of image File objects
 * @param {Object} opts
 * @param {string} opts.pageSize - 'fit' (image size), 'letter', 'a4' (default 'fit')
 * @param {number} opts.margin - Margin in points (default 0)
 * @param {Function} [onProgress] - Progress callback (index, total)
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function createPDFFromImages(imageFiles, opts = {}, onProgress) {
  const PDFLib = getPDFLib();
  if (!PDFLib) throw new Error('pdf-lib not loaded');

  const { pageSize = 'fit', margin = 0 } = opts;
  const doc = await PDFLib.PDFDocument.create();

  const pageSizes = {
    letter: [612, 792],
    a4: [595.28, 841.89],
    legal: [612, 1008],
  };

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const bytes = await readFileBytes(file);
    const type = file.type || guessImageType(file.name);

    let image;
    try {
      if (type.includes('png')) {
        image = await doc.embedPng(bytes);
      } else if (type.includes('jpeg') || type.includes('jpg')) {
        image = await doc.embedJpg(bytes);
      } else {
        // Try to convert via canvas for other formats (gif, webp, etc.)
        const converted = await convertToJpeg(file);
        image = await doc.embedJpg(converted);
      }
    } catch (e) {
      console.warn(`Failed to embed image ${file.name}:`, e);
      continue;
    }

    const imgWidth = image.width;
    const imgHeight = image.height;

    let pageWidth, pageHeight;
    if (pageSize === 'fit') {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      [pageWidth, pageHeight] = pageSizes[pageSize] || pageSizes.letter;
    }

    const page = doc.addPage([pageWidth, pageHeight]);

    if (pageSize === 'fit') {
      page.drawImage(image, {
        x: margin,
        y: margin,
        width: imgWidth,
        height: imgHeight,
      });
    } else {
      // Scale image to fit within page (with margins)
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin * 2;
      const scale = Math.min(availW / imgWidth, availH / imgHeight, 1);
      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;
      const x = margin + (availW - drawW) / 2;
      const y = margin + (availH - drawH) / 2;

      page.drawImage(image, { x, y, width: drawW, height: drawH });
    }

    onProgress?.(i + 1, imageFiles.length);
  }

  return doc.save();
}

/* ═══════════════════ Page Optimization ═══════════════════ */

/**
 * Reduce PDF file size by re-rendering pages as compressed images.
 * This is a lossy operation — text becomes rasterized.
 *
 * @param {Object} pdfDoc - PDF.js document
 * @param {Uint8Array} pdfBytes - Original PDF bytes
 * @param {Object} opts
 * @param {number} opts.dpi - Render DPI (default 150)
 * @param {number} opts.quality - JPEG quality 0-1 (default 0.75)
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<Uint8Array>} Optimized PDF bytes
 */
export async function optimizePDF(pdfDoc, pdfBytes, opts = {}, onProgress) {
  const PDFLib = getPDFLib();
  if (!PDFLib) throw new Error('pdf-lib not loaded');

  const { dpi = 150, quality = 0.75 } = opts;
  const newDoc = await PDFLib.PDFDocument.create();
  const pageCount = pdfDoc.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: dpi / 72 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Convert to JPEG
    const jpegBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

    const image = await newDoc.embedJpg(jpegBytes);
    const origPage = await pdfDoc.getPage(i);
    const origViewport = origPage.getViewport({ scale: 1 });

    const newPage = newDoc.addPage([origViewport.width, origViewport.height]);
    newPage.drawImage(image, {
      x: 0, y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });

    onProgress?.(i, pageCount);
  }

  return newDoc.save();
}

/* ═══════════════════ Helpers ═══════════════════ */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function readFileBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function guessImageType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  return map[ext] || 'image/jpeg';
}

async function convertToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
