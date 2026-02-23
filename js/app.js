/**
 * Mudbrick — App Entry Point
 * State management, initialization, event wiring, navigation, zoom.
 *
 * This is an ES module. It dynamically imports PDF.js (ESM) and
 * uses static imports for app modules. UMD globals (PDFLib, fabric)
 * are available via window.
 */

import {
  initPdfJs, loadDocument, renderPage, renderTextLayer,
  renderThumbnail, getNextZoom, calculateFitWidth, calculateFitPage,
  cleanupPage,
} from './pdf-engine.js';

import {
  toast, showLoading, hideLoading, readFileAsArrayBuffer,
  formatFileSize, initDragDrop, debounce, downloadBlob, parsePageRanges,
} from './utils.js';

import {
  resetPdfLib, ensurePdfLib, rotatePage, deletePage,
  reorderPages, mergePDFs, splitPDF, addWatermark, appendPages,
  insertBlankPage, cropPages, getPageDimensions,
} from './pdf-edit.js';

import {
  initAnnotations, setTool, savePageAnnotations,
  loadPageAnnotations, resizeOverlay, deleteSelected,
  updateToolOptions, getCanvas, hasAnnotations, getAnnotations, insertImage,
  undoAnnotation, redoAnnotation,
  bringToFront, sendToBack, bringForward, sendBackward,
  duplicateSelected, copySelected, pasteClipboard,
  lockSelected, unlockSelected, isSelectionLocked,
  getAllStickyNotes, updateSelectedNoteText, setOnStickyNoteSelected,
} from './annotations.js';

import { exportAnnotatedPDF } from './export.js';

import { icon } from './icons.js';

import {
  detectFormFields, renderFormOverlay, clearFormOverlay,
  writeFormValues, hasFormFields, resetFormState,
} from './forms.js';

import {
  buildTextIndex, clearTextIndex, searchText, findNext as findNextMatch,
  findPrevious as findPrevMatch, getMatchInfo, renderHighlights,
  scrollToActiveHighlight, isFindOpen, setFindOpen, hasMatches,
  augmentTextIndex,
} from './find.js';

import { applyBatesNumbers, previewBatesLabel } from './bates.js';
import { applyHeadersFooters, previewHeaderText } from './headers.js';
import { openSignatureModal, closeSignatureModal, initSignatureEvents } from './signatures.js';
import {
  runOCR, hasOCRResults, renderOCRTextLayer, getOCRTextEntries,
  clearOCRResults, terminateOCR,
} from './ocr.js';

/* ═══════════════════ State ═══════════════════ */

const State = {
  pdfDoc: null,
  pdfBytes: null,
  fileName: '',
  fileSize: 0,
  currentPage: 1,
  totalPages: 0,
  zoom: 1.0,
  pageAnnotations: {},
  activeTool: 'select',
  sidebarOpen: true,
  panelOpen: false,
  formFields: [],  // detected form field descriptors
  pdfLibDoc: null,  // pdf-lib document for form support
  _viewport: null,  // cached viewport for find highlights
};

/* ═══════════════════ DOM References ═══════════════════ */

const $ = id => document.getElementById(id);

const DOM = {
  welcomeScreen: $('welcome-screen'),
  app: $('app'),
  pdfCanvas: $('pdf-canvas'),
  textLayer: $('text-layer'),
  fabricWrapper: $('fabric-canvas-wrapper'),
  canvasArea: $('canvas-area'),
  pageContainer: $('page-container'),
  thumbnailList: $('thumbnail-list'),
  sidebar: $('sidebar'),
  pageInput: $('page-input'),
  totalPages: $('total-pages'),
  zoomBtn: $('btn-zoom-level'),
  statusFilename: $('status-filename'),
  statusPagesSize: $('status-pages-size'),
  statusZoom: $('status-zoom'),
  statusBates: $('status-bates'),
  statusBadgeEncrypted: $('status-badge-encrypted'),
  statusBadgeTagged: $('status-badge-tagged'),
  statusZoomIn: $('status-zoom-in'),
  statusZoomOut: $('status-zoom-out'),
  fileInput: $('file-input'),
  btnPrev: $('btn-prev-page'),
  btnNext: $('btn-next-page'),
  btnFirst: $('btn-first-page'),
  btnLast: $('btn-last-page'),
  propertiesPanel: $('properties-panel'),
};

/* ═══════════════════ Initialization ═══════════════════ */

/** Replace all [data-icon] elements with inline SVGs from the icon system */
function replaceIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    const size = parseInt(el.dataset.iconSize) || 16;
    el.innerHTML = icon(name, size);
  });
}

async function boot() {
  try {
    // Initialize PDF.js (async CDN import)
    await initPdfJs();

    // Set up drag-and-drop on welcome screen
    initDragDrop('drop-zone', handleFiles);

    // Initialize Fabric.js annotation overlay
    initAnnotations('fabric-canvas');

    // Initialize signature modal events
    initSignatureEvents();

    // Set up sticky note selection callback
    setOnStickyNoteSelected((noteObj) => {
      showNotePropsPanel(noteObj);
      refreshNotesSidebar();
    });

    // Wire up all UI events
    wireEvents();

    // Replace emoji placeholders with SVG icons
    replaceIcons();

    // Check for dark mode preference
    if (localStorage.getItem('mudbrick-dark') === 'true' ||
        (!localStorage.getItem('mudbrick-dark') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      $('btn-dark-mode').innerHTML = icon('sun', 16);
    }

    // Auto-collapse sidebar on narrow screens
    if (window.innerWidth < 768) {
      State.sidebarOpen = false;
      DOM.sidebar.classList.add('collapsed');
      $('btn-toggle-sidebar').innerHTML = icon('panel-left-open', 16);
    }

    // Render recent files on welcome screen
    renderRecentFiles();

    // Clear recent files button
    $('btn-clear-recent')?.addEventListener('click', () => {
      clearRecentFiles();
    });

    console.log('Mudbrick ready');
  } catch (e) {
    console.error('Boot failed:', e);
    toast('Failed to initialize PDF engine. Please refresh.', 'error');
  }
}

/* ═══════════════════ Recent Files ═══════════════════ */

const RECENT_FILES_KEY = 'mudbrick-recent-files';
const MAX_RECENT_FILES = 8;

function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_FILES_KEY)) || [];
  } catch { return []; }
}

function addRecentFile(name, size, pageCount) {
  const recent = getRecentFiles();
  // Remove existing entry with same name
  const filtered = recent.filter(f => f.name !== name);
  // Add new entry at the top
  filtered.unshift({
    name,
    size,
    pageCount,
    openedAt: Date.now(),
  });
  // Keep only the last N
  const trimmed = filtered.slice(0, MAX_RECENT_FILES);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(trimmed));
}

function clearRecentFiles() {
  localStorage.removeItem(RECENT_FILES_KEY);
  const container = $('recent-files');
  if (container) container.classList.add('hidden');
}

function renderRecentFiles() {
  const recent = getRecentFiles();
  const container = $('recent-files');
  const list = $('recent-files-list');
  if (!container || !list) return;

  if (recent.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  list.innerHTML = '';

  for (const file of recent) {
    const li = document.createElement('li');
    li.className = 'recent-file-item';

    const ago = formatTimeAgo(file.openedAt);
    const sizeStr = file.size ? formatFileSize(file.size) : '';
    const pagesStr = file.pageCount ? `${file.pageCount} pg` : '';
    const meta = [sizeStr, pagesStr, ago].filter(Boolean).join(' · ');

    li.innerHTML = `
      <span class="recent-file-icon">${icon('file', 16)}</span>
      <div class="recent-file-info">
        <div class="recent-file-name" title="${file.name}">${file.name}</div>
        <div class="recent-file-meta">${meta}</div>
      </div>
    `;

    list.appendChild(li);
  }
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ═══════════════════ File Handling ═══════════════════ */

async function handleFiles(files) {
  if (!files || files.length === 0) return;
  const file = files[0]; // Open first file
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    toast('Please select a PDF file.', 'warning');
    return;
  }
  showLoading();
  try {
    const bytes = await readFileAsArrayBuffer(file);
    await openPDF(bytes, file.name, file.size);
    toast(`Opened ${file.name}`, 'success');
  } catch (e) {
    console.error('Failed to open file:', e);
    toast('Failed to open PDF. The file may be corrupted or password-protected.', 'error');
  } finally {
    hideLoading();
  }
}

async function openPDF(bytes, fileName, fileSize) {
  // Reset previous state
  resetPdfLib();
  resetFormState();
  clearTextIndex();
  clearOCRResults();
  State.pageAnnotations = {};
  State.formFields = [];
  State.pdfLibDoc = null;

  // Load with PDF.js
  const pdfDoc = await loadDocument(bytes);

  // Update state
  State.pdfDoc = pdfDoc;
  State.pdfBytes = bytes;
  State.fileName = fileName;
  State.fileSize = fileSize || bytes.length;
  State.totalPages = pdfDoc.numPages;
  State.currentPage = 1;
  State.zoom = 1.0;

  // Switch from welcome screen to app
  DOM.welcomeScreen.classList.add('hidden');
  DOM.app.classList.remove('hidden');

  // Enable toolbar buttons
  $('btn-merge').disabled = false;
  $('btn-split').disabled = false;
  $('btn-text').disabled = false;
  $('btn-draw').disabled = false;
  $('btn-highlight').disabled = false;
  $('btn-shape').disabled = false;
  $('btn-stamp').disabled = false;
  $('btn-cover').disabled = false;
  $('btn-redact').disabled = false;
  $('btn-watermark').disabled = false;
  $('btn-insert-image').disabled = false;
  $('btn-signature').disabled = false;
  $('btn-sticky-note').disabled = false;
  $('btn-underline').disabled = false;
  $('btn-strikethrough').disabled = false;
  $('btn-export').disabled = false;

  // Edit ribbon buttons
  $('btn-insert-blank').disabled = false;
  $('btn-bates').disabled = false;
  $('btn-headers-footers').disabled = false;
  $('btn-crop-page').disabled = false;
  $('btn-ocr').disabled = false;

  // Enable all tool-btn instances across ribbons (Annotate ribbon has duplicates without IDs)
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => { btn.disabled = false; });
  document.querySelectorAll('.sig-open-btn').forEach(btn => { btn.disabled = false; });

  // Detect form fields via pdf-lib
  try {
    const PDFLib = window.PDFLib;
    if (PDFLib) {
      State.pdfLibDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      State.formFields = detectFormFields(State.pdfLibDoc);
      if (State.formFields.length > 0) {
        toast(`Detected ${State.formFields.length} form field${State.formFields.length !== 1 ? 's' : ''}`, 'info');
      }
    }
  } catch (e) {
    console.warn('Form detection failed:', e);
  }

  // Add to recent files
  addRecentFile(fileName, fileSize || bytes.length, pdfDoc.numPages);

  // Update UI
  updateStatusBar();
  updatePageNav();
  updatePanelDocInfo();
  togglePropertiesPanel(true);
  $('floating-toolbar').classList.remove('hidden');

  // Render first page
  await renderCurrentPage();

  // Generate thumbnails lazily
  generateThumbnails();

  // Load document outline / bookmarks
  loadBookmarks();

  // Build text index for Find (async, non-blocking)
  buildTextIndex(State.pdfDoc);

  // Calculate initial fit-width zoom
  requestAnimationFrame(() => {
    fitWidth();
  });
}

/* ═══════════════════ Page Rendering ═══════════════════ */

async function renderCurrentPage() {
  if (!State.pdfDoc) return;

  // Save annotations from the page we're leaving
  if (State._prevPage && State._prevPage !== State.currentPage) {
    savePageAnnotations(State._prevPage);
  }
  State._prevPage = State.currentPage;

  const result = await renderPage(
    State.pdfDoc,
    State.currentPage,
    State.zoom,
    DOM.pdfCanvas
  );

  if (!result) return; // render was cancelled

  const { viewport, page } = result;

  // Render text layer
  await renderTextLayer(page, viewport, DOM.textLayer);

  // Store viewport and render find highlights
  State._viewport = viewport;
  if (hasMatches()) {
    renderHighlights(State.currentPage, DOM.textLayer, viewport);
  }

  // Inject OCR text layer if this page has been OCR'd
  if (hasOCRResults(State.currentPage)) {
    renderOCRTextLayer(State.currentPage, DOM.textLayer, viewport);
  }

  // Size the Fabric wrapper to match
  const w = Math.floor(viewport.width);
  const h = Math.floor(viewport.height);
  DOM.fabricWrapper.style.width = w + 'px';
  DOM.fabricWrapper.style.height = h + 'px';

  // Resize and reload annotation overlay
  resizeOverlay(w, h, State.zoom);
  loadPageAnnotations(State.currentPage);

  // Render form field overlays
  clearFormOverlay();
  if (State.formFields.length > 0 && State.pdfLibDoc) {
    renderFormOverlay(
      DOM.pageContainer,
      State.formFields,
      State.pdfLibDoc,
      State.currentPage - 1, // 0-based page index
      State.zoom,
      { width: viewport.width / State.zoom, height: viewport.height / State.zoom }
    );
  }

  // Size the page container
  DOM.pageContainer.style.width = Math.floor(viewport.width) + 'px';
  DOM.pageContainer.style.height = Math.floor(viewport.height) + 'px';

  // Refresh Notes sidebar
  refreshNotesSidebar();

  // Cleanup distant pages
  for (let i = 1; i <= State.totalPages; i++) {
    if (Math.abs(i - State.currentPage) > 2) {
      cleanupPage(State.pdfDoc, i);
    }
  }
}

/* ═══════════════════ Navigation ═══════════════════ */

function goToPage(pageNum) {
  const clamped = Math.max(1, Math.min(pageNum, State.totalPages));
  if (clamped === State.currentPage) return;

  State.currentPage = clamped;
  updatePageNav();
  renderCurrentPage();
  highlightActiveThumbnail();

  // Scroll thumbnail into view
  const thumb = DOM.thumbnailList.querySelector(`[data-page="${clamped}"]`);
  if (thumb) thumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function prevPage() { goToPage(State.currentPage - 1); }
function nextPage() { goToPage(State.currentPage + 1); }
function firstPage() { goToPage(1); }
function lastPage() { goToPage(State.totalPages); }

function updatePageNav() {
  DOM.pageInput.value = State.currentPage;
  DOM.pageInput.max = State.totalPages;
  DOM.totalPages.textContent = State.totalPages;
  const atFirst = State.currentPage <= 1;
  const atLast = State.currentPage >= State.totalPages;
  DOM.btnFirst.disabled = atFirst;
  DOM.btnPrev.disabled = atFirst;
  DOM.btnNext.disabled = atLast;
  DOM.btnLast.disabled = atLast;
}

/* ═══════════════════ Zoom ═══════════════════ */

function setZoom(newZoom) {
  State.zoom = Math.max(0.25, Math.min(5.0, newZoom));
  updateZoomDisplay();
  renderCurrentPage();
}

function zoomIn() { setZoom(getNextZoom(State.zoom, 1)); }
function zoomOut() { setZoom(getNextZoom(State.zoom, -1)); }

function fitWidth() {
  if (!State.pdfDoc) return;
  State.pdfDoc.getPage(State.currentPage).then(page => {
    const viewport = page.getViewport({ scale: 1 });
    const container = DOM.canvasArea;
    const newZoom = calculateFitWidth(viewport.width, container.clientWidth);
    setZoom(newZoom);
  });
}

function fitPage() {
  if (!State.pdfDoc) return;
  State.pdfDoc.getPage(State.currentPage).then(page => {
    const viewport = page.getViewport({ scale: 1 });
    const container = DOM.canvasArea;
    const newZoom = calculateFitPage(
      viewport.width, viewport.height,
      container.clientWidth, container.clientHeight
    );
    setZoom(newZoom);
  });
}

function updateZoomDisplay() {
  const pct = Math.round(State.zoom * 100) + '%';
  DOM.zoomBtn.textContent = pct;
  DOM.statusZoom.textContent = pct;
}

/* ═══════════════════ Thumbnails ═══════════════════ */

function generateThumbnails() {
  DOM.thumbnailList.innerHTML = '';

  // Create placeholder items for all pages
  for (let i = 1; i <= State.totalPages; i++) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item' + (i === State.currentPage ? ' active' : '');
    item.dataset.page = i;
    item.innerHTML = `
      <div class="thumbnail-placeholder">${i}</div>
      <span class="page-number">${i}</span>
    `;
    item.addEventListener('click', () => goToPage(i));
    item.addEventListener('contextmenu', e => showContextMenu(e, i));
    DOM.thumbnailList.appendChild(item);
  }

  // Lazy-render thumbnails as they scroll into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = entry.target;
        const pageNum = parseInt(item.dataset.page);
        if (item.querySelector('.thumbnail-placeholder')) {
          renderThumbnailForItem(item, pageNum);
        }
        observer.unobserve(item);
      }
    });
  }, {
    root: DOM.thumbnailList,
    rootMargin: '200px', // pre-render 200px before visible
  });

  DOM.thumbnailList.querySelectorAll('.thumbnail-item').forEach(item => {
    observer.observe(item);
  });
}

async function renderThumbnailForItem(item, pageNum) {
  try {
    const thumbWidth = DOM.sidebar.clientWidth - 24; // minus padding
    const canvas = await renderThumbnail(State.pdfDoc, pageNum, thumbWidth);

    // Replace placeholder with rendered canvas
    const placeholder = item.querySelector('.thumbnail-placeholder');
    if (placeholder) {
      item.replaceChild(canvas, placeholder);
    }
  } catch (e) {
    console.warn(`Thumbnail render failed for page ${pageNum}:`, e);
  }
}

function highlightActiveThumbnail() {
  DOM.thumbnailList.querySelectorAll('.thumbnail-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.page) === State.currentPage);
  });
}

/* ═══════════════════ Reload After Edit ═══════════════════ */

/**
 * After pdf-lib modifies the document and returns new bytes,
 * reload into PDF.js so the user sees the changes.
 */
async function reloadAfterEdit(newBytes) {
  resetPdfLib(); // clear cached pdf-lib doc so next edit re-loads
  clearFormOverlay();
  const pdfDoc = await loadDocument(newBytes);

  State.pdfDoc = pdfDoc;
  State.pdfBytes = newBytes;
  State.fileSize = newBytes.length;
  State.totalPages = pdfDoc.numPages;

  // Re-detect form fields
  try {
    const PDFLib = window.PDFLib;
    if (PDFLib) {
      State.pdfLibDoc = await PDFLib.PDFDocument.load(newBytes, { ignoreEncryption: true });
      State.formFields = detectFormFields(State.pdfLibDoc);
    }
  } catch (e) {
    State.formFields = [];
  }

  // Clamp current page if it was deleted
  if (State.currentPage > State.totalPages) {
    State.currentPage = State.totalPages;
  }

  updateStatusBar();
  updatePageNav();
  await renderCurrentPage();
  generateThumbnails();

  // Rebuild text index for Find
  buildTextIndex(State.pdfDoc);
}

/* ═══════════════════ Find Bar ═══════════════════ */

function openFindBar() {
  const bar = $('find-bar');
  if (!bar || !State.pdfDoc) return;
  bar.classList.remove('hidden');
  setFindOpen(true);
  const input = $('find-input');
  input.focus();
  input.select();
  replaceIcons();
}

function closeFindBar() {
  const bar = $('find-bar');
  if (!bar) return;
  bar.classList.add('hidden');
  setFindOpen(false);
  $('find-input').value = '';
  $('find-match-count').textContent = '';
  // Clear search state and highlights
  searchText('', false);
  DOM.textLayer.querySelectorAll('.find-highlight').forEach(el => el.remove());
}

function performSearch() {
  const input = $('find-input');
  const cs = $('find-case-sensitive').checked;
  const q = input.value.trim();

  const { total } = searchText(q, cs);
  const countEl = $('find-match-count');

  if (!q) {
    countEl.textContent = '';
  } else if (total === 0) {
    countEl.textContent = '0 of 0';
  } else {
    const info = getMatchInfo();
    countEl.textContent = `${info.current} of ${info.total}`;
  }

  // Render highlights on current page
  if (State._viewport) {
    renderHighlights(State.currentPage, DOM.textLayer, State._viewport);
  }

  // Navigate to first match page if needed
  if (total > 0) {
    const info = getMatchInfo();
    if (info.pageNum !== State.currentPage) {
      goToPage(info.pageNum);
    }
    setTimeout(scrollToActiveHighlight, 100);
  }
}

function navigateMatch(direction) {
  const result = direction === 'next' ? findNextMatch() : findPrevMatch();
  if (!result) return;

  const info = getMatchInfo();
  $('find-match-count').textContent = `${info.current} of ${info.total}`;

  if (result.pageNum !== State.currentPage) {
    goToPage(result.pageNum);
  } else if (State._viewport) {
    renderHighlights(State.currentPage, DOM.textLayer, State._viewport);
  }
  setTimeout(scrollToActiveHighlight, 100);
}

/* ═══════════════════ Bookmarks / Document Outline ═══════════════════ */

async function loadBookmarks() {
  const panel = $('sidebar-bookmarks');
  if (!panel || !State.pdfDoc) return;

  try {
    const outline = await State.pdfDoc.getOutline();

    if (!outline || outline.length === 0) {
      panel.innerHTML = `
        <div class="sidebar-empty">
          <span data-icon="bookmark" data-icon-size="24"></span>
          <p>No bookmarks</p>
          <p class="sidebar-empty-hint">This PDF has no document outline.</p>
        </div>`;
      replaceIcons(); // re-render the data-icon
      return;
    }

    // Recursively build bookmark tree
    async function buildTree(items) {
      const ul = document.createElement('ul');
      ul.className = 'bookmark-tree';

      for (const item of items) {
        const li = document.createElement('li');
        li.className = 'bookmark-item';

        const hasChildren = item.items && item.items.length > 0;

        // Resolve destination to page number
        let pageNum = null;
        try {
          if (item.dest) {
            let dest = item.dest;
            if (typeof dest === 'string') {
              dest = await State.pdfDoc.getDestination(dest);
            }
            if (Array.isArray(dest) && dest[0]) {
              const pageIndex = await State.pdfDoc.getPageIndex(dest[0]);
              pageNum = pageIndex + 1;
            }
          }
        } catch { /* broken destination — still show title */ }

        const row = document.createElement('div');
        row.className = 'bookmark-row';

        if (hasChildren) {
          const toggle = document.createElement('button');
          toggle.className = 'bookmark-toggle';
          toggle.innerHTML = icon('chevron-right', 12);
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            li.classList.toggle('expanded');
          });
          row.appendChild(toggle);
        } else {
          const spacer = document.createElement('span');
          spacer.className = 'bookmark-spacer';
          row.appendChild(spacer);
        }

        const link = document.createElement('button');
        link.className = 'bookmark-link';
        link.textContent = item.title || 'Untitled';
        if (pageNum !== null) {
          link.title = `Go to page ${pageNum}`;
          link.addEventListener('click', () => {
            goToPage(pageNum);
            // Highlight active bookmark
            panel.querySelectorAll('.bookmark-link.active').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
          });
        } else {
          link.classList.add('disabled');
          link.title = 'Destination unavailable';
        }
        row.appendChild(link);

        if (pageNum !== null) {
          const badge = document.createElement('span');
          badge.className = 'bookmark-page-badge';
          badge.textContent = pageNum;
          row.appendChild(badge);
        }

        li.appendChild(row);

        if (hasChildren) {
          const childTree = await buildTree(item.items);
          li.appendChild(childTree);
        }

        ul.appendChild(li);
      }
      return ul;
    }

    const tree = await buildTree(outline);
    panel.innerHTML = '';
    panel.appendChild(tree);

  } catch (err) {
    console.warn('Failed to load bookmarks:', err);
    panel.innerHTML = `
      <div class="sidebar-empty">
        <span data-icon="bookmark" data-icon-size="24"></span>
        <p>No bookmarks</p>
        <p class="sidebar-empty-hint">Could not read document outline.</p>
      </div>`;
    replaceIcons();
  }
}

/* ═══════════════════ Thumbnail Context Menu ═══════════════════ */

let contextMenu = null;

function showContextMenu(e, pageNum) {
  e.preventDefault();
  hideContextMenu();

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.innerHTML = `
    <button data-action="insert-before">${icon('file-plus', 14)} Insert Page Before</button>
    <button data-action="insert-after">${icon('file-plus', 14)} Insert Page After</button>
    <button data-action="insert-blank">${icon('file-plus', 14)} Insert Blank Page</button>
    <button data-action="duplicate">${icon('files', 14)} Duplicate Page</button>
    <div class="context-menu-separator"></div>
    <button data-action="rotate-cw">${icon('rotate-cw', 14)} Rotate Right</button>
    <button data-action="rotate-ccw">${icon('rotate-ccw', 14)} Rotate Left</button>
    <button data-action="rotate-180">${icon('flip-vertical', 14)} Rotate 180°</button>
    <div class="context-menu-separator"></div>
    <button data-action="delete" ${State.totalPages <= 1 ? 'disabled' : ''}>${icon('trash', 14)} Delete Page</button>
    <button data-action="extract">${icon('file-output', 14)} Extract Page</button>
  `;

  // Position at mouse
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  document.body.appendChild(contextMenu);

  // Clamp to viewport
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  }

  // Handle clicks
  contextMenu.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    hideContextMenu();

    const action = btn.dataset.action;
    const idx = pageNum - 1; // 0-based

    // Insert blank page
    if (action === 'insert-blank') {
      showLoading();
      try {
        const newBytes = await insertBlankPage(State.pdfBytes, idx);
        State.currentPage = pageNum + 1; // navigate to the new blank page
        await reloadAfterEdit(newBytes);
        toast('Inserted blank page', 'success');
      } catch (err) {
        console.error('Insert blank page failed:', err);
        toast('Insert blank page failed: ' + err.message, 'error');
      } finally {
        hideLoading();
      }
      return;
    }

    // Insert page needs a file picker — not a loading operation
    if (action === 'insert-before' || action === 'insert-after') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.multiple = true;
      input.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const insertAfter = action === 'insert-before' ? idx - 1 : idx;
        handleAddPages(files, insertAfter);
      });
      input.click();
      return;
    }

    // Duplicate page via pdf-lib
    if (action === 'duplicate') {
      showLoading();
      try {
        const PDFLib = window.PDFLib;
        const doc = await PDFLib.PDFDocument.load(State.pdfBytes, { ignoreEncryption: true });
        const [copied] = await doc.copyPages(doc, [idx]);
        doc.insertPage(idx + 1, copied);
        const newBytes = await doc.save();
        State.currentPage = pageNum + 1;
        await reloadAfterEdit(newBytes);
        toast(`Duplicated page ${pageNum}`, 'success');
      } catch (err) {
        console.error('Duplicate page failed:', err);
        toast('Duplicate failed: ' + err.message, 'error');
      } finally {
        hideLoading();
      }
      return;
    }

    showLoading();
    try {
      let newBytes;
      switch (action) {
        case 'rotate-cw':
          newBytes = await rotatePage(State.pdfBytes, idx, 90);
          await reloadAfterEdit(newBytes);
          toast('Rotated page right', 'success');
          break;
        case 'rotate-ccw':
          newBytes = await rotatePage(State.pdfBytes, idx, -90);
          await reloadAfterEdit(newBytes);
          toast('Rotated page left', 'success');
          break;
        case 'rotate-180':
          newBytes = await rotatePage(State.pdfBytes, idx, 180);
          await reloadAfterEdit(newBytes);
          toast('Rotated page 180°', 'success');
          break;
        case 'delete':
          if (State.totalPages <= 1) return;
          newBytes = await deletePage(State.pdfBytes, idx);
          // If we deleted the current page or a page before it, adjust
          if (pageNum <= State.currentPage && State.currentPage > 1) {
            State.currentPage--;
          }
          await reloadAfterEdit(newBytes);
          toast(`Deleted page ${pageNum}`, 'success');
          break;
        case 'extract': {
          const extracted = await splitPDF(State.pdfBytes, [[idx]]);
          const part = extracted[0];
          const name = State.fileName.replace('.pdf', '') + `_${part.label}.pdf`;
          downloadBlob(part.bytes, name);
          toast(`Extracted ${part.label}`, 'success');
          break;
        }
      }
    } catch (err) {
      console.error('Page operation failed:', err);
      toast('Operation failed: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // Close on click outside or Escape
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
    document.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') {
        hideContextMenu();
        document.removeEventListener('keydown', onKey);
      }
    });
  }, 0);
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

/* ═══════════════════ Annotation Context Menu ═══════════════════ */

function showAnnotationContextMenu(e, target) {
  e.preventDefault();
  e.stopPropagation();
  hideContextMenu();

  const canvas = getCanvas();
  if (!canvas) return;

  const locked = target ? !!target.lockMovementX : false;
  const hasSelection = !!target;

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.innerHTML = `
    <button data-action="anno-copy" ${!hasSelection ? 'disabled' : ''}>${icon('copy', 14)} Copy</button>
    <button data-action="anno-paste">${icon('clipboard-paste', 14)} Paste</button>
    <button data-action="anno-duplicate" ${!hasSelection ? 'disabled' : ''}>${icon('files', 14)} Duplicate</button>
    <div class="context-menu-separator"></div>
    <button data-action="anno-front" ${!hasSelection ? 'disabled' : ''}>${icon('arrow-up-to-line', 14)} Bring to Front</button>
    <button data-action="anno-forward" ${!hasSelection ? 'disabled' : ''}>${icon('chevron-up', 14)} Bring Forward</button>
    <button data-action="anno-backward" ${!hasSelection ? 'disabled' : ''}>${icon('chevron-down', 14)} Send Backward</button>
    <button data-action="anno-back" ${!hasSelection ? 'disabled' : ''}>${icon('arrow-down-to-line', 14)} Send to Back</button>
    <div class="context-menu-separator"></div>
    <button data-action="anno-lock" ${!hasSelection ? 'disabled' : ''}>${locked ? icon('lock-open', 14) + ' Unlock' : icon('lock-open', 14) + ' Lock'}</button>
    <button data-action="anno-delete" ${!hasSelection ? 'disabled' : ''}>${icon('trash', 14)} Delete</button>
  `;

  // Position at mouse
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  document.body.appendChild(contextMenu);

  // Clamp to viewport
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  }

  // Handle clicks
  contextMenu.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    hideContextMenu();

    switch (btn.dataset.action) {
      case 'anno-copy':      copySelected(); break;
      case 'anno-paste':     pasteClipboard(); break;
      case 'anno-duplicate': duplicateSelected(); break;
      case 'anno-front':     bringToFront(); break;
      case 'anno-forward':   bringForward(); break;
      case 'anno-backward':  sendBackward(); break;
      case 'anno-back':      sendToBack(); break;
      case 'anno-lock':
        if (locked) unlockSelected();
        else lockSelected();
        break;
      case 'anno-delete':    deleteSelected(); break;
    }
  });

  // Close on click outside or Escape
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
    document.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') {
        hideContextMenu();
        document.removeEventListener('keydown', onKey);
      }
    });
  }, 0);
}

/* ═══════════════════ Merge Modal ═══════════════════ */

let mergeFiles = []; // [{ file: File, bytes: Uint8Array, name, size }]

function openMergeModal() {
  mergeFiles = [];
  renderMergeFileList();
  $('merge-modal-backdrop').classList.remove('hidden');
  $('btn-merge-execute').disabled = true;
}

function closeMergeModal() {
  $('merge-modal-backdrop').classList.add('hidden');
  mergeFiles = [];
}

async function addMergeFiles(files) {
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf')) continue;
    const bytes = await readFileAsArrayBuffer(file);
    mergeFiles.push({ file, bytes, name: file.name, size: file.size });
  }
  renderMergeFileList();
  $('btn-merge-execute').disabled = mergeFiles.length < 2;
}

function renderMergeFileList() {
  const list = $('merge-file-list');
  list.innerHTML = '';
  mergeFiles.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    li.innerHTML = `
      <span class="file-list-name">${icon('file', 14)} ${item.name}</span>
      <span class="file-list-size">${formatFileSize(item.size)}</span>
      <div class="file-list-actions">
        <button class="file-list-btn" data-move="up" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button class="file-list-btn" data-move="down" ${i === mergeFiles.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
        <button class="file-list-btn" data-remove="${i}" title="Remove">✕</button>
      </div>
    `;

    // Move up
    li.querySelector('[data-move="up"]')?.addEventListener('click', () => {
      if (i > 0) { [mergeFiles[i - 1], mergeFiles[i]] = [mergeFiles[i], mergeFiles[i - 1]]; renderMergeFileList(); }
    });
    // Move down
    li.querySelector('[data-move="down"]')?.addEventListener('click', () => {
      if (i < mergeFiles.length - 1) { [mergeFiles[i], mergeFiles[i + 1]] = [mergeFiles[i + 1], mergeFiles[i]]; renderMergeFileList(); }
    });
    // Remove
    li.querySelector('[data-remove]')?.addEventListener('click', () => {
      mergeFiles.splice(i, 1);
      renderMergeFileList();
      $('btn-merge-execute').disabled = mergeFiles.length < 2;
    });

    list.appendChild(li);
  });
}

async function executeMerge() {
  if (mergeFiles.length < 2) return;
  showLoading();
  try {
    const fileList = mergeFiles.map(f => ({ bytes: f.bytes }));
    const mergedBytes = await mergePDFs(fileList);
    closeMergeModal();
    await openPDF(mergedBytes, 'merged.pdf', mergedBytes.length);
    toast(`Merged ${fileList.length} files`, 'success');
  } catch (err) {
    console.error('Merge failed:', err);
    toast('Merge failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Split Modal ═══════════════════ */

function openSplitModal() {
  $('split-range-input').value = '';
  $('split-preview').textContent = '';
  $('btn-split-execute').disabled = true;
  $('split-modal-backdrop').classList.remove('hidden');
}

function closeSplitModal() {
  $('split-modal-backdrop').classList.add('hidden');
}

function updateSplitPreview() {
  const input = $('split-range-input').value.trim();
  const preview = $('split-preview');

  if (!input) {
    preview.textContent = '';
    $('btn-split-execute').disabled = true;
    return;
  }

  const ranges = parsePageRanges(input, State.totalPages);
  if (!ranges) {
    preview.textContent = `Invalid range. Pages are 1-${State.totalPages}.`;
    preview.style.color = 'var(--mb-danger)';
    $('btn-split-execute').disabled = true;
    return;
  }

  const desc = ranges.map(r => {
    const first = r[0] + 1;
    const last = r[r.length - 1] + 1;
    return first === last ? `Page ${first}` : `Pages ${first}-${last}`;
  }).join(', ');

  preview.textContent = `Will create ${ranges.length} file${ranges.length > 1 ? 's' : ''}: ${desc}`;
  preview.style.color = 'var(--mb-text-secondary)';
  $('btn-split-execute').disabled = false;
}

async function executeSplit() {
  const input = $('split-range-input').value.trim();
  const ranges = parsePageRanges(input, State.totalPages);
  if (!ranges) return;

  showLoading();
  try {
    const results = await splitPDF(State.pdfBytes, ranges);
    closeSplitModal();

    // Download each split file
    const baseName = State.fileName.replace('.pdf', '');
    for (const { bytes, label } of results) {
      downloadBlob(bytes, `${baseName}_${label}.pdf`);
    }
    toast(`Split into ${results.length} file${results.length > 1 ? 's' : ''}`, 'success');
  } catch (err) {
    console.error('Split failed:', err);
    toast('Split failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Status Bar ═══════════════════ */

function updateStatusBar() {
  DOM.statusFilename.textContent = State.fileName || 'No file loaded';

  // Pages · Size combined
  const parts = [];
  if (State.totalPages > 0) {
    parts.push(`${State.totalPages} page${State.totalPages !== 1 ? 's' : ''}`);
  }
  if (State.fileSize > 0) {
    parts.push(formatFileSize(State.fileSize));
  }
  DOM.statusPagesSize.textContent = parts.join(' · ');

  updateZoomDisplay();
}

/* ═══════════════════ Print ═══════════════════ */

async function handlePrint() {
  if (!State.pdfDoc) return;

  showLoading();
  try {
    // Save current page annotations before printing
    savePageAnnotations(State.currentPage);

    const totalPages = State.totalPages;
    const printScale = 1.5; // Higher resolution for print

    // Render each page to a data URL
    const pageImages = [];
    for (let p = 1; p <= totalPages; p++) {
      const page = await State.pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: printScale });

      // Render PDF page
      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      const ctx = pdfCanvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Overlay annotations if any exist for this page
      const annoJSON = getAnnotations()[p];
      if (annoJSON && annoJSON.objects && annoJSON.objects.length > 0) {
        const fabric = window.fabric;
        if (fabric) {
          const offscreen = document.createElement('canvas');
          offscreen.width = viewport.width;
          offscreen.height = viewport.height;
          const fCanvas = new fabric.StaticCanvas(offscreen, {
            width: viewport.width,
            height: viewport.height,
          });
          await new Promise(resolve => {
            fCanvas.loadFromJSON(annoJSON, () => {
              fCanvas.setZoom(printScale);
              fCanvas.renderAll();
              resolve();
            });
          });
          ctx.drawImage(offscreen, 0, 0);
        }
      }

      pageImages.push(pdfCanvas.toDataURL('image/png'));
    }

    // Build print document in a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>Print — ' + (State.fileName || 'Document') + '</title>');
    doc.write('<style>@media print{@page{margin:0;}body{margin:0;}}');
    doc.write('body{margin:0;padding:0;}img{display:block;width:100%;height:auto;page-break-after:always;}');
    doc.write('img:last-child{page-break-after:avoid;}</style></head><body>');
    for (const src of pageImages) {
      doc.write('<img src="' + src + '"/>');
    }
    doc.write('</body></html>');
    doc.close();

    // Wait for images to load, then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove iframe after print dialog closes
        setTimeout(() => document.body.removeChild(iframe), 1000);
        hideLoading();
      }, 300);
    };
  } catch (err) {
    console.error('Print failed:', err);
    hideLoading();
    showToast('Print failed: ' + err.message, 'error');
  }
}

/* ═══════════════════ Export ═══════════════════ */

async function handleExport() {
  if (!State.pdfBytes) return;
  showLoading();
  try {
    // Write form field values into the source bytes before export
    let exportBytes = State.pdfBytes;
    if (State.pdfLibDoc && State.formFields.length > 0) {
      const wrote = writeFormValues(State.pdfLibDoc);
      if (wrote) {
        // Save the pdf-lib doc with form values baked in
        exportBytes = await State.pdfLibDoc.save();
      }
    }

    const result = await exportAnnotatedPDF({
      pdfBytes: exportBytes,
      currentPage: State.currentPage,
      totalPages: State.totalPages,
      fileName: State.fileName,
    });
    downloadBlob(
      new Blob([result.bytes], { type: 'application/pdf' }),
      result.fileName
    );
    toast(`Exported ${result.fileName}`, 'success');
  } catch (err) {
    console.error('Export failed:', err);
    toast('Export failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Watermark Modal ═══════════════════ */

function openWatermarkModal() {
  $('watermark-modal-backdrop').classList.remove('hidden');
}

function closeWatermarkModal() {
  $('watermark-modal-backdrop').classList.add('hidden');
}

async function executeWatermark() {
  if (!State.pdfBytes) return;

  const text = $('watermark-text').value.trim();
  if (!text) { toast('Enter watermark text', 'warning'); return; }

  showLoading();
  try {
    const newBytes = await addWatermark(State.pdfBytes, {
      text,
      fontSize: parseInt($('watermark-size').value) || 60,
      rotation: parseInt($('watermark-rotation').value) || -45,
      opacity: parseFloat($('watermark-opacity').value) || 0.15,
      color: $('watermark-color').value || '#888888',
      pages: $('watermark-pages').value || 'all',
      currentPage: State.currentPage,
    });

    closeWatermarkModal();
    await reloadAfterEdit(newBytes);
    toast('Watermark applied', 'success');
  } catch (err) {
    console.error('Watermark failed:', err);
    toast('Watermark failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Bates Numbering Modal ═══════════════════ */

function openBatesModal() {
  $('bates-modal-backdrop').classList.remove('hidden');
  updateBatesPreview();
  replaceIcons();
}

function closeBatesModal() {
  $('bates-modal-backdrop').classList.add('hidden');
}

function updateBatesPreview() {
  const label = previewBatesLabel({
    prefix: $('bates-prefix').value,
    suffix: $('bates-suffix').value,
    startNumber: parseInt($('bates-start').value) || 1,
    zeroPad: parseInt($('bates-pad').value) || 6,
  });
  $('bates-preview').textContent = label;
}

async function executeBates() {
  if (!State.pdfBytes) return;

  const pageRange = $('bates-page-range').value;
  let startPage = 1;
  let endPage = 0; // 0 = all

  if (pageRange === 'custom') {
    const rangeText = $('bates-range-input').value.trim();
    if (!rangeText) {
      toast('Enter a page range', 'warning');
      return;
    }
    // Parse custom range — use first and last page of the range
    try {
      const pages = parsePageRanges(rangeText, State.totalPages);
      if (pages.length === 0) {
        toast('Invalid page range', 'warning');
        return;
      }
      // pages are 0-based from parsePageRanges, convert to 1-based
      startPage = pages[0] + 1;
      endPage = pages[pages.length - 1] + 1;
    } catch (e) {
      toast('Invalid page range: ' + e.message, 'warning');
      return;
    }
  }

  showLoading();
  try {
    const { bytes, firstLabel, lastLabel } = await applyBatesNumbers(State.pdfBytes, {
      prefix: $('bates-prefix').value,
      suffix: $('bates-suffix').value,
      startNumber: parseInt($('bates-start').value) || 1,
      zeroPad: parseInt($('bates-pad').value) || 6,
      position: $('bates-position').value,
      fontSize: parseInt($('bates-font-size').value) || 10,
      color: $('bates-color').value || '#000000',
      startPage,
      endPage,
    });

    closeBatesModal();
    await reloadAfterEdit(bytes);

    // Show Bates range in status bar
    const batesStatus = $('status-bates');
    if (batesStatus) {
      batesStatus.textContent = `Bates: ${firstLabel} – ${lastLabel}`;
      batesStatus.classList.remove('hidden');
    }

    toast(`Bates numbers applied (${firstLabel} – ${lastLabel})`, 'success');
  } catch (err) {
    console.error('Bates numbering failed:', err);
    toast('Bates numbering failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Headers & Footers Modal ═══════════════════ */

let lastFocusedHfZone = null; // track which zone input was last focused

function openHfModal() {
  $('hf-modal-backdrop').classList.remove('hidden');
  updateHfPreview();
  replaceIcons();
}

function closeHfModal() {
  $('hf-modal-backdrop').classList.add('hidden');
}

function updateHfPreview() {
  const fname = State.filename || 'document.pdf';
  const zones = {
    'hf-prev-tl': $('hf-top-left').value,
    'hf-prev-tc': $('hf-top-center').value,
    'hf-prev-tr': $('hf-top-right').value,
    'hf-prev-bl': $('hf-bottom-left').value,
    'hf-prev-bc': $('hf-bottom-center').value,
    'hf-prev-br': $('hf-bottom-right').value,
  };
  for (const [spanId, template] of Object.entries(zones)) {
    const text = previewHeaderText(template, fname);
    $(spanId).textContent = text || '—';
    $(spanId).style.color = text ? 'var(--mb-text)' : 'var(--mb-text-secondary)';
  }
}

function insertHfToken(token) {
  // Insert token at cursor position in the last-focused zone input
  const input = lastFocusedHfZone;
  if (!input) {
    // Default to bottom-center if no zone was focused
    const bc = $('hf-bottom-center');
    bc.value += token;
    bc.focus();
    updateHfPreview();
    return;
  }
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + token + input.value.slice(end);
  input.focus();
  input.setSelectionRange(start + token.length, start + token.length);
  updateHfPreview();
}

async function executeHeadersFooters() {
  if (!State.pdfBytes) return;

  const pageRange = $('hf-page-range').value;
  let startPage = 1;
  let endPage = 0;

  if (pageRange === 'custom') {
    const rangeText = $('hf-range-input').value.trim();
    if (!rangeText) {
      toast('Enter a page range', 'warning');
      return;
    }
    try {
      const pages = parsePageRanges(rangeText, State.totalPages);
      if (pages.length === 0) {
        toast('Invalid page range', 'warning');
        return;
      }
      startPage = pages[0] + 1;
      endPage = pages[pages.length - 1] + 1;
    } catch (e) {
      toast('Invalid page range: ' + e.message, 'warning');
      return;
    }
  }

  // Check at least one zone has content
  const zoneIds = ['hf-top-left', 'hf-top-center', 'hf-top-right',
                   'hf-bottom-left', 'hf-bottom-center', 'hf-bottom-right'];
  const hasContent = zoneIds.some(id => $(id).value.trim());
  if (!hasContent) {
    toast('Enter text in at least one zone', 'warning');
    return;
  }

  showLoading();
  try {
    const bytes = await applyHeadersFooters(State.pdfBytes, {
      topLeft: $('hf-top-left').value,
      topCenter: $('hf-top-center').value,
      topRight: $('hf-top-right').value,
      bottomLeft: $('hf-bottom-left').value,
      bottomCenter: $('hf-bottom-center').value,
      bottomRight: $('hf-bottom-right').value,
      fontSize: parseInt($('hf-font-size').value) || 10,
      color: $('hf-color').value || '#000000',
      filename: State.filename || 'document.pdf',
      startPage,
      endPage,
    });

    closeHfModal();
    await reloadAfterEdit(bytes);
    toast('Headers & footers applied', 'success');
  } catch (err) {
    console.error('Headers & footers failed:', err);
    toast('Headers & footers failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Page Crop Modal ═══════════════════ */

async function openCropModal() {
  $('crop-modal-backdrop').classList.remove('hidden');
  // Reset fields
  $('crop-top').value = 0;
  $('crop-bottom').value = 0;
  $('crop-left').value = 0;
  $('crop-right').value = 0;
  // Show current page dimensions
  try {
    const dims = await getPageDimensions(State.pdfBytes, State.currentPage - 1);
    const wIn = (dims.width / 72).toFixed(2);
    const hIn = (dims.height / 72).toFixed(2);
    $('crop-page-info').textContent = `Page ${State.currentPage}: ${Math.round(dims.width)} × ${Math.round(dims.height)} pt (${wIn}" × ${hIn}")`;
  } catch {
    $('crop-page-info').textContent = `Page ${State.currentPage}`;
  }
  replaceIcons();
}

function closeCropModal() {
  $('crop-modal-backdrop').classList.add('hidden');
}

async function executeCrop() {
  if (!State.pdfBytes) return;

  const top = parseFloat($('crop-top').value) || 0;
  const bottom = parseFloat($('crop-bottom').value) || 0;
  const left = parseFloat($('crop-left').value) || 0;
  const right = parseFloat($('crop-right').value) || 0;

  if (top === 0 && bottom === 0 && left === 0 && right === 0) {
    toast('Enter at least one crop margin', 'warning');
    return;
  }

  const scope = $('crop-scope').value;

  showLoading();
  try {
    const bytes = await cropPages(State.pdfBytes, {
      top, bottom, left, right,
      pages: scope,
      currentPage: State.currentPage,
    });

    closeCropModal();
    await reloadAfterEdit(bytes);
    const label = scope === 'all' ? 'all pages' : `page ${State.currentPage}`;
    toast(`Cropped ${label}`, 'success');
  } catch (err) {
    console.error('Crop failed:', err);
    toast('Crop failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Image Insertion ═══════════════════ */

function handleImageInsert() {
  $('image-file-input').click();
}

async function onImageFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // reset for reuse

  if (!file.type.startsWith('image/')) {
    toast('Please select an image file', 'warning');
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    await insertImage(dataUrl, file.name);
    toast(`Inserted ${file.name}`, 'success');
  } catch (err) {
    console.error('Image insert failed:', err);
    toast('Image insert failed: ' + err.message, 'error');
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════ Add Pages (Drag-Drop Inline Merge) ═══════════════════ */

/**
 * Append pages from dropped PDF files into the current document.
 * @param {File[]} files - PDF files to append
 * @param {number} [insertAfter] - 0-based page index to insert after (default: end)
 */
async function handleAddPages(files, insertAfter) {
  if (!State.pdfBytes || !files.length) return;
  showLoading();
  try {
    const additions = [];
    let totalNewPages = 0;
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      const bytes = await readFileAsArrayBuffer(file);
      // Count pages in the donor
      const donor = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      totalNewPages += donor.getPageCount();
      additions.push({ bytes });
    }
    if (additions.length === 0) {
      toast('No valid PDF files found', 'warning');
      return;
    }
    const newBytes = await appendPages(State.pdfBytes, additions, insertAfter);
    await reloadAfterEdit(newBytes);
    toast(`Added ${totalNewPages} page${totalNewPages !== 1 ? 's' : ''} from ${additions.length} file${additions.length !== 1 ? 's' : ''}`, 'success');
  } catch (err) {
    console.error('Add pages failed:', err);
    toast('Failed to add pages: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ═══════════════════ Dark Mode ═══════════════════ */

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('mudbrick-dark', !isDark);
  $('btn-dark-mode').innerHTML = isDark ? icon('moon', 16) : icon('sun', 16);
}

/* ═══════════════════ Sidebar Toggle ═══════════════════ */

function toggleSidebar() {
  State.sidebarOpen = !State.sidebarOpen;
  DOM.sidebar.classList.toggle('collapsed', !State.sidebarOpen);
  $('btn-toggle-sidebar').innerHTML = State.sidebarOpen
    ? icon('panel-left-close', 16)
    : icon('panel-left-open', 16);
}

/* ═══════════════════ Properties Panel ═══════════════════ */

function togglePropertiesPanel(forceOpen) {
  const open = forceOpen !== undefined ? forceOpen : !State.panelOpen;
  State.panelOpen = open;
  DOM.propertiesPanel.classList.toggle('hidden', !open);
}

/** Update the Document Info section in the properties panel */
function updatePanelDocInfo() {
  const titleEl = $('prop-doc-title');
  const authorEl = $('prop-doc-author');
  const pagesEl = $('prop-doc-pages');
  const sizeEl = $('prop-doc-size');
  if (titleEl) titleEl.value = State.fileName.replace(/\.pdf$/i, '') || '—';
  if (authorEl) authorEl.value = '—'; // Will be populated from PDF metadata later
  if (pagesEl) pagesEl.value = State.totalPages || '—';
  if (sizeEl) sizeEl.value = State.fileSize ? formatFileSize(State.fileSize) : '—';
}

/** Update the tool properties section title based on active tool */
function updatePanelToolTitle() {
  const section = $('panel-tool-props');
  if (!section) return;
  const titleEl = section.querySelector('.panel-section-title');
  if (!titleEl) return;
  const toolNames = {
    select: 'Select Tool',
    hand: 'Hand Tool',
    text: 'Text Tool',
    highlight: 'Highlight Tool',
    draw: 'Draw Tool',
    stamp: 'Stamp Tool',
    shape: 'Shape Tool',
    cover: 'Cover Tool',
    redact: 'Redact Tool',
    image: 'Image Tool',
    watermark: 'Watermark Tool',
    'sticky-note': 'Sticky Note Tool',
    underline: 'Underline Tool',
    strikethrough: 'Strikethrough Tool',
  };
  titleEl.textContent = toolNames[State.activeTool] || 'Tool Options';
}

/* ═══════════════════ Sticky Notes — Panel & Sidebar ═══════════════════ */

function showNotePropsPanel(noteObj) {
  const panel = $('panel-note-props');
  const textarea = $('prop-note-text');
  if (!panel || !textarea) return;
  panel.classList.remove('hidden');
  textarea.value = noteObj?.noteText || '';
  // Highlight the matching color swatch
  const swatches = document.querySelectorAll('#note-color-swatches .color-swatch');
  swatches.forEach(s => s.classList.remove('active'));
  const colorName = noteObj?.noteColor || 'yellow';
  const match = document.querySelector(`[data-note-color="${colorName}"]`);
  if (match) match.classList.add('active');
}

function hideNotePropsPanel() {
  const panel = $('panel-note-props');
  if (panel) panel.classList.add('hidden');
}

function refreshNotesSidebar() {
  const panel = $('sidebar-notes');
  if (!panel) return;

  const notes = getAllStickyNotes();

  if (notes.length === 0) {
    panel.innerHTML = `
      <div class="sidebar-empty">
        <span data-icon="message-square" data-icon-size="24"></span>
        <p>No notes yet</p>
        <p class="sidebar-empty-hint">Add sticky notes to pages to see them here.</p>
      </div>`;
    replaceIcons();
    // Update badge
    const badge = document.querySelector('.sidebar-tab[data-sidebar="notes"] .sidebar-tab-label');
    if (badge) badge.dataset.count = '';
    return;
  }

  panel.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'notes-list';
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;padding:8px;';

  notes.forEach(note => {
    const item = document.createElement('button');
    item.className = 'note-list-item';
    item.style.cssText = `
      display:flex;align-items:flex-start;gap:8px;width:100%;
      text-align:left;padding:8px 10px;border-radius:var(--mb-radius-sm);
      border:1px solid var(--mb-border-light);background:var(--mb-surface-alt);
      cursor:pointer;font-size:12px;color:var(--mb-text);
    `;

    const colorMap = { yellow:'#fff9c4', green:'#c8e6c9', blue:'#bbdefb', pink:'#f8bbd0', orange:'#ffe0b2' };
    const bg = colorMap[note.noteColor] || '#fff9c4';

    item.innerHTML = `
      <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${bg};border:1px solid rgba(0,0,0,0.15);flex-shrink:0;margin-top:1px;"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${note.noteText || '<em style="color:var(--mb-text-muted)">Empty note</em>'}</span>
      <span style="color:var(--mb-text-muted);flex-shrink:0;">p.${note.pageNum}</span>
    `;

    item.addEventListener('click', () => {
      goToPage(note.pageNum);
    });

    list.appendChild(item);
  });

  panel.appendChild(list);

  // Update badge count
  const badge = document.querySelector('.sidebar-tab[data-sidebar="notes"] .sidebar-tab-label');
  if (badge) badge.dataset.count = notes.length;
}

/* ═══════════════════ Event Wiring ═══════════════════ */

function wireEvents() {
  // File open
  $('open-file-btn').addEventListener('click', () => DOM.fileInput.click());
  $('btn-open').addEventListener('click', () => DOM.fileInput.click());
  DOM.fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFiles(Array.from(e.target.files));
    e.target.value = ''; // reset so same file can be reopened
  });

  // Page navigation
  DOM.btnFirst.addEventListener('click', firstPage);
  DOM.btnPrev.addEventListener('click', prevPage);
  DOM.btnNext.addEventListener('click', nextPage);
  DOM.btnLast.addEventListener('click', lastPage);
  DOM.pageInput.addEventListener('change', () => {
    const val = parseInt(DOM.pageInput.value);
    if (!isNaN(val)) goToPage(val);
  });
  DOM.pageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = parseInt(DOM.pageInput.value);
      if (!isNaN(val)) goToPage(val);
      DOM.pageInput.blur();
    }
  });

  // Zoom (ribbon)
  $('btn-zoom-in').addEventListener('click', zoomIn);
  $('btn-zoom-out').addEventListener('click', zoomOut);
  $('btn-zoom-level').addEventListener('click', () => setZoom(1.0));
  $('btn-fit-width').addEventListener('click', fitWidth);
  $('btn-fit-page').addEventListener('click', fitPage);

  // Zoom (status bar)
  DOM.statusZoomIn.addEventListener('click', zoomIn);
  DOM.statusZoomOut.addEventListener('click', zoomOut);
  DOM.statusZoom.addEventListener('click', () => setZoom(1.0));

  // Ctrl+scroll zoom on canvas area
  DOM.canvasArea.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  }, { passive: false });

  // Merge modal
  $('btn-merge').addEventListener('click', openMergeModal);
  $('merge-drop-zone').addEventListener('click', () => $('merge-file-input').click());
  $('merge-file-input').addEventListener('change', e => {
    if (e.target.files.length) addMergeFiles(Array.from(e.target.files));
    e.target.value = '';
  });
  $('merge-drop-zone').addEventListener('dragover', e => e.preventDefault());
  $('merge-drop-zone').addEventListener('drop', e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length) addMergeFiles(files);
  });
  $('btn-merge-execute').addEventListener('click', executeMerge);

  // Split modal
  $('btn-split').addEventListener('click', openSplitModal);
  $('split-range-input').addEventListener('input', updateSplitPreview);
  $('btn-split-execute').addEventListener('click', executeSplit);

  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.dataset.closeModal;
      if (modal === 'merge') closeMergeModal();
      if (modal === 'split') closeSplitModal();
      if (modal === 'watermark') closeWatermarkModal();
      if (modal === 'bates') closeBatesModal();
      if (modal === 'hf') closeHfModal();
      if (modal === 'crop') closeCropModal();
      if (modal === 'signature') closeSignatureModal();
      if (modal === 'ocr') $('ocr-modal-backdrop').classList.add('hidden');
    });
  });

  // Annotation tool buttons (sync active state across all ribbon panels)
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      selectTool(btn.dataset.tool);
    });
  });

  // Floating toolbar tool buttons
  document.querySelectorAll('.float-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  // Sidebar tab switching
  document.querySelectorAll('.sidebar-tab[data-sidebar]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab[data-sidebar]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = $('sidebar-' + tab.dataset.sidebar);
      if (panel) panel.classList.add('active');
    });
  });

  // Sidebar toggle
  $('btn-toggle-sidebar').addEventListener('click', toggleSidebar);

  // Properties panel close
  $('btn-close-panel').addEventListener('click', () => togglePropertiesPanel(false));

  // Properties panel — color swatches
  document.querySelectorAll('#panel-tool-props .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#panel-tool-props .color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      // Future: push color to active annotation tool
    });
  });

  // Properties panel — opacity slider
  const opacitySlider = $('prop-opacity');
  const opacityValue = $('prop-opacity-value');
  if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener('input', () => {
      opacityValue.textContent = opacitySlider.value + '%';
      // Future: push opacity to active annotation tool
    });
  }

  // Dark mode
  $('btn-dark-mode').addEventListener('click', toggleDarkMode);

  // Ribbon tab switching
  document.querySelectorAll('.ribbon-tab[data-ribbon]').forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs and panels
      document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ribbon-content').forEach(p => p.classList.remove('active'));
      // Activate clicked tab and its panel
      tab.classList.add('active');
      const panel = $('ribbon-' + tab.dataset.ribbon);
      if (panel) panel.classList.add('active');
    });
  });

  // Signature modal
  $('btn-signature').addEventListener('click', openSignatureModal);
  // Also wire sig-open-btn class (Annotate ribbon + floating toolbar duplicates)
  document.querySelectorAll('.sig-open-btn').forEach(btn => {
    btn.addEventListener('click', openSignatureModal);
  });

  // Watermark modal
  $('btn-watermark').addEventListener('click', openWatermarkModal);
  $('btn-watermark-execute').addEventListener('click', executeWatermark);
  $('watermark-opacity').addEventListener('input', () => {
    $('watermark-opacity-value').textContent = Math.round(parseFloat($('watermark-opacity').value) * 100) + '%';
  });

  // Bates Numbering modal
  $('btn-bates').addEventListener('click', openBatesModal);
  $('btn-bates-execute').addEventListener('click', executeBates);
  // Live preview update on any Bates input change
  ['bates-prefix', 'bates-suffix', 'bates-start', 'bates-pad'].forEach(id => {
    $(id).addEventListener('input', updateBatesPreview);
  });
  // Toggle custom range visibility
  $('bates-page-range').addEventListener('change', () => {
    const custom = $('bates-custom-range');
    if ($('bates-page-range').value === 'custom') {
      custom.classList.remove('hidden');
    } else {
      custom.classList.add('hidden');
    }
  });

  // Headers & Footers modal
  $('btn-headers-footers').addEventListener('click', openHfModal);
  $('btn-hf-execute').addEventListener('click', executeHeadersFooters);
  // Track last-focused zone input for token insertion
  document.querySelectorAll('.hf-zone').forEach(input => {
    input.addEventListener('focus', () => { lastFocusedHfZone = input; });
    input.addEventListener('input', updateHfPreview);
  });
  // Token buttons
  document.querySelectorAll('.hf-token-btn').forEach(btn => {
    btn.addEventListener('click', () => insertHfToken(btn.dataset.token));
  });
  // Toggle custom range
  $('hf-page-range').addEventListener('change', () => {
    const custom = $('hf-custom-range');
    if ($('hf-page-range').value === 'custom') {
      custom.classList.remove('hidden');
    } else {
      custom.classList.add('hidden');
    }
  });

  // Crop modal
  $('btn-crop-page').addEventListener('click', openCropModal);
  $('btn-crop-execute').addEventListener('click', executeCrop);
  // Preset buttons
  document.querySelectorAll('.crop-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      $('crop-top').value = btn.dataset.top;
      $('crop-bottom').value = btn.dataset.bottom;
      $('crop-left').value = btn.dataset.left;
      $('crop-right').value = btn.dataset.right;
    });
  });

  // OCR modal
  $('btn-ocr').addEventListener('click', () => {
    $('ocr-modal-backdrop').classList.remove('hidden');
    $('ocr-progress-area').classList.add('hidden');
    $('btn-ocr-run').disabled = false;
    // Default to current page
    const radios = document.querySelectorAll('input[name="ocr-scope"]');
    radios[0].checked = true;
  });

  $('btn-ocr-run').addEventListener('click', async () => {
    if (!State.pdfDoc) return;

    // Determine page numbers
    const scope = document.querySelector('input[name="ocr-scope"]:checked').value;
    let pageNumbers = [];

    if (scope === 'current') {
      pageNumbers = [State.currentPage];
    } else if (scope === 'all') {
      pageNumbers = Array.from({ length: State.totalPages }, (_, i) => i + 1);
    } else if (scope === 'range') {
      const rangeStr = $('ocr-range-input').value.trim();
      if (!rangeStr) {
        toast('Enter a page range', 'warning');
        return;
      }
      pageNumbers = parsePageRanges(rangeStr, State.totalPages);
      if (!pageNumbers.length) {
        toast('Invalid page range', 'error');
        return;
      }
    }

    // Show progress
    $('ocr-progress-area').classList.remove('hidden');
    $('btn-ocr-run').disabled = true;

    try {
      await runOCR(State.pdfDoc, pageNumbers, (info) => {
        $('ocr-progress-label').textContent = info.status;
        $('ocr-progress-pct').textContent = Math.round(info.progress) + '%';
        $('ocr-progress-bar').style.width = info.progress + '%';
      });

      // Augment find text index with OCR results
      const ocrEntries = getOCRTextEntries();
      if (ocrEntries.length > 0) {
        augmentTextIndex(ocrEntries);
      }

      // Update status bar
      const ocrBadge = $('status-ocr');
      if (ocrBadge) {
        ocrBadge.textContent = `OCR ✓ (${pageNumbers.length} pg${pageNumbers.length !== 1 ? 's' : ''})`;
        ocrBadge.classList.remove('hidden');
      }

      // Re-render current page to show OCR text layer
      await renderCurrentPage();

      toast(`OCR complete — ${pageNumbers.length} page${pageNumbers.length !== 1 ? 's' : ''} processed`, 'success');

      // Close modal
      $('ocr-modal-backdrop').classList.add('hidden');
    } catch (err) {
      toast('OCR failed: ' + err.message, 'error');
      console.error('OCR error:', err);
    } finally {
      $('btn-ocr-run').disabled = false;
    }
  });

  // Edit ribbon — Insert Blank Page
  $('btn-insert-blank').addEventListener('click', async () => {
    if (!State.pdfBytes) return;
    showLoading();
    try {
      const newBytes = await insertBlankPage(State.pdfBytes, State.currentPage - 1);
      await reloadAfterEdit(newBytes);
      toast('Blank page inserted', 'success');
    } catch (err) {
      toast('Insert failed: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // Image insertion
  $('btn-insert-image').addEventListener('click', handleImageInsert);
  $('image-file-input').addEventListener('change', onImageFileSelected);

  // Sticky note — note text textarea
  const noteTextarea = $('prop-note-text');
  if (noteTextarea) {
    noteTextarea.addEventListener('input', () => {
      updateSelectedNoteText(noteTextarea.value);
      refreshNotesSidebar();
    });
  }

  // Sticky note — color swatches in props panel
  document.querySelectorAll('#note-color-swatches .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const canvas = getCanvas();
      if (!canvas) return;
      const obj = canvas.getActiveObject();
      if (!obj || obj.mudbrickType !== 'sticky-note') return;
      const colorName = swatch.dataset.noteColor;
      const colorMap = { yellow:'#fff9c4', green:'#c8e6c9', blue:'#bbdefb', pink:'#f8bbd0', orange:'#ffe0b2' };
      const fill = colorMap[colorName];
      if (!fill) return;
      // Update the rect background in the group
      if (obj._objects) {
        const rect = obj._objects.find(o => o.type === 'rect');
        if (rect) {
          rect.set('fill', fill);
        }
      }
      obj.noteColor = colorName;
      canvas.renderAll();
      savePageAnnotations(State.currentPage);
      // Update swatch active state
      document.querySelectorAll('#note-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      refreshNotesSidebar();
    });
  });

  // Fabric canvas selection events — show/hide note props
  // We use a MutationObserver-style approach via periodic check, but
  // actually Fabric fires events we can hook after init.
  // Hook into canvas events after a short delay (canvas is ready after boot)
  setTimeout(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj && obj.mudbrickType === 'sticky-note') {
        showNotePropsPanel(obj);
      } else {
        hideNotePropsPanel();
      }
    });

    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      if (obj && obj.mudbrickType === 'sticky-note') {
        showNotePropsPanel(obj);
      } else {
        hideNotePropsPanel();
      }
    });

    canvas.on('selection:cleared', () => {
      hideNotePropsPanel();
    });

    // Also refresh notes sidebar after any annotation modification
    canvas.on('object:modified', () => {
      refreshNotesSidebar();
    });

    canvas.on('object:removed', () => {
      refreshNotesSidebar();
      hideNotePropsPanel();
    });
  }, 500);

  // Export
  $('btn-export').addEventListener('click', handleExport);

  // Annotation context menu — right-click on Fabric canvas
  DOM.fabricWrapper.addEventListener('contextmenu', e => {
    // Only show annotation context menu when a PDF is loaded
    if (!State.pdfDoc) return;
    e.preventDefault();

    const canvas = getCanvas();
    if (!canvas) return;

    // Find the Fabric object under the pointer
    const target = canvas.getActiveObject() || canvas.findTarget(e);
    showAnnotationContextMenu(e, target);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Find bar events
  const findInput = $('find-input');
  if (findInput) {
    findInput.addEventListener('input', debounce(performSearch, 200));
    findInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) navigateMatch('prev');
        else navigateMatch('next');
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFindBar();
      }
    });
  }
  $('find-next')?.addEventListener('click', () => navigateMatch('next'));
  $('find-prev')?.addEventListener('click', () => navigateMatch('prev'));
  $('find-close')?.addEventListener('click', closeFindBar);
  $('find-case-sensitive')?.addEventListener('change', performSearch);

  // Window resize: debounced re-render
  window.addEventListener('resize', debounce(() => {
    if (State.pdfDoc) renderCurrentPage();
  }, 250));

  // Drag-and-drop on canvas area
  // If no PDF is loaded → open the file. If a PDF is already open → append pages.
  DOM.canvasArea.addEventListener('dragover', e => {
    e.preventDefault();
    DOM.canvasArea.classList.add('drag-over');
  });
  DOM.canvasArea.addEventListener('dragleave', () => {
    DOM.canvasArea.classList.remove('drag-over');
  });
  DOM.canvasArea.addEventListener('drop', e => {
    e.preventDefault();
    DOM.canvasArea.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (!files.length) return;
    if (State.pdfDoc) {
      // PDF already open — append pages to end
      handleAddPages(files);
    } else {
      handleFiles(files);
    }
  });

  // Drag-and-drop on sidebar thumbnail list — insert pages at drop position
  DOM.thumbnailList.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // Highlight drop target between thumbnails
    const target = getDropTarget(e);
    clearDropIndicators();
    if (target.item) {
      target.item.classList.add(target.position === 'before' ? 'drop-before' : 'drop-after');
    }
  });
  DOM.thumbnailList.addEventListener('dragleave', e => {
    // Only clear if leaving the thumbnail list entirely
    if (!DOM.thumbnailList.contains(e.relatedTarget)) {
      clearDropIndicators();
    }
  });
  DOM.thumbnailList.addEventListener('drop', e => {
    e.preventDefault();
    clearDropIndicators();
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (!files.length || !State.pdfDoc) return;

    // Determine insertion point from drop position
    const target = getDropTarget(e);
    let insertAfter;
    if (target.item) {
      const pageNum = parseInt(target.item.dataset.page);
      insertAfter = target.position === 'before' ? pageNum - 2 : pageNum - 1;
      // Clamp: -1 means insert at very beginning (before page 1)
      if (insertAfter < -1) insertAfter = -1;
    }
    // insertAfter === undefined → append at end
    // insertAfter === -1 → insert before first page (index 0)
    if (insertAfter === -1) {
      // Special case: insert at the beginning
      handleAddPages(files, -1);
    } else {
      handleAddPages(files, insertAfter);
    }
  });
}

/* ═══════════════════ Sidebar Drop Helpers ═══════════════════ */

/** Find the thumbnail item closest to the drop point and whether to insert before/after it */
function getDropTarget(e) {
  const items = Array.from(DOM.thumbnailList.querySelectorAll('.thumbnail-item'));
  if (!items.length) return { item: null, position: 'after' };

  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      return { item, position: 'before' };
    }
  }
  // Below all items — insert after last
  return { item: items[items.length - 1], position: 'after' };
}

function clearDropIndicators() {
  DOM.thumbnailList.querySelectorAll('.drop-before, .drop-after').forEach(el => {
    el.classList.remove('drop-before', 'drop-after');
  });
}

/* ═══════════════════ Keyboard Shortcuts ═══════════════════ */

function handleKeyboard(e) {
  const mod = e.ctrlKey || e.metaKey;

  // Ctrl+F — open find bar (intercept before input check so it works globally)
  if (mod && e.key === 'f' && State.pdfDoc) {
    e.preventDefault();
    openFindBar();
    return;
  }

  // Don't intercept when typing in inputs, selects, or Fabric IText editing
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.target.contentEditable === 'true') return;
  if (!State.pdfDoc) return;

  // Check if Fabric.js IText is being edited
  const canvas = getCanvas();
  const activeObj = canvas && canvas.getActiveObject();
  const isEditingText = activeObj && activeObj.isEditing;

  switch (true) {
    // Undo / Redo
    case mod && e.key === 'z' && !e.shiftKey:
      e.preventDefault();
      undoAnnotation();
      break;
    case mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey)):
      e.preventDefault();
      redoAnnotation();
      break;

    // Copy / Paste / Duplicate annotations
    case mod && e.key === 'c' && !isEditingText:
      e.preventDefault();
      copySelected();
      break;
    case mod && e.key === 'v' && !isEditingText:
      e.preventDefault();
      pasteClipboard();
      break;
    case mod && e.key === 'd' && !isEditingText:
      e.preventDefault();
      duplicateSelected();
      break;

    // Delete selected annotation object
    case (e.key === 'Delete' || e.key === 'Backspace') && !isEditingText:
      e.preventDefault();
      deleteSelected();
      break;

    // Escape: close find bar → deselect → switch to select tool
    case e.key === 'Escape':
      if (isFindOpen()) {
        closeFindBar();
      } else {
        if (canvas) canvas.discardActiveObject().renderAll();
        selectTool('select');
      }
      break;

    // Tool shortcuts (only when not editing text)
    case e.key === 'v' && !mod && !isEditingText:
      selectTool('select');
      break;
    case e.key === 'h' && !mod && !isEditingText:
      selectTool('hand');
      break;
    case e.key === 't' && !mod && !isEditingText:
      selectTool('text');
      break;
    case e.key === 'd' && !mod && !isEditingText:
      selectTool('draw');
      break;

    // Print
    case mod && e.key === 'p':
      e.preventDefault();
      handlePrint();
      break;

    // Navigation
    case e.key === 'ArrowLeft' || e.key === 'ArrowUp':
      if (isEditingText) return; // let Fabric handle arrows in text
      e.preventDefault();
      prevPage();
      break;
    case e.key === 'ArrowRight' || e.key === 'ArrowDown':
      if (isEditingText) return;
      e.preventDefault();
      nextPage();
      break;
    case e.key === 'Home':
      e.preventDefault();
      goToPage(1);
      break;
    case e.key === 'End':
      e.preventDefault();
      goToPage(State.totalPages);
      break;

    // Zoom
    case (e.key === '=' || e.key === '+') && mod:
      e.preventDefault();
      zoomIn();
      break;
    case e.key === '-' && mod:
      e.preventDefault();
      zoomOut();
      break;
    case e.key === '0' && mod:
      e.preventDefault();
      setZoom(1.0);
      break;

    // File open
    case e.key === 'o' && mod:
      e.preventDefault();
      DOM.fileInput.click();
      break;

    // Export / Save
    case e.key === 's' && mod:
      e.preventDefault();
      handleExport();
      break;
  }
}

/** Helper to switch tool and update UI across all ribbon panels */
function selectTool(toolName) {
  // Sync ribbon toolbar buttons
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.tool-btn[data-tool="${toolName}"]`).forEach(btn => {
    if (!btn.disabled) btn.classList.add('active');
  });
  // Sync floating toolbar buttons
  document.querySelectorAll('.float-btn[data-tool]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.float-btn[data-tool="${toolName}"]`).forEach(btn => {
    btn.classList.add('active');
  });
  State.activeTool = toolName;
  setTool(toolName, { shapeType: 'rect', stampType: 'approved' });
  updatePanelToolTitle();
  // Update canvas cursor
  DOM.canvasArea.setAttribute('data-cursor', toolName);
}

/* ═══════════════════ Public API (for testing & URL loading) ═══════════════════ */

window.Mudbrick = {
  /** Load a PDF from a URL (useful for testing and link sharing) */
  async loadFromURL(url) {
    showLoading();
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const name = url.split('/').pop() || 'document.pdf';
      await openPDF(bytes, name, bytes.length);
      toast(`Opened ${name}`, 'success');
    } catch (e) {
      console.error('Load from URL failed:', e);
      toast('Failed to load PDF from URL.', 'error');
    } finally {
      hideLoading();
    }
  },
  getState: () => State,
  goToPage,
  setZoom,
  getCanvas,
  handleExport,
};

/* ═══════════════════ Boot ═══════════════════ */

boot().then(() => {
  // Auto-load PDF from ?url= query param (useful for testing & sharing)
  const params = new URLSearchParams(window.location.search);
  const pdfUrl = params.get('url');
  if (pdfUrl) {
    window.Mudbrick.loadFromURL(pdfUrl);
  }
});
