# Mudbrick PDF Editor — Feature Implementation Prompt

Use this prompt with Claude Code to implement all 6 features. Copy the entire content below.

---

## PROMPT START

You are working on **Mudbrick**, a browser-based PDF editor at `c:\Users\OliverPerez\fido\mudbrick`. It uses vanilla JS (no framework, no build step), with PDF.js for rendering, pdf-lib for mutations, and Fabric.js for annotation overlays. All libraries load via CDN as globals (`window.PDFLib`, `window.fabric`, `pdfjsLib`).

### Your task: Implement 7 features in order (Feature 0 is a critical fix, Features 1-5 are new capabilities, Feature 6 is OCR enhancement). Commit each feature separately.

Before starting, commit any uncommitted changes in the working directory (js/app.js and js/export.js) with message: `fix: native text export and text-edit double-click priority`.

Then implement features in this order:

---

## Feature 0: Preserve Existing PDF Links on Export (CRITICAL FIX)

**Problem:** When a PDF with clickable links is opened, edited, and exported, ALL link annotations are silently destroyed. This is data loss.

**Files to modify:**
- `js/export.js` — Add link preservation step in `exportAnnotatedPDF()`

**Implementation:**
1. In `exportAnnotatedPDF()`, after annotation baking but before `pdfDoc.save()`, copy link annotations from the original PDF to the exported PDF.
2. Use pdf-lib to read `/Annots` arrays from the original document's pages, filter for `/Link` subtype annotations, and copy them to the corresponding pages in the export document.
3. The original `pdfBytes` are available in the function params. Load a reference copy with `PDFDocument.load(pdfBytes)` to read original annotations from.
4. For each page, iterate the original page's annotations:
   ```javascript
   const origDoc = await PDFDocument.load(pdfBytes);
   // After all annotation baking is done, before save:
   for (let i = 0; i < pdfDoc.getPageCount(); i++) {
     const origPage = origDoc.getPage(i);
     const exportPage = pdfDoc.getPage(i);
     const annots = origPage.node.lookup(PDFLib.PDFName.of('Annots'));
     if (!annots) continue;
     // Filter for Link annotations and copy their dicts to export page
   }
   ```
5. This preserves links the user didn't touch. Link rects that overlap with cover/redact annotations should be excluded (they've been deliberately hidden).

**Test:** Open a PDF with links → add an annotation → export → verify links still work in the exported PDF.

---

## Feature 1: Image Watermarks

**Problem:** Only text watermarks exist (`addWatermark` in js/pdf-edit.js:314). Users need logo/image watermarks.

**Files to modify:**
- `js/pdf-edit.js` — Add `addImageWatermark()` function
- `index.html` — Extend watermark modal (lines 946-996) with image tab
- `js/app.js` — Wire image watermark tab and apply button

**Implementation:**

### pdf-edit.js — Add after `addWatermark()` (line 368):
```javascript
export async function addImageWatermark(pdfBytes, opts = {}) {
  const PDFLib = getPDFLib();
  const doc = await ensurePdfLib(pdfBytes);
  const {
    imageBytes,           // Uint8Array of PNG or JPEG
    imageType = 'png',    // 'png' or 'jpeg'
    scale = 0.3,          // 0.1-2.0 relative to page width
    opacity = 0.15,
    rotation = 0,
    position = 'center',  // center | tile | top-left | top-right | bottom-left | bottom-right
    tileGap = 50,
    pages = 'all',
    currentPage = 1,
  } = opts;

  // Embed image
  const image = imageType === 'png'
    ? await doc.embedPng(imageBytes)
    : await doc.embedJpg(imageBytes);

  const pageCount = doc.getPageCount();
  const startIdx = pages === 'current' ? currentPage - 1 : 0;
  const endIdx = pages === 'current' ? currentPage : pageCount;

  for (let i = startIdx; i < endIdx; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const imgW = width * scale;
    const imgH = imgW * (image.height / image.width);

    if (position === 'tile') {
      // Tile across page
      for (let ty = height; ty > -imgH; ty -= imgH + tileGap) {
        for (let tx = 0; tx < width; tx += imgW + tileGap) {
          page.drawImage(image, {
            x: tx, y: ty - imgH, width: imgW, height: imgH,
            opacity, rotate: PDFLib.degrees(rotation),
          });
        }
      }
    } else {
      // Calculate position
      let x, y;
      switch (position) {
        case 'top-left':     x = 20; y = height - imgH - 20; break;
        case 'top-right':    x = width - imgW - 20; y = height - imgH - 20; break;
        case 'bottom-left':  x = 20; y = 20; break;
        case 'bottom-right': x = width - imgW - 20; y = 20; break;
        default: /* center */
          x = (width - imgW) / 2;
          y = (height - imgH) / 2;
      }
      page.drawImage(image, {
        x, y, width: imgW, height: imgH,
        opacity, rotate: PDFLib.degrees(rotation),
      });
    }
  }
  return doc.save();
}
```

### index.html — Replace watermark modal body (lines 953-989):
Add a tab toggle at the top of `.modal-form-stack`:
```html
<div class="watermark-type-tabs" style="display:flex;gap:0;margin-bottom:12px;">
  <button class="btn-tab active" id="watermark-tab-text" style="flex:1;">Text</button>
  <button class="btn-tab" id="watermark-tab-image" style="flex:1;">Image</button>
</div>
<div id="watermark-text-fields">
  <!-- existing text fields stay here unchanged -->
</div>
<div id="watermark-image-fields" class="hidden">
  <div>
    <label class="modal-form-label" for="watermark-image-file">Image (PNG/JPEG)</label>
    <input type="file" id="watermark-image-file" accept="image/png,image/jpeg" class="modal-form-input">
  </div>
  <div id="watermark-image-preview" class="hidden" style="text-align:center;margin:8px 0;">
    <img id="watermark-image-thumb" style="max-height:100px;opacity:0.5;" alt="Preview">
  </div>
  <div class="modal-form-grid">
    <div>
      <label class="modal-form-label" for="watermark-image-scale">Scale</label>
      <input type="range" id="watermark-image-scale" min="0.05" max="1" step="0.05" value="0.3" class="w-full">
      <span id="watermark-image-scale-value" class="range-value-label">30%</span>
    </div>
    <div>
      <label class="modal-form-label" for="watermark-image-opacity">Opacity</label>
      <input type="range" id="watermark-image-opacity" min="0.05" max="0.5" step="0.05" value="0.15" class="w-full">
      <span id="watermark-image-opacity-value" class="range-value-label">15%</span>
    </div>
  </div>
  <div class="modal-form-grid">
    <div>
      <label class="modal-form-label" for="watermark-image-position">Position</label>
      <select id="watermark-image-position" class="modal-form-input">
        <option value="center">Center</option>
        <option value="tile">Tile (repeat)</option>
        <option value="top-left">Top Left</option>
        <option value="top-right">Top Right</option>
        <option value="bottom-left">Bottom Left</option>
        <option value="bottom-right">Bottom Right</option>
      </select>
    </div>
    <div>
      <label class="modal-form-label" for="watermark-image-rotation">Rotation</label>
      <input type="number" id="watermark-image-rotation" value="0" min="-180" max="180" class="modal-form-input">
    </div>
  </div>
  <!-- Reuse existing watermark-pages select for page scope -->
</div>
```

### app.js — Wire the modal:
- Tab buttons toggle `.hidden` on `#watermark-text-fields` / `#watermark-image-fields` and swap `.active` class
- File input `change` → read as ArrayBuffer, show preview thumbnail, detect PNG vs JPEG
- Apply button: check active tab, call `addWatermark()` or `addImageWatermark()` accordingly
- Scale/opacity range inputs → update their value labels on `input` event

---

## Feature 2: Link Editing

**Problem:** No way to add, edit, remove, or follow hyperlinks in PDFs.

**Files to create:**
- `js/links.js` — Link annotation management module

**Files to modify:**
- `js/annotations.js` — Add `'link'` tool, extend `CUSTOM_PROPS`
- `js/export.js` — Convert Fabric link objects → real PDF link annotations
- `js/app.js` — Wire link tool, link properties panel, double-click to follow
- `index.html` — Link button in Annotate ribbon, link properties in properties panel

**Implementation:**

### js/links.js — New module:
```javascript
/**
 * Mudbrick — Link Annotations
 * Create, edit, and follow hyperlinks on PDF pages.
 */

const getFabric = () => window.fabric;

/**
 * Create a link rectangle on the Fabric canvas.
 */
export function createLinkRect(fabricCanvas, x, y, w, h, opts = {}) {
  const fabric = getFabric();
  const rect = new fabric.Rect({
    left: x, top: y, width: w, height: h,
    fill: 'rgba(0, 100, 255, 0.08)',
    stroke: '#0066cc',
    strokeWidth: 1,
    strokeDashArray: [4, 3],
    selectable: true,
    evented: true,
    mudbrickType: 'link',
    linkType: opts.linkType || 'url',    // 'url' or 'page'
    linkURL: opts.linkURL || '',
    linkPage: opts.linkPage || 1,
  });
  fabricCanvas.add(rect);
  fabricCanvas.setActiveObject(rect);
  return rect;
}

/**
 * Follow a link — open URL or navigate to page.
 */
export function followLink(obj, goToPageFn) {
  if (!obj || obj.mudbrickType !== 'link') return;
  if (obj.linkType === 'url' && obj.linkURL) {
    window.open(obj.linkURL, '_blank', 'noopener');
  } else if (obj.linkType === 'page' && obj.linkPage) {
    goToPageFn(obj.linkPage);
  }
}

/**
 * Read existing link annotations from a PDF page using pdf-lib.
 * Returns array of { x, y, width, height, type, url, page }.
 */
export function extractLinksFromPage(pdfPage, pageHeight) {
  const PDFLib = window.PDFLib;
  const links = [];
  const annotsRef = pdfPage.node.lookup(PDFLib.PDFName.of('Annots'));
  if (!annotsRef || !(annotsRef instanceof PDFLib.PDFArray)) return links;

  for (let i = 0; i < annotsRef.size(); i++) {
    const annotDict = annotsRef.lookup(i);
    if (!annotDict) continue;
    const subtype = annotDict.lookup(PDFLib.PDFName.of('Subtype'));
    if (!subtype || subtype.toString() !== '/Link') continue;

    const rect = annotDict.lookup(PDFLib.PDFName.of('Rect'));
    if (!rect) continue;
    const [x1, y1, x2, y2] = rect.asArray().map(n => n.asNumber());

    const action = annotDict.lookup(PDFLib.PDFName.of('A'));
    let linkType = 'url', url = '', page = 1;
    if (action) {
      const sType = action.lookup(PDFLib.PDFName.of('S'));
      if (sType && sType.toString() === '/URI') {
        url = action.lookup(PDFLib.PDFName.of('URI'))?.decodeText() || '';
        linkType = 'url';
      } else if (sType && sType.toString() === '/GoTo') {
        linkType = 'page';
        // Extract destination page — implementation depends on dest format
      }
    }

    links.push({
      x: Math.min(x1, x2),
      y: pageHeight - Math.max(y1, y2),  // Convert PDF coords to canvas coords
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      type: linkType, url, page,
    });
  }
  return links;
}

/**
 * Write a Fabric link object as a real PDF link annotation on export.
 */
export function writeLinkToPDF(page, linkObj, canvasW, canvasH, pageW, pageH) {
  const PDFLib = window.PDFLib;
  const sx = pageW / canvasW;
  const sy = pageH / canvasH;

  const x1 = (linkObj.left || 0) * sx;
  const y1 = pageH - ((linkObj.top || 0) * sy) - ((linkObj.height || 0) * (linkObj.scaleY || 1) * sy);
  const x2 = x1 + (linkObj.width || 0) * (linkObj.scaleX || 1) * sx;
  const y2 = y1 + (linkObj.height || 0) * (linkObj.scaleY || 1) * sy;

  const context = page.node.context;
  const annotDict = context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x1, y1, x2, y2],
    Border: [0, 0, 0],
    A: linkObj.linkType === 'url'
      ? { S: 'URI', URI: PDFLib.PDFString.of(linkObj.linkURL || '') }
      : { S: 'GoTo', D: [page.node, PDFLib.PDFName.of('Fit')] },
  });

  const existingAnnots = page.node.lookup(PDFLib.PDFName.of('Annots'));
  if (existingAnnots instanceof PDFLib.PDFArray) {
    existingAnnots.push(context.register(annotDict));
  } else {
    page.node.set(PDFLib.PDFName.of('Annots'), context.obj([context.register(annotDict)]));
  }
}
```

### annotations.js changes:
1. Line 34 — Extend: `const CUSTOM_PROPS = ['mudbrickType', 'noteText', 'noteColor', 'linkType', 'linkURL', 'linkPage', 'commentThread'];`
2. In `setTool()` — Add case after 'sticky-note' (line 445):
```javascript
case 'link':
  wrapper.style.pointerEvents = 'auto';
  fabricCanvas.selection = false;
  fabricCanvas.defaultCursor = 'crosshair';
  fabricCanvas.forEachObject(o => { o.selectable = false; o.evented = false; });
  break;
```
3. In the `mouse:down` handler — add link drawing logic (click-drag to draw rect, on mouse:up create link via `createLinkRect()`, then open the link editor popover).
4. On `mouse:dblclick` — if target has `mudbrickType === 'link'`, call `followLink()`.

### export.js changes:
After annotation baking loop, before `pdfDoc.save()`:
- Iterate all pages, find Fabric objects with `mudbrickType === 'link'`
- Call `writeLinkToPDF()` for each to create real PDF `/Link` annotations
- Link objects should NOT be rendered to the PNG overlay (exclude them alongside cover/redact)

### index.html changes:
- Annotate ribbon: Add `<button id="btn-link" data-tool="link" title="Add Link">` with a link icon
- Properties panel: When a link annotation is selected, show:
  - Radio: "Web URL" / "Go to Page"
  - URL input (for web) or page number input (for page)
  - "Follow Link" button
  - "Remove Link" button

### app.js wiring:
- `btn-link` click → `selectTool('link')`
- Selection handler: if `mudbrickType === 'link'`, populate link properties panel
- Save handler: update `linkURL` / `linkPage` / `linkType` on the Fabric object
- Double-click handler: call `followLink(obj, goToPage)`

---

## Feature 3: Commenting / Reply Threads

**Problem:** Sticky notes are flat (just `noteText` string). No replies, no author, no status, no threading.

**Files to create:**
- `js/comments.js` — Comment thread data model and operations

**Files to modify:**
- `js/annotations.js` — Extend CUSTOM_PROPS with `commentThread` (already added in Feature 2 step)
- `js/comment-summary.js` — Export threaded comments
- `js/app.js` — Wire comments sidebar tab, thread UI in properties panel
- `index.html` — Comments sidebar tab, reply UI, author name setting
- `styles/layout.css` — Thread styling

**Data model:**

Every annotation gets a `commentThread` property:
```javascript
{
  id: crypto.randomUUID(),
  author: 'User Name',     // from localStorage
  created: '2026-03-06T...',
  status: 'open',           // open | resolved | accepted | rejected
  replies: [
    { id: 'uuid', author: 'Name', date: 'ISO', text: 'Reply text' },
  ]
}
```

### js/comments.js — New module:
```javascript
/**
 * Mudbrick — Comment Threading
 */

const AUTHOR_KEY = 'mudbrick_author_name';

export function getAuthorName() {
  return localStorage.getItem(AUTHOR_KEY) || 'Anonymous';
}

export function setAuthorName(name) {
  localStorage.setItem(AUTHOR_KEY, name || 'Anonymous');
}

export function createThread(author) {
  return {
    id: crypto.randomUUID(),
    author: author || getAuthorName(),
    created: new Date().toISOString(),
    status: 'open',
    replies: [],
  };
}

export function addReply(thread, text, author) {
  if (!thread || !text.trim()) return;
  thread.replies.push({
    id: crypto.randomUUID(),
    author: author || getAuthorName(),
    date: new Date().toISOString(),
    text: text.trim(),
  });
}

export function editReply(thread, replyId, newText) {
  const reply = thread?.replies?.find(r => r.id === replyId);
  if (reply) reply.text = newText;
}

export function deleteReply(thread, replyId) {
  if (!thread?.replies) return;
  thread.replies = thread.replies.filter(r => r.id !== replyId);
}

export function setThreadStatus(thread, status) {
  if (thread) thread.status = status;
}

/** Collect all threads across all pages. */
export function getAllThreads(pageAnnotations) {
  const threads = [];
  for (const [pageNum, json] of Object.entries(pageAnnotations)) {
    if (!json?.objects) continue;
    json.objects.forEach((obj, idx) => {
      if (obj.commentThread) {
        threads.push({
          pageNum: Number(pageNum),
          index: idx,
          type: obj.mudbrickType || 'unknown',
          text: obj.noteText || obj.text || '',
          thread: obj.commentThread,
        });
      }
    });
  }
  threads.sort((a, b) => new Date(b.thread.created) - new Date(a.thread.created));
  return threads;
}

/** Export all threads as XFDF-like XML string for interop. */
export function exportThreadsXFDF(pageAnnotations, fileName) {
  const threads = getAllThreads(pageAnnotations);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/">\n<annots>\n`;
  for (const t of threads) {
    xml += `  <text page="${t.pageNum - 1}" subject="${t.type}" date="${t.thread.created}" name="${t.thread.id}" title="${t.thread.author}">\n`;
    xml += `    <contents>${escapeXml(t.text)}</contents>\n`;
    for (const r of t.thread.replies) {
      xml += `    <popup date="${r.date}" title="${r.author}">${escapeXml(r.text)}</popup>\n`;
    }
    xml += `  </text>\n`;
  }
  xml += `</annots>\n</xfdf>`;
  return xml;
}

function escapeXml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

### annotations.js changes:
- When creating ANY annotation (text, sticky-note, shape, stamp, highlight, etc.), auto-attach:
  ```javascript
  import { createThread, getAuthorName } from './comments.js';
  // In addText(), addStickyNote(), addStamp(), shape creation, etc.:
  obj.commentThread = createThread(getAuthorName());
  ```
- Make sure `commentThread` is in CUSTOM_PROPS so it persists in JSON serialization.

### index.html changes:
1. **Sidebar tab** — Add after the "Notes" tab button (line 572):
   ```html
   <button class="sidebar-tab" data-sidebar="comments" title="Comments" aria-label="Comments">
     <span data-icon="chat"></span>
     <span class="sidebar-tab-label">Comments</span>
   </button>
   ```
2. **Sidebar panel** — Add comments list container:
   ```html
   <div id="sidebar-comments" class="sidebar-panel hidden">
     <div style="padding:8px;display:flex;gap:6px;">
       <select id="comment-filter-status" class="modal-form-input" style="flex:1;font-size:12px;">
         <option value="all">All</option>
         <option value="open">Open</option>
         <option value="resolved">Resolved</option>
       </select>
       <button id="btn-export-comments-xfdf" class="btn-secondary" style="font-size:11px;">Export</button>
     </div>
     <div id="comments-list" style="overflow-y:auto;flex:1;"></div>
   </div>
   ```
3. **Properties panel thread UI** — When any annotation is selected, show below existing properties:
   ```html
   <div id="comment-thread-panel" class="hidden" style="border-top:1px solid var(--border);padding:8px;margin-top:8px;">
     <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
       <span style="font-weight:600;font-size:12px;">Comments</span>
       <select id="comment-status" style="font-size:11px;padding:2px 4px;">
         <option value="open">Open</option>
         <option value="resolved">Resolved</option>
         <option value="accepted">Accepted</option>
         <option value="rejected">Rejected</option>
       </select>
     </div>
     <div id="comment-replies" style="max-height:200px;overflow-y:auto;margin-bottom:6px;"></div>
     <div style="display:flex;gap:4px;">
       <input id="comment-reply-input" type="text" placeholder="Add reply..." style="flex:1;font-size:12px;padding:4px;">
       <button id="btn-comment-reply" class="btn-primary" style="font-size:11px;padding:4px 8px;">Reply</button>
     </div>
   </div>
   ```
4. **Author name** — Add to Help menu or a gear icon in the comments sidebar:
   ```html
   <div id="author-name-setting" style="padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;">
     <label>Your name: <input id="author-name-input" type="text" style="width:100px;font-size:11px;" placeholder="Anonymous"></label>
   </div>
   ```

### app.js wiring:
- On annotation selection: check for `commentThread`, show `#comment-thread-panel`, render replies
- Reply button: call `addReply()`, re-render, save annotations
- Status dropdown change: call `setThreadStatus()`, update sidebar badge
- Comments sidebar tab: call `getAllThreads()`, render list with page navigation on click
- Filter dropdown: re-render list filtered by status
- Author name input: `setAuthorName()` on change, load on init
- Export button: `exportThreadsXFDF()` → download as .xfdf file

### comment-summary.js changes:
- In `collectComments()`: include `thread` data (replies, status, author) in returned objects
- In JSON export: nest replies under each comment
- In CSV export: flatten — one row per reply with parent comment reference
- In text export: indent replies under parent

---

## Feature 4: Advanced Text Editing (Font Embedding + Reflow)

**Problem:** Text editing only supports pdf-lib's 14 standard fonts. No custom fonts. No word-wrap reflow when edited text changes length.

**Files to create:**
- `js/font-manager.js` — Font loading, embedding, caching

**Files to modify:**
- `js/text-edit.js` — Reflow engine, font picker, alignment
- `js/pdf-edit.js` — Font embedding helpers
- `js/app.js` — Wire font upload, font picker
- `index.html` — Font picker in text edit toolbar, font upload button, alignment controls

**Implementation:**

### js/font-manager.js — New module:
```javascript
/**
 * Mudbrick — Font Manager
 * Load custom fonts for both CSS rendering (contenteditable) and pdf-lib embedding.
 */

const DB_NAME = 'mudbrick_fonts';
const STORE_NAME = 'fonts';

/** In-memory cache: fontName → { name, bytes, cssFamily } */
const loadedFonts = new Map();

// Standard fonts always available (no upload needed)
const STANDARD_FONTS = [
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'TimesRoman', 'TimesRoman-Bold', 'TimesRoman-Italic', 'TimesRoman-BoldItalic',
];

export function getStandardFonts() { return [...STANDARD_FONTS]; }
export function getLoadedFonts() { return [...loadedFonts.keys()]; }
export function getAllFontNames() { return [...new Set([...STANDARD_FONTS.map(f => f.split('-')[0]), ...loadedFonts.keys()])]; }

/**
 * Load a .ttf or .otf font file. Registers it for CSS and caches bytes for pdf-lib.
 * @returns {{ name: string, bytes: Uint8Array, cssFamily: string }}
 */
export async function loadCustomFont(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
  const cssFamily = `mudbrick-${name}`;

  // Register CSS @font-face
  const blob = new Blob([bytes], { type: 'font/ttf' });
  const url = URL.createObjectURL(blob);
  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: '${cssFamily}'; src: url('${url}'); }`;
  document.head.appendChild(style);

  const entry = { name, bytes, cssFamily, styleEl: style };
  loadedFonts.set(name, entry);

  // Persist to IndexedDB
  await saveFontToDB(name, bytes);

  return entry;
}

/**
 * Embed a custom font into a pdf-lib document. Returns the embedded font object.
 */
export async function embedInPdfLib(pdfDoc, fontName) {
  const entry = loadedFonts.get(fontName);
  if (!entry) return null;
  return pdfDoc.embedFont(entry.bytes, { subset: true });
}

/**
 * Get CSS font-family string for a loaded custom font.
 */
export function getCSSFamily(fontName) {
  const entry = loadedFonts.get(fontName);
  return entry ? `'${entry.cssFamily}', sans-serif` : null;
}

/**
 * Measure text width using a temporary canvas (works for any CSS font).
 */
export function measureTextWidth(text, fontFamily, fontSize) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/** Restore fonts from IndexedDB on startup. */
export async function restoreFonts() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await idbGetAll(store);
    for (const record of all) {
      const cssFamily = `mudbrick-${record.name}`;
      const blob = new Blob([record.bytes], { type: 'font/ttf' });
      const url = URL.createObjectURL(blob);
      const style = document.createElement('style');
      style.textContent = `@font-face { font-family: '${cssFamily}'; src: url('${url}'); }`;
      document.head.appendChild(style);
      loadedFonts.set(record.name, { name: record.name, bytes: record.bytes, cssFamily, styleEl: style });
    }
  } catch { /* IndexedDB unavailable — custom fonts won't persist */ }
}

// --- IndexedDB helpers ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveFontToDB(name, bytes) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ name, bytes });
}
function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

### text-edit.js changes:

1. **Font picker** — In `createToolbar()`, add a `<select>` dropdown listing all standard fonts + custom fonts + an "Upload font..." option at the bottom. When "Upload font..." is selected, trigger a hidden file input to call `loadCustomFont()`, then add the font to the dropdown and select it.

2. **Text alignment** — Add 4 buttons to toolbar: left, center, right, justify. Store alignment per block in `_editedBlocks`. When alignment changes, update `textAlign` CSS on the contenteditable divs.

3. **Reflow engine** — Add a `reflowParagraph(paraIdx)` function:
   ```javascript
   function reflowParagraph(paraIdx) {
     const block = _paragraphData[paraIdx];
     if (!block || !block.lines.length) return;

     // Get bounding box width from the first line
     const maxWidth = block.lines[0].width || block.lines.reduce((m, l) => Math.max(m, l.width), 0);
     const fontSize = block.lines[0].fontSize || 12;
     const fontFamily = block.lines[0].fontFamily || 'Helvetica, sans-serif';

     // Collect all text from all lines in the block
     const fullText = block.lines.map(l => l.text).join(' ');

     // Word-wrap using canvas measurement
     const words = fullText.split(/\s+/);
     const newLines = [];
     let currentLine = '';

     for (const word of words) {
       const testLine = currentLine ? currentLine + ' ' + word : word;
       const testWidth = measureTextWidth(testLine, fontFamily, fontSize);
       if (testWidth > maxWidth && currentLine) {
         newLines.push(currentLine);
         currentLine = word;
       } else {
         currentLine = testLine;
       }
     }
     if (currentLine) newLines.push(currentLine);

     // Update the contenteditable divs to reflect new line breaks
     // Recalculate Y positions for each line
     updateBlockLines(paraIdx, newLines, fontSize, fontFamily);
   }
   ```
   Call `reflowParagraph()` on `input` events in contenteditable divs (debounced 300ms).

4. **commitTextEdits() changes** — When committing:
   - If a custom font was used, call `embedInPdfLib(pdfDoc, fontName)` to get the font object
   - Use the embedded font for `page.drawText()` instead of StandardFonts
   - Handle text alignment: for center, offset x by `(maxWidth - lineWidth) / 2`; for right, offset by `maxWidth - lineWidth`; for justify, calculate word spacing

5. **Line height control** — Add a small dropdown or input (1.0, 1.15, 1.5, 2.0) in the toolbar. Apply as multiplier to line spacing in both the contenteditable display and the PDF commit.

### pdf-edit.js — Add helper:
```javascript
export async function embedCustomFont(pdfBytes, fontBytes) {
  const doc = await ensurePdfLib(pdfBytes);
  return doc.embedFont(fontBytes, { subset: true });
}
```

### index.html — Text edit toolbar additions:
The text edit toolbar is created dynamically in `text-edit.js`'s `createToolbar()`. The changes go there, not in index.html. But if there's a static toolbar section in HTML for text editing, add:
- Font family `<select>` with id `text-edit-font-family`
- Alignment buttons group
- Line height selector
- "Upload Font" button (hidden file input pattern)

### app.js — On PDF open:
- Call `restoreFonts()` from font-manager.js to reload persisted custom fonts
- No other wiring needed — text-edit.js manages its own toolbar

---

## Feature 5: Enhanced OCR

**Problem:** The current OCR system (js/ocr.js, 284 lines) is functional but limited:
- English only — no language selection
- No way to make OCR'd text editable (it's invisible spans for search only)
- No auto-detect for scanned pages on open
- No confidence indicators — user doesn't know if OCR quality was good
- Can't export OCR'd text as a separate file
- No way to correct OCR mistakes
- No option to embed OCR text as a real invisible text layer in the PDF (for permanent searchability after export)

**Files to modify:**
- `js/ocr.js` — Multi-language, confidence display, text correction, PDF text layer embedding
- `js/export.js` — Embed OCR text as invisible PDF text layer on export
- `js/app.js` — Wire new OCR modal options, auto-detect, correction UI
- `index.html` — Extend OCR modal with language picker, confidence view, correction mode, export options
- `styles/layout.css` — OCR confidence highlighting, correction UI styles

**Implementation:**

### 1. Multi-Language Support

In `js/ocr.js`, modify `runOCR()` to accept a `language` parameter:

```javascript
// Current (line 73):
worker = await window.Tesseract.createWorker('eng');

// Change to:
export async function runOCR(pdfDoc, pageNumbers, onProgress, options = {}) {
  const { language = 'eng', confidenceThreshold = 60 } = options;
  // ...
  if (!worker) {
    worker = await window.Tesseract.createWorker(language);
  } else if (worker._lang !== language) {
    // Language changed — recreate worker
    await worker.terminate();
    worker = await window.Tesseract.createWorker(language);
  }
  worker._lang = language;
  // ...
}
```

Tesseract.js supports 100+ languages. Add the most common ones to the modal dropdown:
- `eng` (English), `spa` (Spanish), `fra` (French), `deu` (German), `por` (Portuguese), `ita` (Italian), `jpn` (Japanese), `kor` (Korean), `chi_sim` (Chinese Simplified), `chi_tra` (Chinese Traditional), `ara` (Arabic), `rus` (Russian), `hin` (Hindi)
- Multi-language: `eng+spa` format for combined recognition

### 2. Confidence Indicators

Store per-word confidence in `ocrResults`:
```javascript
// Already stored (line 119): confidence: word.confidence
// Add page-level summary:
ocrResults[pageNum] = {
  words,
  lines,
  fullText: fullText.trim(),
  pageHeight,
  avgConfidence: words.length ? words.reduce((s, w) => s + w.confidence, 0) / words.length : 0,
  lowConfidenceWords: words.filter(w => w.confidence < 70),
};
```

In `renderOCRTextLayer()`, add visual confidence coloring:
```javascript
// After creating each span (line 211):
if (word.confidence < 50) {
  span.classList.add('ocr-low-confidence');
} else if (word.confidence < 70) {
  span.classList.add('ocr-medium-confidence');
}
```

CSS classes for layout.css:
```css
.ocr-low-confidence { background: rgba(255, 0, 0, 0.15) !important; }
.ocr-medium-confidence { background: rgba(255, 165, 0, 0.10) !important; }
.ocr-confidence-toggle .ocr-low-confidence,
.ocr-confidence-toggle .ocr-medium-confidence { color: inherit !important; }
```

### 3. Auto-Detect Scanned Pages on Open

In `js/app.js`, after opening a PDF, run a quick scan check on the first few pages:
```javascript
// After renderCurrentPage() in openPDF():
async function autoDetectScannedPages(pdfDoc, totalPages) {
  const scannedPages = [];
  const checkCount = Math.min(totalPages, 5); // Check first 5 pages
  for (let i = 1; i <= checkCount; i++) {
    if (await isPageScanned(pdfDoc, i)) {
      scannedPages.push(i);
    }
  }
  if (scannedPages.length >= Math.ceil(checkCount / 2)) {
    // More than half are scanned — show suggestion toast
    showToast(`This PDF appears to be scanned. Run OCR (Tools → OCR) to make text searchable.`, 'info', 8000);
  }
}
```

Call `autoDetectScannedPages()` in a `setTimeout(..., 1000)` after PDF opens so it doesn't block initial render.

### 4. OCR Text Correction Mode

Add a new export function to `js/ocr.js`:
```javascript
/**
 * Enter OCR correction mode — make OCR text spans editable.
 * User can click on words to correct them.
 */
export function enableCorrectionMode(pageNum, container) {
  const spans = container.querySelectorAll('.ocr-text-span');
  spans.forEach(span => {
    span.style.color = 'rgba(0,0,0,0.7)';
    span.style.background = 'rgba(255,255,200,0.5)';
    span.style.cursor = 'text';
    span.contentEditable = 'true';
    span.spellcheck = true;

    span.addEventListener('blur', () => {
      // Update the OCR result when user edits
      const wordIdx = parseInt(span.dataset.wordIdx);
      if (!isNaN(wordIdx) && ocrResults[pageNum]?.words[wordIdx]) {
        ocrResults[pageNum].words[wordIdx].text = span.textContent.trim();
        ocrResults[pageNum].words[wordIdx].confidence = 100; // User-corrected
        // Rebuild fullText
        ocrResults[pageNum].fullText = ocrResults[pageNum].words.map(w => w.text).join(' ');
      }
    });
  });
}

/**
 * Exit correction mode — make spans invisible again.
 */
export function disableCorrectionMode(pageNum, container) {
  const spans = container.querySelectorAll('.ocr-text-span');
  spans.forEach(span => {
    span.style.color = 'transparent';
    span.style.background = 'none';
    span.style.cursor = 'default';
    span.contentEditable = 'false';
  });
}
```

Update `renderOCRTextLayer()` to tag each span with its word index:
```javascript
// Add to span creation (after line 203):
span.dataset.wordIdx = String(wordIndex); // track index for correction
```

### 5. Export OCR Text

Add to `js/ocr.js`:
```javascript
/**
 * Export all OCR results as plain text file.
 */
export function exportOCRText() {
  const pages = Object.keys(ocrResults).sort((a, b) => +a - +b);
  let text = '';
  for (const pageNum of pages) {
    text += `--- Page ${pageNum} ---\n`;
    text += ocrResults[pageNum].fullText + '\n\n';
  }
  return text;
}

/**
 * Get OCR stats for display.
 */
export function getOCRStats() {
  const pages = Object.keys(ocrResults);
  if (!pages.length) return null;
  const totalWords = pages.reduce((s, p) => s + ocrResults[p].words.length, 0);
  const avgConfidence = pages.reduce((s, p) => s + ocrResults[p].avgConfidence, 0) / pages.length;
  const lowConfCount = pages.reduce((s, p) => s + ocrResults[p].lowConfidenceWords.length, 0);
  return {
    pagesProcessed: pages.length,
    totalWords,
    avgConfidence: Math.round(avgConfidence),
    lowConfidenceWords: lowConfCount,
  };
}
```

### 6. Embed OCR Text as Invisible PDF Text Layer on Export

This is the most valuable enhancement — it makes exported PDFs permanently searchable in any PDF viewer, not just Mudbrick.

In `js/export.js`, add after the annotation baking loop but before `pdfDoc.save()`:
```javascript
// Embed OCR text as invisible text layer (makes PDF searchable in any viewer)
import { getOCRResults, hasOCRResults } from './ocr.js';

async function embedOCRTextLayer(pdfDoc, PDFLib) {
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const pageNum = i + 1;
    if (!hasOCRResults(pageNum)) continue;

    const result = getOCRResults(pageNum);
    if (!result?.words?.length) continue;

    const page = pdfDoc.getPage(i);
    const { height: pageHeight } = page.getSize();

    for (const word of result.words) {
      if (!word.text.trim()) continue;

      const wordHeight = word.bbox.y1 - word.bbox.y0;
      const fontSize = Math.max(1, wordHeight * 0.85);

      // Draw invisible text (rendering mode 3 = invisible)
      // pdf-lib doesn't expose text rendering mode directly,
      // so use opacity 0 with the text positioned at OCR coordinates
      page.drawText(word.text, {
        x: word.bbox.x0,
        y: pageHeight - word.bbox.y1 + (wordHeight * 0.15),
        size: fontSize,
        font,
        opacity: 0, // Invisible but selectable/searchable
      });
    }
  }
}
```

Call `embedOCRTextLayer(pdfDoc, PDFLib)` in `exportAnnotatedPDF()` before the final `pdfDoc.save()`.

**Important:** Only embed OCR text for pages that were actually OCR'd and don't already have native text content. Check with `isPageScanned()` to avoid duplicating text on pages that already have a text layer.

### 7. OCR Modal UI Enhancements

In `index.html`, extend the OCR modal (lines 1318-1362):

```html
<!-- Add inside the modal-body, after the page scope radio buttons -->

<div style="margin-top:12px;">
  <label class="modal-form-label" for="ocr-language">Language</label>
  <select id="ocr-language" class="modal-form-input">
    <option value="eng" selected>English</option>
    <option value="spa">Spanish</option>
    <option value="fra">French</option>
    <option value="deu">German</option>
    <option value="por">Portuguese</option>
    <option value="ita">Italian</option>
    <option value="jpn">Japanese</option>
    <option value="kor">Korean</option>
    <option value="chi_sim">Chinese (Simplified)</option>
    <option value="chi_tra">Chinese (Traditional)</option>
    <option value="ara">Arabic</option>
    <option value="rus">Russian</option>
    <option value="hin">Hindi</option>
    <option value="eng+spa">English + Spanish</option>
  </select>
</div>

<div style="margin-top:8px;">
  <label class="modal-form-label">Options</label>
  <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-top:4px;">
    <input type="checkbox" id="ocr-embed-text" checked> Embed text layer in exported PDF
  </label>
  <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-top:4px;">
    <input type="checkbox" id="ocr-show-confidence"> Show confidence highlighting
  </label>
</div>

<!-- Add after progress area, shown after OCR completes -->
<div id="ocr-results-area" class="hidden" style="margin-top:12px;padding:8px;background:var(--bg-secondary);border-radius:4px;">
  <div style="font-weight:600;font-size:12px;margin-bottom:4px;">Results</div>
  <div id="ocr-stats" style="font-size:11px;color:var(--text-secondary);"></div>
  <div style="display:flex;gap:6px;margin-top:8px;">
    <button id="btn-ocr-export-text" class="btn-secondary" style="font-size:11px;">Export Text</button>
    <button id="btn-ocr-correct" class="btn-secondary" style="font-size:11px;">Correct OCR</button>
  </div>
</div>
```

### 8. App.js Wiring for OCR Enhancements

```javascript
// In the OCR run button handler, pass language:
const language = $('ocr-language').value;
await runOCR(State.pdfDoc, pageNumbers, progressCallback, { language });

// After OCR completes, show results:
const stats = getOCRStats();
if (stats) {
  $('ocr-results-area').classList.remove('hidden');
  $('ocr-stats').textContent =
    `${stats.pagesProcessed} pages, ${stats.totalWords} words, ` +
    `${stats.avgConfidence}% avg confidence` +
    (stats.lowConfidenceWords ? `, ${stats.lowConfidenceWords} low-confidence words` : '');
}

// Show confidence toggle:
$('ocr-show-confidence')?.addEventListener('change', (e) => {
  DOM.textLayer.classList.toggle('ocr-confidence-toggle', e.target.checked);
});

// Export text button:
$('btn-ocr-export-text')?.addEventListener('click', () => {
  const text = exportOCRText();
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = State.fileName.replace(/\.pdf$/i, '') + '-ocr.txt';
  a.click();
  URL.revokeObjectURL(url);
});

// Correction mode button:
$('btn-ocr-correct')?.addEventListener('click', () => {
  enableCorrectionMode(State.currentPage, DOM.textLayer);
  closeModal('ocr-modal-backdrop');
  showToast('OCR correction mode active. Click on words to edit. Press Escape to exit.', 'info');
});

// In exportAnnotatedPDF (export.js), check the embed preference:
// Store as a flag: State.ocrEmbedText = $('ocr-embed-text')?.checked ?? true;
// Then in export: if (State.ocrEmbedText) await embedOCRTextLayer(pdfDoc, PDFLib);
```

### Summary of OCR Changes

| Enhancement | What it does | Effort |
|---|---|---|
| Multi-language | Language dropdown, recreate Tesseract worker when language changes | Low |
| Confidence display | Per-word confidence coloring, stats summary | Low |
| Auto-detect scanned | Toast suggestion on open if pages look scanned | Low |
| Text correction | Contenteditable OCR spans, updates stored results | Medium |
| Export text | Download OCR'd text as .txt file | Low |
| Embed in PDF | Invisible text layer in exported PDF for permanent searchability | Medium |
| UI enhancements | Language picker, options checkboxes, results panel | Low |

**Key constraint:** The Tesseract worker must be terminated and recreated when changing languages (line 73 pattern). Don't try to `loadLanguage()` on an existing worker — just recreate it. This is slower but avoids Tesseract.js version-specific bugs with language switching.

**Test:** Open a scanned PDF → see auto-detect toast → run OCR with Spanish selected → verify Spanish text recognized → toggle confidence highlighting → correct a word → export PDF → open in Adobe Reader → verify text is searchable.

---

## General Guidelines

- **No framework.** Pure vanilla JS with ES modules. All new files use `export function` / `export class`.
- **No npm packages.** Libraries are via CDN globals.
- **Follow existing patterns exactly:**
  - Annotation types use `mudbrickType` property on Fabric objects
  - Custom data persists via `CUSTOM_PROPS` array in annotations.js
  - Modals use `openModal(id)` / `closeModal(id)` with `.modal-backdrop.hidden` pattern
  - Tools are switched via `setTool(name)` in annotations.js with a `case` in the switch
  - PDF mutations go through pdf-edit.js, reload via `reloadAfterEdit()` in app.js
- **Keep existing tests passing.** Run `npx vitest run` after each feature.
- **One commit per feature** with descriptive message.
- **Do not refactor existing code** unless required for the feature. Minimize blast radius.

## PROMPT END
