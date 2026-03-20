# Mudbrick — OCR Improvement & Header/Footer Enhancement Plan

**Date**: 2026-03-13
**Scope**: Two systems — OCR (js/ocr.js + integrations) and Headers/Footers (js/headers.js + integrations)
**Approach**: Incremental improvements to production-stable systems. No rewrites.
**Status note**: This document is a v1/browser remediation plan. The active delivery plan is now a Windows desktop app built with Tauri + a local Python sidecar. Use [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) as the source of truth for the Windows app build order.

---

## Part A: OCR System Improvements

### Current State

| Aspect | Status |
|--------|--------|
| Engine | Tesseract.js 5.x, CDN-loaded |
| Rendering | 300 DPI (4.17x upscale from PDF 72 DPI) |
| Languages | Single language per run (eng, spa, etc.) |
| Storage | In-memory `ocrResults` keyed by page number |
| Text layer | Invisible positioned spans for search/select |
| Correction | contentEditable spans, updates confidence to 100 |
| Export | Invisible text baked via pdf-lib `drawText({opacity: 0})` |
| Find integration | Augments text index when native text < 20 chars |
| Text-edit fallback | OCR lines used as editable blocks on scanned pages |

### What Works Well

- 300 DPI rendering produces good recognition quality
- Text layer positioning is accurate for standard (0-degree) pages
- Export embedding makes PDFs permanently searchable
- Correction mode is intuitive (click word, type fix, confidence resets to 100)
- Native text detection avoids double-layering on non-scanned pages

---

### OCR-1: Parallel Page Processing (High Value)

**Problem**: Pages are processed sequentially with one Tesseract worker. A 50-page scanned document at 300 DPI takes minutes.

**Current flow** (ocr.js):
```
Page 1 -> render canvas -> OCR -> store results
Page 2 -> render canvas -> OCR -> store results
...
Page 50 -> render canvas -> OCR -> store results
```

**Proposed flow**:
```
Create worker pool (2-3 workers based on navigator.hardwareConcurrency)
Batch pages -> distribute across workers -> collect results
```

**Implementation**:
```javascript
// ocr.js - new worker pool
const MAX_WORKERS = Math.min(navigator.hardwareConcurrency || 2, 3);
let workerPool = [];

async function getWorkerPool(lang) {
  if (workerPool.length && workerPool[0]._lang === lang) return workerPool;
  await terminatePool();
  for (let i = 0; i < MAX_WORKERS; i++) {
    const w = await Tesseract.createWorker(lang);
    w._lang = lang;
    workerPool.push(w);
  }
  return workerPool;
}

async function runOCRParallel(pdfDoc, pageNums, lang, onProgress) {
  const pool = await getWorkerPool(lang);
  let completed = 0;

  // Process in chunks of pool size
  for (let i = 0; i < pageNums.length; i += pool.length) {
    const batch = pageNums.slice(i, i + pool.length);
    const promises = batch.map((pageNum, idx) =>
      processPage(pdfDoc, pageNum, pool[idx])
        .then(result => {
          ocrResults[pageNum] = result;
          onProgress(++completed, pageNums.length);
        })
    );
    await Promise.all(promises);
  }
}
```

**Files to modify**: `js/ocr.js` (add pool management), `js/app.js` (call parallel version)

**Memory risk**: 3 simultaneous 300 DPI renders of a letter-size page = ~75 MB canvas data. Safe within Chrome tab limits even with a 100 MB PDF loaded.

---

### OCR-2: Rotated Page Support (Medium Value)

**Problem**: OCR bounding boxes assume 0-degree page rotation. Pages rotated 90, 180, or 270 degrees produce incorrectly positioned text layers.

**Current code** (ocr.js line ~113-120):
```javascript
// Converts image coords to PDF coords - no rotation handling
bbox: {
  x0: w.bbox.x0 / SCALE_FACTOR,
  y0: w.bbox.y0 / SCALE_FACTOR,
  x1: w.bbox.x1 / SCALE_FACTOR,
  y1: w.bbox.y1 / SCALE_FACTOR
}
```

**Fix**: Read page rotation from PDF.js viewport, transform bounding boxes accordingly.

```javascript
async function processPage(pdfDoc, pageNum, ocrWorker) {
  const page = await pdfDoc.getPage(pageNum);
  const rotation = page.rotate; // 0, 90, 180, 270

  // Render at native orientation (PDF.js handles rotation in viewport)
  const viewport = page.getViewport({ scale: SCALE_FACTOR, rotation: 0 });
  // ... render and OCR ...

  // Transform bounding boxes back to display coordinates
  words.forEach(w => {
    w.bbox = rotateBbox(w.bbox, rotation, pageWidth, pageHeight);
  });
}

function rotateBbox(bbox, rotation, pageW, pageH) {
  switch (rotation) {
    case 90:
      return { x0: bbox.y0, y0: pageW - bbox.x1, x1: bbox.y1, y1: pageW - bbox.x0 };
    case 180:
      return { x0: pageW - bbox.x1, y0: pageH - bbox.y1, x1: pageW - bbox.x0, y1: pageH - bbox.y0 };
    case 270:
      return { x0: pageH - bbox.y1, y0: bbox.x0, x1: pageH - bbox.y0, y1: bbox.x1 };
    default:
      return bbox;
  }
}
```

**Files to modify**: `js/ocr.js` (bbox transform), `js/export.js` (embedding coords for rotated pages)

---

### OCR-3: Configurable Confidence Threshold (Low Value, Easy)

**Problem**: Low-confidence threshold is hardcoded at 60 (detection) and 70 (visual highlighting). Users processing low-quality scans may want to adjust.

**Fix**: Add a slider to the OCR modal.

```html
<!-- index.html, inside OCR modal -->
<label>
  Confidence threshold
  <input type="range" id="ocr-confidence" min="30" max="90" value="60" step="5">
  <span id="ocr-confidence-val">60%</span>
</label>
```

```javascript
// ocr.js - accept threshold from options
function classifyConfidence(word, threshold = 60) {
  return word.confidence < threshold ? 'low' :
         word.confidence < threshold + 15 ? 'medium' : 'high';
}
```

**Files to modify**: `index.html` (modal UI), `js/ocr.js` (threshold parameter), `js/app.js` (read slider value)

---

### OCR-4: Pre-process Image for Better Recognition (Medium Value)

**Problem**: Tesseract accuracy drops on low-contrast, noisy, or skewed scans. Currently, the raw 300 DPI render is passed directly to Tesseract.

**Proposed pre-processing pipeline** (canvas operations before OCR):

```javascript
function preprocessCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 1. Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    data[i] = data[i+1] = data[i+2] = gray;
  }

  // 2. Adaptive threshold (Otsu's method)
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) histogram[data[i]]++;
  const threshold = otsuThreshold(histogram, canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > threshold ? 255 : 0;
    data[i] = data[i+1] = data[i+2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function otsuThreshold(histogram, total) {
  let sum = 0, sumB = 0, wB = 0, wF = 0, maxVariance = 0, threshold = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) { maxVariance = variance; threshold = i; }
  }
  return threshold;
}
```

**When to apply**: Only when user enables "Enhance for OCR" checkbox (default off). Good scans don't need it; bad scans benefit significantly.

**Files to modify**: `js/ocr.js` (add preprocessing step), `index.html` (checkbox)

---

### OCR-5: Persist OCR Results to IndexedDB (Medium Value)

**Problem**: OCR results are in-memory only (`ocrResults` object). If the user refreshes or the tab crashes after running OCR on 50 pages, all results are lost. The recovery system saves `pdfBytes` and `pageAnnotations` but NOT `ocrResults`.

**Fix**: Include OCR results in the recovery data.

```javascript
// In app.js auto-save (saveRecovery function):
const recoveryData = {
  pdfBytes: State.pdfBytes,
  pageAnnotations: State.pageAnnotations,
  fileName: State.fileName,
  hasChanges: State.hasChanges,
  ocrResults: Object.keys(ocrResults).length > 0 ? ocrResults : undefined
};
```

```javascript
// On recovery restore:
if (recoveryData.ocrResults) {
  restoreOCRResults(recoveryData.ocrResults);  // New export from ocr.js
}
```

**Size concern**: OCR results for a 50-page document add ~1-5 MB to IndexedDB payload. Acceptable given PDF bytes are already 100 MB.

**Files to modify**: `js/app.js` (save/restore), `js/ocr.js` (export `restoreOCRResults`)

---

### OCR Priority Summary

| ID | Improvement | Value | Effort | Do When |
|----|-------------|-------|--------|---------|
| OCR-1 | Parallel workers | High | Medium | Now - biggest UX win for multi-page OCR |
| OCR-5 | Persist to IndexedDB | Medium | Low | Now - prevents losing expensive OCR work |
| OCR-2 | Rotated page support | Medium | Medium | Soon - correctness issue |
| OCR-4 | Image pre-processing | Medium | Medium | Soon - accuracy for bad scans |
| OCR-3 | Configurable threshold | Low | Low | Eventually - nice-to-have |

---

## Part B: Header/Footer Enhancement Plan

### Current State

| Aspect | Status |
|--------|--------|
| Zones | 6 fixed positions (top/bottom x left/center/right) |
| Tokens | {page}, {pages}, {date}, {filename} |
| Font | Helvetica only (StandardFont) |
| Font size | 6-36pt, user configurable |
| Color | Hex color picker |
| Margin | 36pt (0.5 inch) hardcoded |
| Page range | All pages or custom range |
| Preview | Live 3x2 grid with token replacement |
| Persistence | Baked into PDF immediately via pdf-lib drawText() |
| Operation lock | Uses acquireOperationLock('headersFooters') |

### What Works Well

- Token replacement is reliable and correctly resolves per-page
- Position calculation handles variable page sizes
- Text width measurement ensures proper centering/right-alignment
- Live preview gives instant feedback
- Page range parsing reuses proven parsePageRanges() utility
- Operation locking prevents concurrent mutations

---

### HF-1: Font Selection (High Value, Low Effort)

**Problem**: Only Helvetica is available. Legal documents often require Times New Roman or Courier.

**pdf-lib StandardFonts available** (no embedding, no external files):
- Helvetica, HelveticaBold, HelveticaOblique, HelveticaBoldOblique
- TimesRoman, TimesRomanBold, TimesRomanItalic, TimesRomanBoldItalic
- Courier, CourierBold, CourierOblique, CourierBoldOblique

**Implementation**:

```html
<!-- index.html, inside H/F modal -->
<label>Font
  <select id="hf-font">
    <option value="Helvetica">Helvetica</option>
    <option value="HelveticaBold">Helvetica Bold</option>
    <option value="TimesRoman">Times New Roman</option>
    <option value="TimesRomanBold">Times New Roman Bold</option>
    <option value="Courier">Courier</option>
    <option value="CourierBold">Courier Bold</option>
  </select>
</label>
```

```javascript
// headers.js - accept font option
async function applyHeadersFooters(pdfBytes, opts = {}) {
  const PDFLib = getPDFLib();
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
  const fontName = opts.fontFamily || 'Helvetica';
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts[fontName]);
  // ... rest unchanged
}
```

**Files to modify**: `js/headers.js` (font parameter), `index.html` (dropdown), `js/app.js` (read selection)

---

### HF-2: Skip First Page / Skip Last Page (High Value, Low Effort)

**Problem**: Cover pages often shouldn't have headers/footers. Currently users must manually calculate a custom range like "2-50".

**Implementation**:

```html
<!-- index.html, inside H/F modal -->
<label><input type="checkbox" id="hf-skip-first"> Skip first page</label>
<label><input type="checkbox" id="hf-skip-last"> Skip last page</label>
```

```javascript
// app.js - executeHeadersFooters modification
const skipFirst = $('hf-skip-first').checked;
const skipLast = $('hf-skip-last').checked;

let startPage = 1;
let endPage = 0; // 0 = all

if (skipFirst) startPage = 2;
if (skipLast) endPage = State.totalPages - 1;

// If custom range, intersect with skip logic
if (pageRange === 'custom') {
  const customPages = parsePageRanges(rangeText, State.totalPages);
  const filtered = customPages.filter(p => {
    if (skipFirst && p === 1) return false;
    if (skipLast && p === State.totalPages) return false;
    return true;
  });
  // Pass filtered set to applyHeadersFooters
}
```

**Files to modify**: `index.html` (checkboxes), `js/app.js` (filter logic)

---

### HF-3: Configurable Margins (Medium Value, Low Effort)

**Problem**: 36pt (0.5 inch) margin is hardcoded. Some documents need tighter or wider margins.

**Implementation**:

```html
<!-- index.html -->
<label>Margin (inches)
  <input type="number" id="hf-margin" min="0.25" max="1.5" step="0.25" value="0.5">
</label>
```

```javascript
// headers.js - accept margin parameter
async function applyHeadersFooters(pdfBytes, opts = {}) {
  const margin = (opts.margin || 0.5) * 72; // Convert inches to points
  // Replace all references to MARGIN constant with local margin variable
}
```

**Also update bates.js** to accept the same margin parameter for consistency.

**Files to modify**: `js/headers.js`, `js/bates.js` (margin parameter), `index.html` (input), `js/app.js` (read value)

---

### HF-4: Odd/Even Page Mirroring (Medium Value, Medium Effort)

**Problem**: Legal and book-style documents often need different headers on odd vs even pages (page number on the outside edge).

**Implementation**:

```html
<!-- index.html -->
<label><input type="checkbox" id="hf-mirror"> Mirror left/right for odd/even pages</label>
```

When enabled, left/right zones swap on even pages:
- Odd pages: left=left, right=right (as configured)
- Even pages: left=right, right=left (mirrored)

```javascript
// headers.js
function getZoneText(zones, position, pageNum, mirror) {
  if (!mirror) return zones[position] || '';
  const isEven = pageNum % 2 === 0;
  if (isEven) {
    if (position === 'topLeft') return zones.topRight || '';
    if (position === 'topRight') return zones.topLeft || '';
    if (position === 'bottomLeft') return zones.bottomRight || '';
    if (position === 'bottomRight') return zones.bottomLeft || '';
  }
  return zones[position] || '';
}
```

**Files to modify**: `js/headers.js` (mirror logic), `index.html` (checkbox), `js/app.js` (pass option)

---

### HF-5: Horizontal Rule Separator (Low Value, Easy)

**Problem**: Professional documents often have a thin line separating header/footer from body content.

```html
<label><input type="checkbox" id="hf-line"> Draw separator line</label>
```

```javascript
// headers.js - after drawing text in each zone
if (opts.drawLine) {
  const lineY_top = pageH - margin - fontSize - 4;
  const lineY_bot = margin + fontSize + 4;

  if (hasTopContent) {
    page.drawLine({
      start: { x: margin, y: lineY_top },
      end: { x: pageW - margin, y: lineY_top },
      thickness: 0.5,
      color: PDFLib.rgb(r, g, b)
    });
  }
  if (hasBottomContent) {
    page.drawLine({
      start: { x: margin, y: lineY_bot },
      end: { x: pageW - margin, y: lineY_bot },
      thickness: 0.5,
      color: PDFLib.rgb(r, g, b)
    });
  }
}
```

**Files to modify**: `js/headers.js` (line drawing), `index.html` (checkbox), `js/app.js` (pass option)

---

### HF-6: Additional Tokens (Low Value, Easy)

| Token | Resolves To | Implementation |
|-------|-------------|----------------|
| `{time}` | Current time (HH:MM AM/PM) | `new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})` |
| `{author}` | PDF metadata author field | `pdfDoc.getAuthor() \|\| ''` |
| `{title}` | PDF metadata title field | `pdfDoc.getTitle() \|\| ''` |

```javascript
// headers.js - extend replaceTokens()
function replaceTokens(template, pageNum, totalPages, filename, pdfDoc) {
  return template
    .replace(/\{page\}/g, String(pageNum))
    .replace(/\{pages\}/g, String(totalPages))
    .replace(/\{date\}/g, new Date().toLocaleDateString('en-US'))
    .replace(/\{time\}/g, new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}))
    .replace(/\{filename\}/g, filename)
    .replace(/\{author\}/g, pdfDoc.getAuthor() || '')
    .replace(/\{title\}/g, pdfDoc.getTitle() || '');
}
```

**Files to modify**: `js/headers.js` (token expansion), `index.html` (token buttons)

---

### HF-7: Preview on Actual Page (Medium Value, Higher Effort)

**Problem**: The current preview is a 3x2 text grid. Users can't see how headers look relative to actual page content.

**Proposed**: Render a scaled thumbnail of the current page with header/footer text overlaid on a canvas.

```javascript
// app.js - enhanced preview
async function updateHfPreviewOnPage() {
  const canvas = document.getElementById('hf-preview-canvas');
  const ctx = canvas.getContext('2d');

  // Render current page at thumbnail scale
  const page = await State.pdfDoc.getPage(State.currentPage);
  const thumbScale = 0.3;
  const viewport = page.getViewport({ scale: thumbScale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Overlay header/footer text at scaled positions
  const margin = 36 * thumbScale;
  const fontSize = ($('hf-font-size').value || 10) * thumbScale;
  ctx.font = `${fontSize}px Helvetica`;
  ctx.fillStyle = $('hf-color').value || '#000000';
  // ... position and draw text for each zone
}
```

**Files to modify**: `index.html` (add canvas to modal), `js/app.js` (render preview)

---

### Header/Footer Priority Summary

| ID | Enhancement | Value | Effort | Do When |
|----|-------------|-------|--------|---------|
| HF-1 | Font selection | High | Low | Now - 6 fonts, zero external deps |
| HF-2 | Skip first/last page | High | Low | Now - most-requested for legal docs |
| HF-3 | Configurable margins | Medium | Low | Now - trivial change, high flexibility |
| HF-4 | Odd/even page mirroring | Medium | Medium | Soon - important for book-style output |
| HF-6 | Additional tokens | Low | Low | Soon - easy wins |
| HF-5 | Separator line | Low | Low | Eventually - cosmetic |
| HF-7 | On-page preview | Medium | High | Eventually - nice but current preview works |

---

## Implementation Roadmap

### Sprint 1 - Quick Wins (1-2 days)

| Task | System | ID | Effort |
|------|--------|----|--------|
| Font selection dropdown | H/F | HF-1 | 2 hours |
| Skip first/last page checkboxes | H/F | HF-2 | 1 hour |
| Configurable margin input | H/F | HF-3 | 1 hour |
| Persist OCR results to IndexedDB | OCR | OCR-5 | 2 hours |
| Confidence threshold slider | OCR | OCR-3 | 1 hour |
| Additional tokens ({time}, {author}, {title}) | H/F | HF-6 | 1 hour |

### Sprint 2 - Core Improvements (3-5 days)

| Task | System | ID | Effort |
|------|--------|----|--------|
| Parallel OCR workers | OCR | OCR-1 | 1 day |
| Rotated page bbox transform | OCR | OCR-2 | 0.5 day |
| Image pre-processing option | OCR | OCR-4 | 1 day |
| Odd/even page mirroring | H/F | HF-4 | 0.5 day |
| Separator line option | H/F | HF-5 | 2 hours |

### Sprint 3 - Polish (2-3 days)

| Task | System | ID | Effort |
|------|--------|----|--------|
| On-page header preview | H/F | HF-7 | 1 day |
| OCR test coverage for new features | OCR | - | 0.5 day |
| Header/footer test coverage | H/F | - | 0.5 day |

---

## Architecture Notes

### No Breaking Changes Required

Both systems are well-isolated:
- `ocr.js` is a self-contained module with clean exports
- `headers.js` is a pure function (pdfBytes in, pdfBytes out)
- All enhancements are additive: new optional parameters with backward-compatible defaults
- No changes to the document model, state management, or export pipeline

### Shared Infrastructure

- **Page range parsing**: Already shared via `parsePageRanges()` - continue using it
- **Operation locking**: Already in place via `acquireOperationLock()` - no changes needed
- **Margin constant**: After HF-3, consider making Bates numbering use the same configurable margin

### How These Systems Relate to Each Other

```
Headers/Footers (headers.js)     Bates Numbering (bates.js)     Exhibit Stamps (exhibit-stamps.js)
     |                                |                                |
     | pdf-lib drawText()            | pdf-lib drawText()            | Fabric.js canvas objects
     | Baked into PDF immediately    | Baked into PDF immediately    | Baked on export only
     | 6 zones, template tokens      | 1 zone, sequential numbers    | Drag-and-drop placement
     | Fixed positions               | Fixed positions               | Free placement
     |                                |                                |
     v                                v                                v
  Permanent in PDF bytes          Permanent in PDF bytes          Annotation layer (export.js)
```

All three systems are independent. Headers and Bates share the 6-position model and margin constant. Exhibit stamps are fundamentally different (canvas annotations, not PDF text).

### Testing Strategy

| Feature | Test Approach |
|---------|--------------|
| OCR parallel workers | Mock Tesseract workers, verify result ordering matches page order |
| Rotated pages | Test 0/90/180/270 degree bbox transforms with known coordinates |
| Font selection | Verify pdf-lib embeds the correct StandardFont by name |
| Skip first/last | Edge cases: 1-page doc, 2-page doc, skip both |
| Margin | Verify text doesn't clip at extreme values (0.25", 1.5") |
| New tokens | Verify all tokens resolve correctly, including empty PDF metadata |
| Mirror mode | Verify left/right swap on even pages only |
| OCR persistence | Save to IndexedDB, restore, verify text layer renders |
