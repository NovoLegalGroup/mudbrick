# Mudbrick PDF Editor — Architecture Audit Report

**Date**: 2026-03-13
**Version**: v4.6
**Auditor Role**: Senior Software Architect & Product Systems Auditor (PDF Editor Specialist)

---

## 1. Overall Assessment

Mudbrick is a **remarkably mature client-side PDF editor** built as a vanilla JS PWA. It's a single-file-at-a-time editor (not a document management system), and for that model, the architecture is sound. The file-handling semantics are correct for its scope: there is no destructive file-replacement bug in the current implementation. The system properly distinguishes between source bytes, working copies, and exported output.

**Health**: Strong foundation with targeted issues. Production-usable for its intended scope.

---

## 2. Progress / Maturity Estimate

**Strong foundation with targeted issues** — approaching production maturity.

Evidence:
- 34 ES modules with clear separation of concerns
- 29 test files covering core modules
- 3-tier undo system (annotations per-page, document-level byte snapshots, image edits)
- IndexedDB crash recovery with 60-second auto-save
- Service worker with versioned cache for offline use
- Coordinate transform handling across all export paths
- Memory pressure awareness with adaptive page cleanup
- ~6,300+ lines of app.js orchestration

This is not a prototype. It is a working product with depth in the areas that matter (export fidelity, state management, error recovery).

---

## 3. Tech Stack

| Component | Technology | Source |
|-----------|-----------|--------|
| Framework | Vanilla JS (ES modules) | Local |
| PDF reading/rendering | PDF.js 4.8.69 | CDN (jsdelivr) |
| PDF mutation/forms | pdf-lib 1.17.1 | CDN (jsdelivr) |
| Annotation canvas | Fabric.js 5.3.0 | CDN (jsdelivr) |
| OCR | Tesseract.js 5.x (lazy-loaded) | CDN (jsdelivr) |
| Testing | Vitest | npm |
| Linting | ESLint | npm |
| Hosting | Vercel | Cloud |
| CI | GitHub Actions (lint + test:coverage) | GitHub |
| Offline | Service Worker + Cache API | Local |
| Crash recovery | IndexedDB | Browser |

No build step. No bundler. Vanilla files served directly.

---

## 4. Project Structure

```
/js/             — 34 ES modules (core logic)
/styles/         — 4 CSS files (~4,700 lines)
/icons/          — SVG assets
/tests/          — 29 Vitest test files
index.html       — Single-page app shell
sw.js            — Service Worker (stale-while-revalidate)
manifest.json    — PWA manifest (file handler, share target)
vercel.json      — Hosting config (security headers, caching)
.github/         — CI workflow
```

### Key Files by Responsibility

| Responsibility | Primary Files |
|---|---|
| App shell & state | app.js (6,300+ lines) |
| PDF rendering | pdf-engine.js |
| Page mutations | pdf-edit.js |
| Annotation canvas | annotations.js (1,300+ lines) |
| Export/baking | export.js (600+ lines) |
| Form handling | forms.js, form-creator.js |
| Text editing | text-edit.js (2,100+ lines) |
| OCR | ocr.js |
| Search | find.js |
| Error & recovery | error-handler.js |
| Undo/Redo (annotations) | history.js |
| Undo/Redo (document) | doc-history.js |
| Links & navigation | links.js |
| Comments & threads | comments.js, comment-summary.js |
| Watermarks, stamps | exhibit-stamps.js, bates.js, headers.js |
| Security | security.js |
| Image export | export-image.js |
| Service Worker | sw.js |
| Utilities | utils.js, icons.js, keyboard-shortcuts.js, a11y.js |

---

## 5. Document Model & State

### State Structure (app.js)

```javascript
State = {
  pdfDoc,            // PDF.js PDFDocumentProxy (read-only rendering)
  pdfBytes,          // Uint8Array (mutable source for pdf-lib)
  pdfLibDoc,         // pdf-lib PDFDocument (for mutations)
  fileName,          // String
  fileSize,          // Number (bytes)
  currentPage,       // Integer (1-based)
  totalPages,        // Integer
  zoom,              // Float (1.0 = 100%)
  pageAnnotations,   // { pageNum: fabricJSON } — per-page Fabric.js state
  formFields,        // Detected AcroForm field descriptors
  activeTool,        // 'select', 'text', 'draw', etc.
}
```

### State Layers

| Layer | Scope | Mechanism |
|-------|-------|-----------|
| Global | `State` object | Direct property mutations |
| Page Annotations | `State.pageAnnotations[pageNum]` | Fabric.js toJSON/fromJSON |
| Form Values | `formFieldValues` (forms.js) | Object keyed by field name |
| Find Matches | `matches` array (find.js) | Match objects with page/offset/rects |
| OCR Results | `ocrResults` (ocr.js) | Map of pageNum to {words, lines, fullText} |
| Undo/Redo (annotations) | `pageHistory[pageNum]` (history.js) | Per-page snapshot stacks (max 30) |
| Undo/Redo (document) | `undoStack`, `redoStack` (doc-history.js) | Byte snapshots (max 10, 300 MB budget) |

### Storage Model

```
Browser
├─ IndexedDB: mudbrick-recovery
│  └─ session store
│     └─ 'current': { pdfBytes, pageAnnotations, fileName, hasChanges }
│
├─ LocalStorage
│  ├─ mudbrick-recent-files: JSON array of { name, size, pageCount, openedAt }
│  └─ mudbrick-dark: 'true' | 'false'
│
├─ Service Worker Cache (mudbrick-v4.6)
│  ├─ App shell (HTML/CSS/JS) — stale-while-revalidate
│  ├─ CDN assets (pdf-lib, Fabric, Tesseract) — cache-first
│  └─ Offline fallback
│
└─ Memory
   └─ State: pdfDoc, pdfBytes, pageAnnotations, etc.
```

---

## 6. Structural Strengths

### Document Lifecycle Is Correctly Modeled

- Source bytes (`State.pdfBytes`) are kept as immutable Uint8Array
- Every mutation creates new bytes via pdf-lib `.save()`, then calls `reloadAfterEdit()` — never modifies in place
- Export loads a **fresh copy** of the PDF (`PDFDocument.load(pdfBytes)`) rather than mutating the working copy — source is preserved

### Append vs Replace Is Explicit and Correct

- `appendPages()` (pdf-edit.js:139) inserts donor pages at a specific index — additive, never destructive
- `replacePages()` (pdf-edit.js:169) is a separate, explicit function with clear page-mapping semantics
- `mergePDFs()` creates a brand new document from a file list — original files untouched
- The "Add Pages" UI flow (app.js:3070-3101) uses `appendPages`, not `mergePDFs` — correctly appends to the current document

### Export Is Non-Destructive to the Working Document

- export.js:62 loads a fresh `PDFDocument` from `pdfBytes` — the working state is untouched
- Export output is saved with `_edited.pdf` suffix — never overwrites the source filename
- Recovery data is cleared only on successful export

### Undo Is Well-Layered

- Per-page annotation undo (snapshot-based, max 30 states)
- Document-level byte undo (max 10 states, 300 MB budget with eviction)
- Image edit undo (separate stack)
- Unified undo button checks all three in priority order: Image > Doc > Annotation

### Recovery Is Real

- Auto-save to IndexedDB every 60 seconds with `pdfBytes`, `pageAnnotations`, and `fileName`
- Recovery banner on restart if crash data exists
- Clear on successful export

### Security Headers Are Solid

- COEP/COOP enabled (required for SharedArrayBuffer / PDF.js optimization)
- CSP restricts scripts to self + jsdelivr CDN
- X-Frame-Options DENY, nosniff, strict referrer policy
- `index.html` is `no-cache`; JS/CSS/icons are `immutable` with 1-year max-age

### Test Coverage Exists

29 test files covering: annotations, bates, comments, doc-compare, doc-history, error-handler, exhibit-stamps, export, export-image, find, form-creator, forms, headers, history, icons, keyboard-shortcuts, menu-actions, ocr, onboarding, page-labels, pdf-edit, pdf-engine, recent-files, redact-patterns, security, text-edit, utils, a11y.

---

## 7. Workflow Risks

### 7a. Annotation Page-Number Shift on Page Mutations (Accepted Risk)

When `reloadAfterEdit()` runs, it does NOT remap `State.pageAnnotations` keys. Annotations are keyed by page number, and page numbers shift when pages are deleted, inserted, or reordered.

**Example**: Annotate page 3. Delete page 1. Page 3 becomes page 2. `pageAnnotations[3]` now renders on the wrong page.

**Decision**: Accepted risk. Annotations primarily matter during an editing session, and the undo system provides recovery. Remapping would add complexity for a scenario that rarely occurs in practice.

### 7b. Merge Creates a New Document, Discarding Current State (Accepted)

`executeMerge()` (app.js:1921-1936) calls `openPDF()` — not `reloadAfterEdit()`. This clears all annotations, undo history, OCR results, and form values. This is technically correct (merge creates a fundamentally new document) but users may not expect it.

**Recommendation**: Consider adding a confirmation dialog warning that annotations will be lost.

### 7c. Redactions Are Visual Only (Accepted)

export.js:58 warns in console: "Visual content is covered but underlying PDF objects are not removed." This is intentional — forensic redaction is not a requirement.

### 7d. Single-File Model (Permanent by Design)

The system can only have one document open at a time. Opening a new file destroys the current session entirely. This is the correct architecture for a PDF editor (matches Acrobat, PDF Expert, Foxit behavior). Users can open multiple browser tabs for multi-document workflows.

---

## 8. Architecture Issues

### 8a. app.js Is a 6,300+ Line God Module

All state, UI wiring, modal logic, and event handlers live in one file. This works for a single developer but makes testing orchestration flows difficult and increases risk of side effects when adding features.

### 8b. Global Mutable Singleton State

`State` is a plain object with direct property mutations. No events, no subscriptions, no guards. Any module can mutate it indirectly through `reloadAfterEdit`.

### 8c. pdfLibDoc Singleton in pdf-edit.js

`let pdfLibDoc = null` is a module-level mutable singleton. Functions like `rotatePage`, `reorderPages`, and `appendPages` mutate this singleton. If two operations run concurrently (fast user clicks), the singleton could be inconsistent.

### 8d. No Operation Locking

There is no mutex or "operation in progress" flag. If a user clicks "Add Pages" and immediately clicks "Rotate" while the append is still loading, both operations could race through `reloadAfterEdit`. The `pushDocState` call in one could capture a mid-mutation state.

---

## 9. Memory Analysis for 100 MB Files

Standard workload is ~100 MB files. The undo budget math:

| What | Memory |
|------|--------|
| Current doc (`State.pdfBytes`) | 100 MB |
| 1 undo snapshot | 100 MB |
| 2 undo snapshots | 200 MB |
| 3 undo snapshots | **300 MB — budget hit, starts evicting** |

With `MAX_DOC_HISTORY = 10` and `MAX_MEMORY_BYTES = 300 MB` (doc-history.js:17-18), users get **at most 2-3 levels of document undo** before eviction begins. Total working memory for a 100 MB file with undo is ~400 MB. Chrome tabs typically allow 1-4 GB.

**This is functional but tight.** Risks increase when combined with OCR results, annotation data, and form state.

---

## 10. Deployment & Release Process

| Component | Status |
|-----------|--------|
| CI pipeline | GitHub Actions: lint + test:coverage on push/PR to main |
| Hosting | Vercel (static, no build step) |
| Cache versioning | Manual bump of `CACHE_VERSION` in sw.js |
| Security headers | COEP, COOP, CSP, X-Frame-Options, nosniff |
| Cache strategy | index.html no-cache; JS/CSS/icons immutable 1-year |
| Automation | Joynt Foundry agent-driven development from GitHub issues |

**Gap**: The `immutable` cache header on `/js/*` assumes filenames change between versions, but since there is no build step or content hashing, filenames are static. The service worker compensates (stale-while-revalidate), but there is a window where users could have stale JS until the SW updates. Not a blocker — just a known behavior.

---

## 11. PDF-System-Specific Findings

### Source Files: CORRECT
Source bytes preserved in `State.pdfBytes`. Every mutation produces new bytes. Export loads a fresh copy. The original user file is never modified.

### Compiled Output: CORRECT
Export creates `_edited.pdf` — a distinct artifact. Working document not modified by export. Recovery data cleared only on success.

### Multi-File Collections: NOT MODELED (by design)
Single-document editor. Multi-file operations bring content into one document. Individual file identity is lost after merge. This is standard behavior (Acrobat works the same way).

### Append vs Replace Semantics: CORRECT
- `appendPages()` is additive — inserts without removing
- `replacePages()` is explicit and separate
- `mergePDFs()` creates a new doc — non-destructive to sources
- UI "Add Pages" button calls `appendPages` — not replace

### Page Ordering: CORRECT
`reorderPages()` correctly rebuilds the document with proper page copying.

### Coordinate Transforms: CORRECT
PDF (bottom-left, Y-up) to screen (top-left, Y-down) transforms handled consistently in export.js, links.js, and forms.js. Canvas dimensions stored with annotations (`_canvasWidth`, `_canvasHeight`) for accurate scaling at export time.

---

## 12. Recommendations

### Priority: Do Now

**1. Tune undo budget for 100 MB files**
- Reduce `MAX_DOC_HISTORY` from 10 to 5 (unreachable at 100 MB anyway)
- Consider compressing undo snapshots with `CompressionStream('gzip')` — PDFs compress 50-70%
- Monitor `performance.memory` and warn when undo is evicting

**2. Add operation locking**
- Set `State.operationInProgress = true` during `reloadAfterEdit()`
- Disable toolbar buttons during mutations
- Prevents race conditions from fast clicks on large files

### Priority: Do Soon

**3. Merge confirmation dialog**
- Before `executeMerge()`, warn: "Merging will create a new document. Annotations, OCR results, and undo history will be lost."
- Give user a chance to export first

### Priority: Do Eventually

**4. Break up app.js**
- Extract modal logic into separate modules
- Extract state management into a state module
- Extract event wiring into an init module
- Maintainability improvement, not functional

**5. Add integration tests for mutation flows**
- Test suite covers individual modules well (29 test files)
- Missing: full flow tests (open > annotate > delete page > verify state)

### Priority: Skip

| Item | Reason |
|------|--------|
| Annotation remapping on page mutations | Low impact for actual workflow |
| Forensic redaction | Not required |
| Multi-document model | Single-file is correct and permanent |
| Framework migration | Vanilla JS is working and performant |

---

## 13. Conclusion

Mudbrick is a well-architected PDF editor that gets the hard things right: non-destructive editing, correct append/replace semantics, proper export isolation, and real crash recovery. The primary concern is memory management for the 100 MB file workload — the undo budget needs tuning, and operation locking should be added to prevent race conditions. The codebase is maintainable despite the app.js monolith, and the test coverage provides a safety net for changes.

The system does not have destructive file-replacement bugs. Source files are never overwritten. Export produces distinct output. The single-file model is the correct architecture for this product.
