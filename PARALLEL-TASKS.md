# Mudbrick v2 -- Parallel Task Breakdown (Tauri Desktop)

> For use by a coordinator agent to assign independent tasks to multiple dev agents simultaneously.
> Each task has explicit inputs, outputs, and dependencies so agents can work in isolation.

---

## How to Read This Document

- **Tracks** are independent workstreams that can run in parallel
- **Tasks** within a track are sequential (top to bottom)
- **Cross-track dependencies** are marked with `BLOCKED_BY: [Track.Task]`
- Tasks with no `BLOCKED_BY` can start immediately once their track's prior task is done
- Each task lists files it creates/modifies so agents don't collide
- **Git rule:** Always use `git -C <path>` instead of `cd path && git`. One command per Bash call.

---

## Phase 1: MVP Core (Weeks 1-6)

### Track A: Project Scaffolding & Infrastructure

#### A1: Monorepo + Frontend Scaffold
- **What:** Create branch `mudbrickv2`. Set up pnpm workspace, Vite + React 19 + TypeScript, ESLint, Vitest, CSS Modules.
- **Creates:**
  - `pnpm-workspace.yaml`
  - `package.json` (root)
  - `apps/web/package.json`
  - `apps/web/tsconfig.json`
  - `apps/web/vite.config.ts` (with `/api` proxy to localhost:8000)
  - `apps/web/index.html`
  - `apps/web/src/main.tsx`
  - `apps/web/src/App.tsx` (shell with sidebar + main area)
  - `apps/web/src/styles/variables.css` (port from v1 `styles/variables.css`)
  - `apps/web/src/styles/global.css`
  - `packages/shared/package.json`
  - `packages/shared/src/constants.ts` (zoom levels, limits)
  - `.env.example`
- **Acceptance:** `pnpm dev` starts Vite on :5173, renders "Mudbrick v2" placeholder.
- **BLOCKED_BY:** None (first task)

#### A2: Backend Scaffold
- **What:** Set up FastAPI app with health check, CORS for localhost, uvicorn.
- **Creates:**
  - `apps/api/app/__init__.py`
  - `apps/api/app/main.py` (FastAPI app, CORS, `/api/health`)
  - `apps/api/app/config.py` (settings: data dir paths, %APPDATA%)
  - `apps/api/requirements.txt` (fastapi, uvicorn, pymupdf, python-multipart, pydantic, pillow, pikepdf, pytesseract, httpx, pytest, sse-starlette)
  - `apps/api/app/services/__init__.py`
  - `apps/api/app/routers/__init__.py`
  - `apps/api/app/models/__init__.py`
  - `apps/api/app/utils/__init__.py`
- **Acceptance:** `uvicorn app.main:app --reload --port 8000` starts. `GET /api/health` returns 200.
- **BLOCKED_BY:** None (can run parallel with A1)

#### A3: Tauri Shell Setup
- **What:** Initialize Tauri 2.x in the project. Configure window, permissions, sidecar placeholder.
- **Creates:**
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json` (window config, permissions, sidecar)
  - `src-tauri/capabilities/default.json` (fs, dialog, shell, http)
  - `src-tauri/src/main.rs` (Tauri entry, sidecar spawn + health check)
  - `src-tauri/src/lib.rs` (Tauri commands: file dialogs, app data path)
  - `src-tauri/icons/` (placeholder icons)
- **Acceptance:** `pnpm tauri dev` opens a native window showing the React app. Sidecar spawn logic compiles (sidecar binary not yet built).
- **BLOCKED_BY:** A1

#### A4: Session Manager
- **What:** Build session lifecycle: open file, copy to temp, version management, undo, redo, close, cleanup.
- **Creates:**
  - `apps/api/app/services/session_manager.py`
  - `apps/api/app/models/document.py` (Pydantic: SessionMetadata, VersionInfo)
  - `apps/api/app/dependencies.py` (get_session dependency)
  - `apps/api/app/utils/file_handling.py` (temp dir management)
  - `apps/api/tests/conftest.py`
  - `apps/api/tests/test_session_manager.py`
- **Acceptance:** Can open file → create session → create versions → undo/redo → close + cleanup.
- **BLOCKED_BY:** A2

#### A5: CI/CD
- **What:** GitHub Actions workflows for testing and building.
- **Creates:**
  - `.github/workflows/test.yml` (lint + test frontend + backend)
  - `.github/workflows/release.yml` (build installer, publish to GitHub Releases)
  - `scripts/build-sidecar.ps1`
  - `scripts/build-sidecar.sh`
  - `scripts/dev.ps1`
- **Acceptance:** Push to `mudbrickv2` triggers lint + test. Tag push triggers build + release.
- **BLOCKED_BY:** A1, A2, A3

---

### Track B: PDF Backend Services

> Can start after A2 (needs backend scaffold). No dependency on Tauri.

#### B1: PDF Engine Core
- **What:** PyMuPDF wrapper: open from path, page count, page dimensions, render page to image, save.
- **Creates:**
  - `apps/api/app/services/pdf_engine.py`
  - `apps/api/tests/test_pdf_engine.py`
  - `apps/api/tests/fixtures/` (small test PDFs)
- **Acceptance:** Can open PDF from path, get page count/dimensions, render page as PNG, save modified PDF.
- **BLOCKED_BY:** A2

#### B2: Document Open/Save Endpoints
- **What:** Open file (by path), save, save-as, close session, get session info.
- **Creates:**
  - `apps/api/app/routers/documents.py`
  - `apps/api/tests/test_documents.py`
- **Acceptance:** Open 1MB and 100MB PDFs by path. Save writes back to disk. Close cleans up temp files.
- **BLOCKED_BY:** A4, B1

#### B3: Page Operations Endpoints
- **What:** Rotate, delete, reorder, insert blank, crop. Each creates a new version.
- **Creates:**
  - `apps/api/app/routers/pages.py`
  - `apps/api/tests/test_pages.py`
- **Acceptance:** All 5 page operations work on test PDFs. Version history updates correctly.
- **BLOCKED_BY:** B2

#### B4: Merge Endpoint
- **What:** Merge multiple PDFs by file paths into one session.
- **Creates:**
  - `apps/api/app/routers/merge.py`
  - `apps/api/tests/test_merge.py`
- **Acceptance:** Merge 2-5 PDFs by path. Combined result has correct page count and content.
- **BLOCKED_BY:** B2

#### B5: Thumbnail Generation
- **What:** Render page thumbnails via PyMuPDF, cache in session temp dir.
- **Creates:**
  - `apps/api/app/routers/thumbnails.py`
  - `apps/api/tests/test_thumbnails.py`
- **Acceptance:** `GET /api/pages/{sid}/{page}/thumbnail?width=200` returns PNG.
- **BLOCKED_BY:** B2

#### B6: Export + Annotation Renderer (CRITICAL SPIKE)
- **What:** Convert Fabric.js JSON annotations to PyMuPDF drawing commands. Flatten onto PDF and save.
- **Creates:**
  - `apps/api/app/services/annotation_renderer.py`
  - `apps/api/app/routers/export.py`
  - `apps/api/app/models/annotation.py` (Pydantic: FabricObject, AnnotationSet)
  - `apps/api/tests/test_annotation_renderer.py`
  - `apps/api/tests/test_export.py`
- **Acceptance:** All 8 annotation types render correctly. Exported PDF viewable in Adobe Reader.
- **BLOCKED_BY:** B2
- **NOTE:** Highest-risk task. Start early, spike first.

---

### Track C: Frontend - Viewer & Navigation

> Can start after A1 (needs frontend scaffold).

#### C1: Zustand Stores
- **What:** Set up all state stores and TypeScript types.
- **Creates:**
  - `apps/web/src/stores/documentStore.ts`
  - `apps/web/src/stores/annotationStore.ts`
  - `apps/web/src/stores/uiStore.ts`
  - `apps/web/src/stores/sessionStore.ts`
  - `apps/web/src/types/pdf.ts`
  - `apps/web/src/types/annotation.ts`
  - `apps/web/src/types/api.ts`
- **Acceptance:** Stores initialize with correct defaults. TypeScript types compile.
- **BLOCKED_BY:** A1

#### C2: API Client + Tauri Bridge
- **What:** Typed API client to localhost:8000 with SSE support. Tauri bridge for file dialogs.
- **Creates:**
  - `apps/web/src/services/api.ts`
  - `apps/web/src/services/pdfService.ts` (PDF.js wrapper)
  - `apps/web/src/services/tauriBridge.ts` (file dialog, app data path)
  - `apps/web/src/hooks/useApi.ts`
  - `apps/web/src/hooks/useTauri.ts`
- **Acceptance:** API client can call endpoints. SSE streams parse correctly. Tauri file dialog opens.
- **BLOCKED_BY:** C1

#### C3: Welcome Screen + File Open
- **What:** WelcomeScreen, DropZone, file open via Tauri dialog, loading states.
- **Creates:**
  - `apps/web/src/components/shared/DropZone.tsx`
  - `apps/web/src/components/shared/WelcomeScreen.tsx`
  - `apps/web/src/components/shared/ProgressBar.tsx`
  - `apps/web/src/components/shared/LoadingOverlay.tsx`
  - `apps/web/src/components/shared/Toast.tsx`
- **Acceptance:** Click "Open" → Tauri dialog → select PDF → backend opens file → transition to viewer.
- **BLOCKED_BY:** C2
- **BLOCKED_BY (cross-track):** B2 (needs open endpoint)

#### C4: PDF Viewer + Page Rendering
- **What:** PDF.js integration, page rendering, HiDPI canvas, text layer.
- **Creates:**
  - `apps/web/src/components/viewer/PdfViewer.tsx`
  - `apps/web/src/components/viewer/PageCanvas.tsx`
  - `apps/web/src/components/viewer/TextLayer.tsx`
  - `apps/web/src/components/viewer/ZoomControls.tsx`
  - `apps/web/src/hooks/usePdfDocument.ts`
  - `apps/web/src/hooks/useZoom.ts`
  - `apps/web/src/utils/zoom.ts` (port from v1 pdf-engine.js)
- **Acceptance:** PDF renders, all 17 zoom levels work, fit-to-page/width, HiDPI sharp, text selectable.
- **BLOCKED_BY:** C3

#### C5: Thumbnail Sidebar + Navigation
- **What:** Page thumbnails, click-to-navigate, keyboard nav.
- **Creates:**
  - `apps/web/src/components/sidebar/PageList.tsx`
  - `apps/web/src/components/viewer/ThumbnailSidebar.tsx`
  - `apps/web/src/components/sidebar/OutlinePanel.tsx`
- **Acceptance:** Thumbnails load, click navigates, PgUp/PgDn/Home/End work.
- **BLOCKED_BY:** C4
- **BLOCKED_BY (cross-track):** B5 (needs thumbnail endpoint)

---

### Track D: Frontend - Annotations & Editing

> Can start after C4 (needs the viewer to overlay on).

#### D1: Annotation Canvas + Core Tools
- **What:** Fabric.js canvas overlay per page. Select, draw (freehand), highlight tools.
- **Creates:**
  - `apps/web/src/components/annotations/AnnotationCanvas.tsx`
  - `apps/web/src/components/annotations/Toolbar.tsx`
  - `apps/web/src/components/annotations/tools/DrawTool.tsx`
  - `apps/web/src/components/annotations/tools/HighlightTool.tsx`
  - `apps/web/src/hooks/useAnnotations.ts`
- **Acceptance:** Can draw freehand and highlight on a page. Annotations persist per-page in store.
- **BLOCKED_BY:** C4

#### D2: Text, Shape, Stamp Tools
- **What:** Text annotation, rectangle/ellipse/line/arrow, image stamps.
- **Creates:**
  - `apps/web/src/components/annotations/tools/TextTool.tsx`
  - `apps/web/src/components/annotations/tools/ShapeTool.tsx`
  - `apps/web/src/components/annotations/tools/StampTool.tsx`
  - `apps/web/src/components/annotations/tools/RedactTool.tsx` (visual only)
  - `apps/web/src/components/annotations/PropertyPanel.tsx`
- **Acceptance:** All tools create objects on canvas. Property panel controls color/stroke/opacity/font.
- **BLOCKED_BY:** D1

#### D3: Annotation Undo/Redo + Auto-Save
- **What:** Per-page undo/redo for annotations. IndexedDB auto-save every 60s for crash recovery.
- **Creates:**
  - `apps/web/src/hooks/useUndoRedo.ts`
  - `apps/web/src/hooks/useAutoSave.ts`
  - `apps/web/src/services/indexedDb.ts`
- **Acceptance:** Ctrl+Z/Ctrl+Y works per page. App crash → relaunch → annotations restored.
- **BLOCKED_BY:** D1

#### D4: Page Operations UI + Save
- **What:** Drag-to-reorder in sidebar, rotate/delete buttons, insert blank, merge file picker. Save/Save As.
- **Modifies:**
  - `apps/web/src/components/sidebar/PageList.tsx` (add drag-reorder, context menu)
  - `apps/web/src/components/shared/Modal.tsx`
- **Acceptance:** All page ops trigger correct API calls. Save writes to disk. Viewer updates after operation.
- **BLOCKED_BY:** C5
- **BLOCKED_BY (cross-track):** B3 (page ops), B4 (merge)

#### D5: Export UI
- **What:** Export dialog, sends annotations JSON to backend, Tauri save dialog for output path.
- **Creates:**
  - `apps/web/src/components/export/ExportDialog.tsx`
- **Acceptance:** Export → backend flattens annotations → file saved to chosen path. PDF valid in Adobe Reader.
- **BLOCKED_BY:** D2
- **BLOCKED_BY (cross-track):** B6 (needs export + annotation renderer)

---

### Track E: Frontend - UX Polish (Week 6)

> Independent UI features with no backend dependency. Can start after A1.

#### E1: Dark Mode
- **Creates:** `apps/web/src/hooks/useDarkMode.ts`
- **Modifies:** `apps/web/src/styles/variables.css`, `apps/web/src/App.tsx`
- **BLOCKED_BY:** A1

#### E2: Keyboard Shortcuts
- **Creates:** `apps/web/src/hooks/useKeyboardShortcuts.ts`
- **BLOCKED_BY:** A1

#### E3: Shared UI Components
- **Creates:** `apps/web/src/components/shared/Modal.tsx`
- **Creates:** `apps/web/src/hooks/useOnline.ts`
- **BLOCKED_BY:** A1

---

## Phase 1 Dependency Graph

```
Week 1:
  A1 (frontend scaffold) ──► A3 (Tauri) ──► (Tauri compiles)
  A2 (backend scaffold) ──► A4 (sessions) ──► B2 (open/save)
  A2 ──► B1 (PDF engine) ──► B2
  A1 ──► E1, E2, E3 (UX, independent)

Week 2:
  A1 ──► C1 (stores) ──► C2 (API client)
  B2 ──► B3, B4, B5 (page ops, merge, thumbnails — parallel)
  B2 ──► B6 (export — critical spike, start early)

Week 3:
  C2 + B2 ──► C3 (welcome + file open) ──► C4 (viewer)
  B6 continued

Week 4:
  C4 ──► C5 (sidebar)
  C4 ──► D1 (annotation canvas) ──► D2 (all tools)

Week 5:
  D1 ──► D3 (undo/redo)
  C5 + B3 ──► D4 (page ops UI)
  D2 + B6 ──► D5 (export UI)

Week 6: QA
```

### Maximum Parallelism in Phase 1

| Time | Agent 1 (Infra) | Agent 2 (Backend) | Agent 3 (Frontend-Viewer) | Agent 4 (Frontend-Annotations) | Agent 5 (UX) |
|------|-----------------|-------------------|---------------------------|-------------------------------|---------------|
| W1 | A1, A2 | A4 (after A2) | — | — | — |
| W1-2 | A3 (Tauri), A5 | B1 → B2 | C1 → C2 | — | E1, E2, E3 |
| W2-3 | — | B3, B4, B5 (parallel) | C3 → C4 | — | — |
| W3-4 | — | B6 (critical spike) | C5 | D1 → D2 | — |
| W5 | — | B6 (continued) | — | D3, D4 (parallel) | — |
| W6 | QA | QA | QA | D5, QA | QA |

**Peak parallelism: 5 agents in Week 2-3**
**Minimum agents needed: 3** (merge Infra into Backend, merge UX into Annotations)

---

## Phase 2: Core Upgrades (Weeks 7-12)

### Track F: Forensic Redaction

#### F1: Redaction Engine
- **Creates:** `apps/api/app/services/redaction_engine.py`, `apps/api/app/routers/redaction.py`, `apps/api/app/models/redaction.py`, `apps/api/tests/test_redaction.py`
- **BLOCKED_BY:** B2

#### F2: Redaction Pattern Library
- **Modifies:** `apps/api/app/services/redaction_engine.py`
- **BLOCKED_BY:** F1

#### F3: Redaction UI
- **Creates:** `apps/web/src/components/redaction/RedactionPanel.tsx`, `apps/web/src/components/redaction/RedactionReview.tsx`
- **BLOCKED_BY:** F1, D2

### Track G: OCR (SSE Streaming)

#### G1: OCR Engine
- **Creates:** `apps/api/app/services/ocr_engine.py`, `apps/api/app/routers/ocr.py`, `apps/api/app/utils/streaming.py`, `apps/api/tests/test_ocr.py`
- **BLOCKED_BY:** B2

#### G2: OCR Frontend (SSE)
- **Creates:** `apps/web/src/components/ocr/OcrPanel.tsx`, `apps/web/src/components/ocr/CorrectionMode.tsx`
- **BLOCKED_BY:** G1, C4

### Track H: Text & Search

#### H1: Text Extraction + Search Backend
- **Creates:** `apps/api/app/routers/text.py`, `apps/api/tests/test_text.py`
- **BLOCKED_BY:** B2

#### H2: Text Editing Backend
- **Modifies:** `apps/api/app/routers/text.py`
- **BLOCKED_BY:** H1

#### H3: Find Bar + Text Edit UI
- **Creates:** `apps/web/src/components/find/FindBar.tsx`, `apps/web/src/components/find/SearchHighlights.tsx`, `apps/web/src/components/text-edit/TextEditMode.tsx`, `apps/web/src/components/text-edit/TextEditToolbar.tsx`, `apps/web/src/components/text-edit/ColorSampler.tsx`, `apps/web/src/utils/colorSampler.ts`
- **BLOCKED_BY:** H1, C4

### Track I: Split PDF

#### I1: Split Backend + Frontend
- **Creates:** `apps/api/app/routers/split.py`, `apps/api/tests/test_split.py`, `apps/web/src/components/split/SplitDialog.tsx`
- **BLOCKED_BY:** B2, C4

### Phase 2 Parallelism

| Time | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|------|---------|---------|---------|---------|
| W7 | F1 (redaction engine) | G1 (OCR engine + SSE) | H1 (text extraction) | I1 (split) |
| W8 | F2 (patterns) | G2 (OCR frontend) | H2 (text editing) | — |
| W9 | F3 (redaction UI) | — | H3 (find + text UI) | — |
| W10-12 | QA | QA | QA | — |

---

## Phase 3: Legal Features (Weeks 13-16)

### Track J: Bates + Headers + Exhibits (Backend)

#### J1: Bates Numbering
- **Creates:** `apps/api/app/routers/bates.py`, `apps/api/tests/test_bates.py`
#### J2: Headers/Footers
- **Creates:** `apps/api/app/routers/headers.py`, `apps/api/tests/test_headers.py`
#### J3: Exhibit Stamps + Page Labels
- **Creates:** `apps/api/app/routers/exhibits.py`, `apps/api/tests/test_exhibits.py`
- **All BLOCKED_BY:** B2

### Track K: Bates + Headers + Exhibits (Frontend)

#### K1: Bates Dialog
- **Creates:** `apps/web/src/components/bates/BatesDialog.tsx`
#### K2: Headers/Footers Dialog
- **Creates:** `apps/web/src/components/headers/HeaderFooterDialog.tsx`
#### K3: Exhibit Stamp Dialog + Page Label Editor
- **Creates:** `apps/web/src/components/exhibits/ExhibitStampDialog.tsx`, `apps/web/src/components/pages/PageLabelEditor.tsx`
- **All BLOCKED_BY:** C4

### Track L: Signatures + Forms

#### L1: Signature Backend
- **Modifies:** `apps/api/app/services/annotation_renderer.py`
- **BLOCKED_BY:** B6
#### L2: Signature Frontend
- **Creates:** `apps/web/src/components/signatures/SignatureModal.tsx`, `apps/web/src/components/signatures/SignatureStamp.tsx`
- **BLOCKED_BY:** D1
#### L3: Forms Backend
- **Creates:** `apps/api/app/routers/forms.py`, `apps/api/tests/test_forms.py`
- **BLOCKED_BY:** B2
#### L4: Forms Frontend
- **Creates:** `apps/web/src/components/forms/FormOverlay.tsx`, `apps/web/src/components/forms/FormFieldEditor.tsx`, `apps/web/src/components/forms/FormDataPanel.tsx`
- **BLOCKED_BY:** C4, L3

### Phase 3 Parallelism: 3 agents

| Time | Agent 1 | Agent 2 | Agent 3 |
|------|---------|---------|---------|
| W13 | J1, J2 | K1, K2 | L1, L2 |
| W14 | J3 | K3 | L3 |
| W15-16 | L4 | QA | QA |

---

## Phase 4: Polish & Parity (Weeks 17-20)

### Track M: Document Comparison
- M1: Backend → M2: Frontend
- **BLOCKED_BY:** B2, C4

### Track N: Security + Encryption
- N1: Backend → N2: Frontend
- **BLOCKED_BY:** B2, C4

### Track O: Accessibility + Onboarding
- O1: A11y components, O2: Onboarding + recent files
- **BLOCKED_BY:** A1, C4

### Track P: Installer + Auto-Update + Image Export
- P1: PyInstaller spec + Tauri bundler config + auto-updater
- P2: Annotation report export
- P3: Image export backend
- **BLOCKED_BY:** A3, B6

### Phase 4 Parallelism: 4 agents

---

## Summary

| Track | Tasks | Phase | Can Start After |
|-------|-------|-------|-----------------|
| A: Infrastructure | 5 | 1 | Immediately |
| B: PDF Backend | 6 | 1 | A2 |
| C: Viewer | 5 | 1 | A1 |
| D: Annotations | 5 | 1 | C4 |
| E: UX Polish | 3 | 1 | A1 |
| F: Redaction | 3 | 2 | B2 |
| G: OCR | 2 | 2 | B2 |
| H: Text/Search | 3 | 2 | B2 |
| I: Split | 1 | 2 | B2 |
| J: Legal Backend | 3 | 3 | B2 |
| K: Legal Frontend | 3 | 3 | C4 |
| L: Signatures+Forms | 4 | 3 | B6, D1 |
| M: Comparison | 2 | 4 | B2 |
| N: Security | 2 | 4 | B2 |
| O: A11y+Onboarding | 2 | 4 | A1 |
| P: Installer+Export | 3 | 4 | A3, B6 |

**Total: 52 tasks across 16 tracks**

---

## Coordinator Quick Reference

### Phase 1 startup (5 agents max):

```
Agent 1 → A1 (frontend scaffold)
Agent 2 → A2 (backend scaffold)
--- after A1 ---
Agent 1 → A3 (Tauri shell)
Agent 5 → E1 + E2 + E3 (UX, no deps)
Agent 3 → C1 → C2 (stores → API client)
--- after A2 ---
Agent 2 → A4 (session manager)
--- after A2 ---
Agent 4 → B1 (PDF engine)
--- after A4 + B1 ---
Agent 2 → B2 (open/save endpoints)
--- after B2 ---
Agent 1 → B3 + B4 + B5 (parallel page ops)
Agent 2 → B6 (critical: export + annotation renderer)
--- after B2 + C2 ---
Agent 3 → C3 → C4 (file open → viewer)
--- after C4 ---
Agent 4 → D1 → D2 (annotation tools)
Agent 3 → C5 (sidebar)
--- after D2 ---
Agent 4 → D3 + D4 (undo + page ops UI)
Agent 5 → D5 (export UI, after B6)
```

### Phase 2 startup (4 agents):

```
Agent 1 → F1 → F2 → F3 (redaction full stack)
Agent 2 → G1 → G2 (OCR full stack with SSE)
Agent 3 → H1 → H2 → H3 (text/search full stack)
Agent 4 → I1 (split)
```
