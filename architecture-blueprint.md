# Mudbrick v2 -- Python-Based Architecture Blueprint

> Produced by: System Designer (Stage 1)
> Date: 2026-03-19
> Status: DRAFT -- awaiting Tech Lead review (Stage 2)

---

## 1. Architecture Decision: Hybrid (Python API + JS Frontend)

### Recommendation: Greenfield with Hybrid Architecture

**Decision:** Build a new application with a **Python (FastAPI) backend** and a **modern JS frontend (React)**, deployed as a monorepo on Vercel.

**Why NOT full greenfield Python full-stack (e.g., HTMX)?**
- PDF viewing, annotation drawing, canvas manipulation, and real-time zoom/pan are fundamentally **browser-native operations**. They require `<canvas>`, pointer events, pixel manipulation, and sub-frame rendering.
- HTMX/server-rendered HTML cannot deliver the interactive canvas experience that PDF annotation requires. Every brush stroke, zoom, pan, and text placement needs <16ms response time -- this is physically impossible over HTTP round-trips.
- PDF.js and Fabric.js have no Python equivalents that run in the browser. These libraries ARE the rendering engine.

**Why NOT gradual migration (keep vanilla JS, add Python endpoints)?**
- The current codebase is 21K LOC of tightly coupled vanilla JS with no component model, no state management library, and no build step. Adding a Python backend to it would mean maintaining two architectures simultaneously.
- The app.js god-module (6,566 LOC) manages all state, all event wiring, all navigation -- it cannot be incrementally decomposed without a rewrite.
- The current architecture has no API layer at all -- everything is in-browser globals and ES module imports. There is no seam to insert API calls.

**Why Greenfield Hybrid?**
- The Python backend handles what Python does well: **heavy PDF processing** (merge, split, OCR, forensic redaction, text extraction, Bates numbering, headers/footers, export, encryption, comparison).
- The JS frontend handles what browsers do well: **rendering, annotation, real-time interaction** (PDF.js rendering, Fabric.js canvas, zoom/pan, text editing overlay, form filling, signatures).
- This split maps naturally to the existing module boundaries -- ~60% of the LOC is UI/interaction (stays JS), ~40% is PDF processing (moves to Python).

### What Python Unlocks

| Capability | Current (JS) | Python Backend |
|---|---|---|
| Redaction | Visual-only (black rects) | **Forensic** -- PyMuPDF strips underlying objects |
| OCR | Tesseract.js (limited, slow on large docs) | pytesseract or EasyOCR (faster, more accurate) |
| PDF manipulation | pdf-lib (limited JS library) | PyMuPDF/pikepdf (full PDF spec support) |
| Text extraction | PDF.js getTextContent (rendering-focused) | PyMuPDF (structure-aware extraction) |
| File size handling | Entire file in browser memory | Streaming/chunked processing on server |
| Security | Basic pdf-lib encryption | pikepdf (full AES-256, permission control) |
| Comparison | Basic text diff | PyMuPDF page-level diff with visual overlay |

---

## 2. Complete Tech Stack

### Backend (Python)
| Component | Technology | Purpose |
|---|---|---|
| Framework | **FastAPI** | Async API, streaming responses, auto OpenAPI docs |
| PDF engine | **PyMuPDF (fitz)** | Core PDF operations: merge, split, rotate, text extraction, forensic redaction, Bates, headers, comparison |
| PDF forms | **pikepdf** | Form field read/write, advanced encryption, metadata |
| OCR | **pytesseract** + Tesseract 5 | Server-side OCR at 300 DPI (faster than browser Tesseract.js) |
| Image processing | **Pillow** | Page rendering for thumbnails, OCR pre-processing |
| Task queue | **None initially** | Vercel serverless handles per-request; long tasks use streaming SSE |
| File storage | **Vercel Blob Storage** | Temporary file storage for in-progress sessions (replaces IndexedDB for large files) |
| Caching | **Vercel KV (Redis)** | Session state, operation metadata, recent files |

### Frontend (JS/React)
| Component | Technology | Purpose |
|---|---|---|
| Framework | **React 19** + **Vite** | Component model, state management, fast HMR |
| PDF rendering | **PDF.js** (via react-pdf or direct) | Page rendering, text layer, HiDPI support |
| Annotations | **Fabric.js 6** | Canvas overlay: draw, highlight, text, shapes, stamps |
| State management | **Zustand** | Lightweight, no boilerplate, good for complex state |
| Styling | **Tailwind CSS** | Utility-first, dark mode built-in, responsive |
| PWA | **Vite PWA plugin** | Service worker, offline support, install prompt |
| File handling | **Browser File API** | Drag-drop, file picker (files sent to backend for processing) |
| HTTP client | **ky** or **fetch** | API calls with streaming support |

### Infrastructure
| Component | Technology | Purpose |
|---|---|---|
| Deployment | **Vercel** | Frontend: static/edge, Backend: Python serverless functions |
| Blob storage | **Vercel Blob** | Temporary PDF storage during editing sessions (up to 500MB) |
| KV store | **Vercel KV** | Session metadata, operation status, recent files |
| CI/CD | **GitHub Actions** | Lint, test, type-check, deploy preview |
| Monorepo | **Turborepo** | Manage frontend + backend in one repo |

---

## 3. File/Folder Structure

```
mudbrick-v2/
├── apps/
│   ├── web/                          # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── viewer/
│   │   │   │   │   ├── PdfViewer.tsx         # PDF.js rendering, zoom, navigation
│   │   │   │   │   ├── PageCanvas.tsx        # Single page render + annotation overlay
│   │   │   │   │   ├── ThumbnailSidebar.tsx  # Page thumbnails
│   │   │   │   │   ├── ZoomControls.tsx      # Zoom bar, fit-to-page/width
│   │   │   │   │   └── TextLayer.tsx         # Native text selection layer
│   │   │   │   ├── annotations/
│   │   │   │   │   ├── AnnotationCanvas.tsx  # Fabric.js canvas overlay
│   │   │   │   │   ├── Toolbar.tsx           # Tool selection, properties
│   │   │   │   │   ├── DrawTool.tsx          # Freehand drawing
│   │   │   │   │   ├── HighlightTool.tsx     # Text highlight
│   │   │   │   │   ├── TextTool.tsx          # Text annotation
│   │   │   │   │   ├── ShapeTool.tsx         # Rectangles, circles, arrows
│   │   │   │   │   ├── StampTool.tsx         # Image stamps
│   │   │   │   │   └── RedactTool.tsx        # Redaction rectangles
│   │   │   │   ├── text-edit/
│   │   │   │   │   ├── TextEditMode.tsx      # Cover-and-replace text editing
│   │   │   │   │   ├── TextEditToolbar.tsx   # Font, size, color controls
│   │   │   │   │   └── ColorSampler.tsx      # Background color sampling
│   │   │   │   ├── forms/
│   │   │   │   │   ├── FormOverlay.tsx       # Form field detection overlay
│   │   │   │   │   ├── FormFieldEditor.tsx   # Form field creation/editing
│   │   │   │   │   └── FormDataImport.tsx    # Import/export form data
│   │   │   │   ├── signatures/
│   │   │   │   │   ├── SignatureModal.tsx     # Canvas signature drawing
│   │   │   │   │   └── SignatureStamp.tsx     # Place signature on page
│   │   │   │   ├── find/
│   │   │   │   │   ├── FindBar.tsx           # Search UI
│   │   │   │   │   └── SearchHighlights.tsx  # Highlight matches on page
│   │   │   │   ├── sidebar/
│   │   │   │   │   ├── PageList.tsx          # Drag-to-reorder pages
│   │   │   │   │   └── OutlinePanel.tsx      # Bookmarks/outline
│   │   │   │   ├── shared/
│   │   │   │   │   ├── Toast.tsx             # Notification toasts
│   │   │   │   │   ├── LoadingOverlay.tsx    # Progress indicator
│   │   │   │   │   ├── Modal.tsx             # Generic modal
│   │   │   │   │   ├── DropZone.tsx          # Drag-and-drop file loading
│   │   │   │   │   └── WelcomeScreen.tsx     # Landing/file open screen
│   │   │   │   └── a11y/
│   │   │   │       ├── SkipLink.tsx          # Skip to content
│   │   │   │       ├── FocusTrap.tsx         # Modal focus trapping
│   │   │   │       └── Announcer.tsx         # ARIA live region
│   │   │   ├── hooks/
│   │   │   │   ├── usePdfDocument.ts         # PDF loading, page navigation
│   │   │   │   ├── useAnnotations.ts         # Annotation state per page
│   │   │   │   ├── useZoom.ts                # Zoom state and calculations
│   │   │   │   ├── useKeyboardShortcuts.ts   # Keyboard bindings
│   │   │   │   ├── useAutoSave.ts            # Crash recovery auto-save
│   │   │   │   ├── useUndoRedo.ts            # Annotation + doc undo/redo
│   │   │   │   └── useDarkMode.ts            # Theme toggle
│   │   │   ├── stores/
│   │   │   │   ├── documentStore.ts          # Zustand: PDF state, pages, bytes
│   │   │   │   ├── annotationStore.ts        # Zustand: per-page annotations
│   │   │   │   ├── uiStore.ts                # Zustand: sidebar, panels, modals
│   │   │   │   └── sessionStore.ts           # Zustand: recent files, preferences
│   │   │   ├── services/
│   │   │   │   ├── api.ts                    # API client (typed, streaming-aware)
│   │   │   │   ├── pdfService.ts             # PDF.js wrapper (rendering, text layer)
│   │   │   │   └── offlineService.ts         # IndexedDB for offline annotation cache
│   │   │   ├── types/
│   │   │   │   ├── pdf.ts                    # PDF-related types
│   │   │   │   ├── annotation.ts             # Annotation schema types
│   │   │   │   └── api.ts                    # API request/response types
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   └── manifest.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── api/                            # Python backend (FastAPI)
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py                 # FastAPI app, CORS, middleware
│       │   ├── config.py               # Settings, Vercel env vars
│       │   ├── routers/
│       │   │   ├── __init__.py
│       │   │   ├── documents.py        # Upload, download, session management
│       │   │   ├── pages.py            # Rotate, delete, reorder, insert, crop
│       │   │   ├── merge.py            # Merge multiple PDFs
│       │   │   ├── split.py            # Split PDF by page ranges
│       │   │   ├── ocr.py              # OCR processing (streaming progress)
│       │   │   ├── redaction.py        # Forensic redaction (pattern search + strip)
│       │   │   ├── text.py             # Text extraction, search index building
│       │   │   ├── export.py           # Flatten annotations, final export
│       │   │   ├── bates.py            # Bates numbering
│       │   │   ├── headers.py          # Headers/footers
│       │   │   ├── compare.py          # Document comparison
│       │   │   ├── security.py         # Encryption, metadata, sanitization
│       │   │   ├── forms.py            # Form field operations
│       │   │   └── thumbnails.py       # Page thumbnail generation
│       │   ├── services/
│       │   │   ├── __init__.py
│       │   │   ├── pdf_engine.py       # PyMuPDF wrapper (core PDF operations)
│       │   │   ├── ocr_engine.py       # pytesseract wrapper
│       │   │   ├── redaction_engine.py # Forensic redaction logic
│       │   │   ├── comparison_engine.py# Document diff engine
│       │   │   ├── blob_storage.py     # Vercel Blob Storage client
│       │   │   └── session_manager.py  # Session state via Vercel KV
│       │   ├── models/
│       │   │   ├── __init__.py
│       │   │   ├── document.py         # Document session model
│       │   │   ├── annotation.py       # Annotation data model
│       │   │   ├── operation.py        # Operation request/response models
│       │   │   └── redaction.py        # Redaction pattern models
│       │   └── utils/
│       │       ├── __init__.py
│       │       ├── streaming.py        # SSE streaming helpers
│       │       └── file_handling.py    # Chunked upload/download helpers
│       ├── requirements.txt
│       └── vercel_entry.py             # Vercel serverless entry point
│
├── packages/
│   └── shared/                         # Shared types/constants
│       ├── src/
│       │   ├── constants.ts            # Shared constants (zoom levels, limits)
│       │   └── types.ts                # Shared type definitions
│       └── package.json
│
├── vercel.json                         # Vercel deployment configuration
├── turbo.json                          # Turborepo configuration
├── package.json                        # Root package.json
└── README.md
```

---

## 4. API Design

### 4.1 Document Session Lifecycle

The core workflow is session-based: upload a PDF, get a session ID, perform operations, export when done.

```
POST   /api/documents/upload          → Upload PDF, create session, return session_id
GET    /api/documents/{session_id}    → Get session metadata (pages, size, status)
DELETE /api/documents/{session_id}    → End session, clean up blob storage
GET    /api/documents/{session_id}/download → Download current PDF state
```

### 4.2 Page Operations

```
POST   /api/pages/{session_id}/rotate     → Rotate pages (body: {pages: [1,3], degrees: 90})
POST   /api/pages/{session_id}/delete     → Delete pages (body: {pages: [2,5]})
POST   /api/pages/{session_id}/reorder    → Reorder pages (body: {order: [3,1,2,4]})
POST   /api/pages/{session_id}/insert     → Insert blank page (body: {after: 2, size: "letter"})
POST   /api/pages/{session_id}/crop       → Crop pages (body: {pages: [1], box: {x,y,w,h}})
GET    /api/pages/{session_id}/{page}/thumbnail → Get page thumbnail (query: ?width=200)
```

### 4.3 Merge / Split

```
POST   /api/merge                     → Merge multiple PDFs (multipart: files[])
POST   /api/split/{session_id}        → Split PDF (body: {ranges: ["1-3", "4-6"]})
```

### 4.4 OCR (Streaming)

```
POST   /api/ocr/{session_id}          → Start OCR (body: {pages: [1,2,3], language: "eng"})
                                        Returns SSE stream with progress updates
GET    /api/ocr/{session_id}/results   → Get OCR results (text + word positions + confidence)
```

### 4.5 Redaction (Forensic)

```
POST   /api/redaction/{session_id}/search   → Search patterns (body: {patterns: ["ssn","email"]})
                                              Returns matches with bounding boxes
POST   /api/redaction/{session_id}/apply    → Apply forensic redaction (body: {regions: [{page,x,y,w,h}]})
                                              Strips underlying PDF objects + covers with black rect
```

### 4.6 Text Operations

```
GET    /api/text/{session_id}/extract       → Extract text from all pages
GET    /api/text/{session_id}/search        → Search text (query: ?q=term&page=all)
POST   /api/text/{session_id}/edit          → Apply text edits (body: {page, edits: [{region, newText, font, size, color}]})
```

### 4.7 Bates / Headers / Exhibit Stamps

```
POST   /api/bates/{session_id}              → Apply Bates numbers (body: {prefix, startNum, position, font})
POST   /api/headers/{session_id}            → Apply headers/footers (body: {header, footer, font, pages})
POST   /api/exhibits/{session_id}           → Apply exhibit stamps (body: {format, startNum, position})
```

### 4.8 Export

```
POST   /api/export/{session_id}             → Export with annotations flattened
                                              Body: {annotations: {pageNum: fabricJSON}, options: {}}
                                              Returns download URL or streams bytes
POST   /api/export/{session_id}/images      → Export pages as images (body: {pages, format, dpi})
```

### 4.9 Document Comparison

```
POST   /api/compare                         → Compare two PDFs (multipart: file1, file2)
                                              Returns diff report with change regions
```

### 4.10 Security

```
POST   /api/security/{session_id}/encrypt   → Encrypt PDF (body: {userPassword, ownerPassword, permissions})
GET    /api/security/{session_id}/metadata  → Get document metadata
POST   /api/security/{session_id}/metadata  → Set metadata fields
POST   /api/security/{session_id}/sanitize  → Strip all metadata + hidden content
```

### 4.11 Forms

```
GET    /api/forms/{session_id}/fields       → Detect and return form fields
POST   /api/forms/{session_id}/fill         → Fill form fields (body: {fields: {name: value}})
POST   /api/forms/{session_id}/flatten      → Flatten form fields into content
GET    /api/forms/{session_id}/export       → Export form data (query: ?format=json|xfdf|csv)
POST   /api/forms/{session_id}/import       → Import form data (body: form data)
```

---

## 5. Data Flow Architecture

### 5.1 File Upload and Session Creation

```
Browser                          Vercel Edge/Serverless              Vercel Blob
  │                                    │                                │
  │─── POST /api/documents/upload ────>│                                │
  │    (chunked upload, multipart)     │                                │
  │                                    │── Store PDF to Blob ──────────>│
  │                                    │<── Return blob URL ────────────│
  │                                    │── Create session in KV ──>     │
  │<── { session_id, pages, size } ────│                                │
  │                                    │                                │
  │─── GET /pages/{sid}/1/thumbnail ──>│                                │
  │                                    │── Fetch from Blob ────────────>│
  │                                    │<── PDF bytes ──────────────────│
  │                                    │── Render thumbnail (Pillow) ──>│
  │<── image/png (thumbnail) ──────────│                                │
```

### 5.2 PDF Operation Flow (e.g., Rotate Page)

```
Browser                          API                          Blob Storage
  │                                │                               │
  │─── POST /pages/{sid}/rotate ──>│                               │
  │    { pages: [1], degrees: 90 } │                               │
  │                                │── Fetch current PDF ─────────>│
  │                                │<── PDF bytes ─────────────────│
  │                                │── PyMuPDF: rotate page 1 ────>│
  │                                │── Store modified PDF ─────────>│
  │                                │<── New blob URL ──────────────│
  │                                │── Update session in KV ──>    │
  │<── { success, newPageCount } ──│                               │
  │                                │                               │
  │─── GET /pages/{sid}/1/thumb ──>│  (refresh thumbnail)          │
```

### 5.3 Annotation Flow (Client-Side)

Annotations stay entirely client-side until export:

```
Browser (React + Fabric.js)
  │
  │── User draws annotation on Fabric.js canvas
  │── Fabric.js serializes to JSON (per-page)
  │── Zustand store: annotationStore[pageNum] = fabricJSON
  │── Auto-save to IndexedDB every 60s (crash recovery)
  │
  │── On export:
  │── POST /api/export/{session_id}
  │   Body: { annotations: { 1: fabricJSON, 3: fabricJSON, ... } }
  │── Server: overlay annotations onto PDF pages, flatten, return bytes
```

### 5.4 OCR Flow (Streaming)

```
Browser                          API (SSE Stream)              Blob Storage
  │                                │                               │
  │─── POST /api/ocr/{sid} ──────>│                               │
  │    { pages: [1,2,3] }         │                               │
  │                                │── Fetch PDF ─────────────────>│
  │                                │<── PDF bytes ─────────────────│
  │                                │                               │
  │<── SSE: {page:1, status:"processing", progress:33} ───────────│
  │                                │── pytesseract page 1 ───>     │
  │<── SSE: {page:1, status:"done", words:[...]} ─────────────────│
  │                                │                               │
  │<── SSE: {page:2, status:"processing", progress:66} ───────────│
  │                                │── pytesseract page 2 ───>     │
  │<── SSE: {page:2, status:"done", words:[...]} ─────────────────│
  │                                │                               │
  │<── SSE: {page:3, status:"done", words:[...], complete:true} ──│
```

---

## 6. How 100MB+ Files Are Handled

This is the single most critical architectural challenge. Here is the strategy:

### 6.1 Upload: Chunked Multipart

- Frontend splits file into 5MB chunks using `File.slice()`
- Each chunk uploaded via `POST /api/documents/upload/chunk` with chunk index
- Final `POST /api/documents/upload/complete` assembles chunks in Blob Storage
- Vercel Blob supports files up to 500MB (Pro plan)
- Progress bar shows upload percentage

### 6.2 Storage: Vercel Blob (Not Memory)

- PDFs are stored in Vercel Blob Storage, NOT loaded entirely into serverless function memory
- Serverless functions have 1024MB memory (Pro) -- a 100MB PDF loaded + PyMuPDF overhead would consume most of it
- For operations that need the full file (merge, export), stream from Blob to /tmp, process, stream back
- /tmp on Vercel has up to 512MB (Pro) -- sufficient for one 100MB file at a time

### 6.3 Processing: Page-Level Granularity

- Most operations (rotate, delete, thumbnail, OCR) only need individual pages
- PyMuPDF can open a PDF and access specific pages without loading entire content into memory
- Page-level operations: read PDF from /tmp, modify target page(s), write back
- Full-document operations (merge, Bates, export): process in streaming fashion page-by-page

### 6.4 Download: Streaming Response

- Export results streamed back to browser using `StreamingResponse`
- Vercel Pro allows up to 20MB response body (still below 100MB)
- **Solution:** Generate a Blob Storage URL and redirect browser to download directly from Blob
- `POST /api/export/{sid}` returns `{ downloadUrl: "https://blob.vercel-storage.com/..." }`
- Browser fetches from Blob URL (no serverless body limit applies)

### 6.5 Client-Side Caching

- After download, browser caches PDF bytes in IndexedDB for offline use
- Annotations always stored client-side (IndexedDB)
- Page thumbnails cached in browser after first render
- Only API calls needed: processing operations that modify the PDF

### 6.6 Timeout Strategy

- Simple operations (rotate, delete): < 10s -- default timeout fine
- Medium operations (Bates, headers, text edit): 10-30s -- use Pro 300s limit
- Heavy operations (OCR 50+ pages, merge 100MB files): use SSE streaming
  - SSE keeps connection alive with progress events
  - Client shows progress bar
  - If timeout hits, operation state saved in KV, client can poll/resume

---

## 7. Frontend-Backend Split: What Goes Where

### Stays on Frontend (Browser)
| Feature | Reason |
|---|---|
| PDF rendering (PDF.js) | Must be real-time, <16ms frame budget |
| Annotation drawing (Fabric.js) | Real-time pointer tracking, canvas manipulation |
| Zoom/pan/navigation | Must be instant, no network latency acceptable |
| Text editing overlay (contenteditable) | Real-time typing, cursor positioning |
| Form field filling (UI) | Real-time input, validation |
| Signature drawing (canvas) | Real-time freehand drawing |
| Dark mode | CSS only |
| Keyboard shortcuts | Browser event handling |
| Onboarding tooltips | UI-only |
| Recent files | IndexedDB/localStorage |
| Find/search highlighting | After server returns positions, highlighting is client-side |
| Drag-and-drop | Browser File API |
| Accessibility | DOM, ARIA, focus management |
| Auto-save (annotations) | IndexedDB, client-side |
| Annotation undo/redo | Client-side Fabric.js state |

### Moves to Backend (Python)
| Feature | Reason |
|---|---|
| PDF merge/split | PyMuPDF is more capable than pdf-lib |
| Page rotate/delete/reorder | PyMuPDF, persistent state in Blob |
| OCR | pytesseract (faster, no WASM overhead, better accuracy) |
| Forensic redaction | PyMuPDF can strip PDF objects (NEW capability) |
| Pattern search (SSN, email) | Server-side text extraction + regex |
| Bates numbering | PyMuPDF page stamping |
| Headers/footers | PyMuPDF page stamping |
| Exhibit stamps | PyMuPDF page stamping |
| Text extraction | PyMuPDF (better than PDF.js for extraction) |
| Export (flatten annotations) | Server receives annotation JSON, embeds into PDF |
| Document comparison | PyMuPDF page-level diff |
| Encryption/metadata | pikepdf (full AES-256) |
| Document sanitization | PyMuPDF + pikepdf |
| Form field detection | PyMuPDF form parsing |
| Thumbnail generation | PyMuPDF + Pillow |
| Page labels | PyMuPDF page label support |
| Document undo/redo | Blob Storage versioning (replaces 300MB memory budget) |

---

## 8. Deployment Architecture on Vercel

### vercel.json

```json
{
  "buildCommand": "turbo build",
  "outputDirectory": "apps/web/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.py": {
      "runtime": "@vercel/python@4",
      "maxDuration": 300,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    },
    {
      "source": "/((?!api/).*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

### Deploy Size Constraints

The 50MB deploy size limit is the key constraint. Here's how we stay under:

- **Frontend (Vite build):** ~2-3MB (JS bundle + assets)
- **Python dependencies (PyMuPDF + pikepdf + pytesseract + Pillow + FastAPI):** ~35-40MB
- **Tesseract binary:** NOT bundled -- use Vercel's Python runtime which can install system packages, OR use a container-based approach
- **Total:** ~40-45MB -- fits within 50MB limit

**Risk mitigation for Tesseract:** If pytesseract + Tesseract binary exceed deploy limits, fall back to:
1. Use `easyocr` (pure Python, smaller footprint)
2. Keep OCR client-side via Tesseract.js as a fallback
3. Use an external OCR API (Google Vision, AWS Textract) as a premium option

### Environment Architecture

```
Production:
  ├── Vercel Edge Network (CDN)
  │   └── Static frontend (React/Vite build)
  ├── Vercel Serverless Functions (Python)
  │   └── FastAPI endpoints
  ├── Vercel Blob Storage
  │   └── PDF files (per-session, auto-expire after 24h)
  └── Vercel KV (Redis)
      └── Session metadata, operation status
```

---

## 9. Session and State Management

### Session Lifecycle

```
1. User opens app → WelcomeScreen (no session)
2. User uploads PDF → POST /api/documents/upload
   → Blob Storage: store PDF
   → KV: create session { id, blobUrl, pages, size, createdAt, expiresAt }
   → Return session_id to frontend
3. User performs operations → API calls with session_id
   → Each mutation: fetch PDF from Blob, modify, store new version
   → KV: update session metadata
4. User exports → POST /api/export/{session_id}
   → Server flattens annotations into PDF
   → Return download URL
5. Session expires (24h) or user closes
   → Blob Storage: auto-cleanup via TTL
   → KV: auto-expire
```

### Document Undo/Redo (Server-Side)

Replace the current 300MB memory budget with Blob Storage versioning:

```
KV session structure:
{
  "session_id": "abc123",
  "current_version": 3,
  "versions": [
    { "version": 1, "blob_url": "...", "operation": "upload", "timestamp": "..." },
    { "version": 2, "blob_url": "...", "operation": "rotate_page_1", "timestamp": "..." },
    { "version": 3, "blob_url": "...", "operation": "delete_page_5", "timestamp": "..." }
  ],
  "max_versions": 20
}
```

- Each mutation creates a new Blob version (cheap storage, no memory constraint)
- Undo: set current_version -= 1, serve that version's blob URL
- Redo: set current_version += 1
- Can store 20+ undo levels vs. current 5 (300MB memory limit eliminated)

---

## 10. Offline / PWA Strategy

The hybrid architecture introduces a network dependency for PDF processing. Here's how to maintain offline capability:

### Offline-Capable (No Network Needed)
- PDF viewing (PDF.js renders from cached bytes)
- Annotation drawing/editing (Fabric.js, all client-side)
- Zoom, pan, navigation
- Dark mode, keyboard shortcuts
- Auto-save annotations to IndexedDB
- Recent files list

### Requires Network (Graceful Degradation)
- PDF upload (queued, sync when online)
- Page operations (rotate, delete, merge, split)
- OCR processing
- Redaction
- Bates/headers/exhibits
- Export with flattened annotations
- Document comparison

### Offline Strategy
1. **Service worker** caches frontend assets (React build)
2. **IndexedDB** stores annotation state per-document
3. **Offline indicator** in UI when backend is unreachable
4. **Operation queue**: page operations queued locally, synced when online
5. **Fallback**: for critical offline operations (basic export), include minimal pdf-lib in frontend bundle as fallback

---

## 11. Migration from Current Codebase

### What Transfers Directly
- **Redaction patterns** (redact-patterns.js → Python regex patterns, direct port)
- **Annotation schema** (Fabric.js JSON format stays the same)
- **Zoom levels and fit calculations** (math transfers directly)
- **Color sampling logic** (text-edit.js → React component)
- **Keyboard shortcut mappings** (keyboard-shortcuts.js → React hook)
- **Accessibility patterns** (a11y.js → React components)
- **UI design** (welcome screen, toolbar layout, sidebar)

### What Gets Rewritten
- **app.js** (6,566 LOC god-module) → React components + Zustand stores
- **pdf-edit.js** → Python PyMuPDF service
- **ocr.js** → Python pytesseract service
- **export.js** → Python export service (with Fabric.js JSON → PDF annotation embedding)
- **error-handler.js** → React error boundary + API error handling
- **doc-history.js** → Server-side Blob versioning
- **security.js** → Python pikepdf service
- **doc-compare.js** → Python PyMuPDF comparison service

### What Gets Upgraded
- **Redaction**: visual-only → forensic (PyMuPDF strips PDF objects)
- **OCR**: browser Tesseract.js → server pytesseract (faster, more accurate)
- **Undo**: 5 levels / 300MB → 20+ levels / unlimited (Blob Storage)
- **Encryption**: basic pdf-lib → full AES-256 (pikepdf)
- **Form handling**: basic detection → full form read/write/flatten (pikepdf)

---

## 12. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Vercel 50MB deploy size exceeded by Python deps | HIGH | Measure PyMuPDF + deps size early. Fallback: use Docker-based Vercel functions (250MB limit) |
| Vercel 300s timeout insufficient for OCR on 100+ page doc | HIGH | SSE streaming with per-page progress. If still insufficient: split into multiple requests, resume via KV state |
| 100MB file upload reliability | HIGH | Chunked upload with retry per chunk. Vercel Blob handles storage. Test with 100MB+ files early in Phase 1 |
| Tesseract binary not available in Vercel Python runtime | MEDIUM | Test early. Alternatives: easyocr (pure Python), keep client-side Tesseract.js as fallback, external API |
| Vercel cold start latency for Python functions | MEDIUM | Keep functions lightweight. Use Vercel's "Always Warm" if available (Pro). First-request UX: show loading indicator |
| Offline degradation breaks existing workflows | MEDIUM | Maintain pdf-lib as frontend fallback for basic operations. Clear UI about what requires network |
| Fabric.js annotation JSON → PDF embedding complexity | MEDIUM | Build a robust server-side renderer that maps Fabric objects → PyMuPDF drawing commands. Test exhaustively |
| Cost: Vercel Blob + KV usage at scale | LOW | 24h TTL on sessions. Monitor usage. Blob is $0.15/GB/month. KV is included in Pro |
| React migration increases bundle size | LOW | Vite tree-shaking + code splitting. Target < 200KB initial JS |

---

## 13. Open Questions for Tech Lead

1. **Vercel plan level**: Are we on Pro ($20/mo) or Enterprise? This determines: max function duration (300s vs 900s), response body limit (20MB vs custom), blob storage limits.

2. **Tesseract availability**: Need to verify that Vercel's Python runtime can install/run Tesseract. If not, should we use easyocr, keep client-side OCR, or use an external API?

3. **Session storage costs**: Vercel Blob + KV pricing at Novo Legal's usage level. How many concurrent users? How many PDFs/day?

4. **Offline priority**: How critical is offline PDF processing for Novo Legal? Current app is fully offline-capable. The hybrid approach degrades some operations to online-only.

5. **Timeline expectations**: Greenfield rewrite of 28K LOC is 3-6 months for a small team. Is that acceptable, or should we phase it differently?

6. **Filevine integration**: Any plans to integrate Mudbrick more deeply with Filevine (e.g., direct document pull/push from cases)?
