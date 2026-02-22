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
  formatFileSize, initDragDrop, debounce,
} from './utils.js';

import { resetPdfLib } from './pdf-edit.js';

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
  statusPages: $('status-pages'),
  statusZoom: $('status-zoom'),
  statusFilesize: $('status-filesize'),
  fileInput: $('file-input'),
  btnPrev: $('btn-prev-page'),
  btnNext: $('btn-next-page'),
};

/* ═══════════════════ Initialization ═══════════════════ */

async function boot() {
  try {
    // Initialize PDF.js (async CDN import)
    await initPdfJs();

    // Set up drag-and-drop on welcome screen
    initDragDrop('drop-zone', handleFiles);

    // Wire up all UI events
    wireEvents();

    // Check for dark mode preference
    if (localStorage.getItem('mudbrick-dark') === 'true' ||
        (!localStorage.getItem('mudbrick-dark') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      $('btn-dark-mode').textContent = '☀️';
    }

    console.log('🧱 Mudbrick ready');
  } catch (e) {
    console.error('Boot failed:', e);
    toast('Failed to initialize PDF engine. Please refresh.', 'error');
  }
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
  State.pageAnnotations = {};

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

  // Update UI
  updateStatusBar();
  updatePageNav();

  // Render first page
  await renderCurrentPage();

  // Generate thumbnails lazily
  generateThumbnails();

  // Calculate initial fit-width zoom
  requestAnimationFrame(() => {
    fitWidth();
  });
}

/* ═══════════════════ Page Rendering ═══════════════════ */

async function renderCurrentPage() {
  if (!State.pdfDoc) return;

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

  // Size the Fabric wrapper to match (Phase 4 will use this)
  DOM.fabricWrapper.style.width = Math.floor(viewport.width) + 'px';
  DOM.fabricWrapper.style.height = Math.floor(viewport.height) + 'px';

  // Size the page container
  DOM.pageContainer.style.width = Math.floor(viewport.width) + 'px';
  DOM.pageContainer.style.height = Math.floor(viewport.height) + 'px';

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

function updatePageNav() {
  DOM.pageInput.value = State.currentPage;
  DOM.pageInput.max = State.totalPages;
  DOM.totalPages.textContent = State.totalPages;
  DOM.btnPrev.disabled = State.currentPage <= 1;
  DOM.btnNext.disabled = State.currentPage >= State.totalPages;
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

/* ═══════════════════ Status Bar ═══════════════════ */

function updateStatusBar() {
  DOM.statusFilename.textContent = State.fileName || 'No file loaded';
  DOM.statusPages.textContent = State.totalPages > 0
    ? `${State.totalPages} page${State.totalPages !== 1 ? 's' : ''}`
    : '';
  DOM.statusFilesize.textContent = State.fileSize > 0
    ? formatFileSize(State.fileSize) : '';
  updateZoomDisplay();
}

/* ═══════════════════ Dark Mode ═══════════════════ */

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('mudbrick-dark', !isDark);
  $('btn-dark-mode').textContent = isDark ? '🌙' : '☀️';
}

/* ═══════════════════ Sidebar Toggle ═══════════════════ */

function toggleSidebar() {
  State.sidebarOpen = !State.sidebarOpen;
  DOM.sidebar.classList.toggle('collapsed', !State.sidebarOpen);
  $('btn-toggle-sidebar').textContent = State.sidebarOpen ? '◀' : '▶';
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
  DOM.btnPrev.addEventListener('click', prevPage);
  DOM.btnNext.addEventListener('click', nextPage);
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

  // Zoom
  $('btn-zoom-in').addEventListener('click', zoomIn);
  $('btn-zoom-out').addEventListener('click', zoomOut);
  $('btn-zoom-level').addEventListener('click', () => setZoom(1.0));
  $('btn-fit-width').addEventListener('click', fitWidth);
  $('btn-fit-page').addEventListener('click', fitPage);

  // Ctrl+scroll zoom on canvas area
  DOM.canvasArea.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  }, { passive: false });

  // Sidebar toggle
  $('btn-toggle-sidebar').addEventListener('click', toggleSidebar);

  // Dark mode
  $('btn-dark-mode').addEventListener('click', toggleDarkMode);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Window resize: debounced re-render
  window.addEventListener('resize', debounce(() => {
    if (State.pdfDoc) renderCurrentPage();
  }, 250));
}

/* ═══════════════════ Keyboard Shortcuts ═══════════════════ */

function handleKeyboard(e) {
  // Don't intercept when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (!State.pdfDoc) return;

  const mod = e.ctrlKey || e.metaKey;

  switch (true) {
    // Navigation
    case e.key === 'ArrowLeft' || e.key === 'ArrowUp':
      e.preventDefault();
      prevPage();
      break;
    case e.key === 'ArrowRight' || e.key === 'ArrowDown':
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
  }
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
