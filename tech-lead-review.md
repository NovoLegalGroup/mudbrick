# Tech Lead Review -- Mudbrick v2 Architecture

> Reviewer: Tech Lead (Stage 2)
> Date: 2026-03-19
> Input: architecture-blueprint.md (System Designer, Stage 1)
> Status: APPROVED WITH MODIFICATIONS
> Addendum (2026-03-19): This review is preserved as the intermediate decision record that rejected Vercel serverless. The current delivery plan is a Windows desktop app built with Tauri 2.x + React 19 + a local Python FastAPI sidecar.
> Superseding desktop additions: `src-tauri/` shell + window management, PyInstaller sidecar bundling, Tauri open/save/save-as dialogs, OCR SSE progress streaming, `%APPDATA%/mudbrick/sessions/` local session storage with in-memory active state, GitHub Actions release pipeline for `.msi`/`.exe`, and Tauri auto-updater via GitHub Releases.
> Read references below to Vercel, Fly.io, Railway, Blob, KV, or network-dependent offline fallbacks as superseded by [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

---

## 1. Overall Verdict: APPROVED with modifications

The hybrid architecture (Python FastAPI backend + React frontend) is the correct approach. The system designer's reasoning is sound on all three key decisions:

1. **Greenfield over gradual migration** -- AGREE. The 6,566-line god-module (app.js) with no component model, no state management, and no API layer makes incremental migration impractical. The cost of maintaining two architectures during a gradual migration would exceed the cost of a clean rewrite.

2. **Hybrid over Python full-stack** -- AGREE. HTMX cannot drive a Fabric.js canvas or PDF.js renderer. The interactive annotation, zoom, and text editing features are fundamentally browser-side. This is not debatable.

3. **Python backend over keeping everything client-side** -- AGREE. The upgrade from visual-only redaction to forensic redaction alone justifies this. PyMuPDF's ability to strip PDF objects is a genuine capability gap that pdf-lib cannot fill. The 100MB file handling also benefits from server-side processing with Blob Storage.

---

## 2. Modifications Required

### 2.1 CRITICAL: Vercel Serverless is Wrong for This Workload

**Problem:** The architecture assumes Vercel serverless functions can process 100MB PDFs. This is fragile:
- Serverless functions have ephemeral /tmp (512MB Pro) but cold starts mean downloading 100MB from Blob Storage on every invocation
- Every page operation (rotate, delete) requires: download 100MB from Blob → write to /tmp → open with PyMuPDF → modify → save → upload 100MB back to Blob. That is 200MB of I/O per operation.
- OCR on a 100-page, 100MB document at 300 DPI will generate ~30GB of pixel data. This cannot complete within 300s.
- PyMuPDF + pikepdf + Pillow + FastAPI + pytesseract will likely exceed 50MB deploy limit when you include transitive dependencies and shared libraries.

**Decision:** Use a **two-tier deployment**:

| Tier | Technology | Purpose |
|---|---|---|
| Tier 1: Vercel Static + Edge | Vite/React build, edge functions | Frontend serving, lightweight API proxy, auth |
| Tier 2: Fly.io or Railway persistent server | FastAPI on a long-running container | Heavy PDF processing, file storage in /data volume |

**Why Fly.io/Railway instead of pure Vercel serverless:**
- Persistent filesystem -- no download/upload cycle per operation
- Container-based -- no 50MB deploy limit (use Docker, install Tesseract via apt)
- Long-running processes -- no 300s timeout ceiling
- Warm instances -- no cold start latency
- Cost-effective at small scale: Fly.io starts at $0/month (free tier), Railway at $5/month
- Still deployable from the same monorepo, still accessible via HTTPS

**Alternative considered:** Vercel Pro with Docker-based functions (250MB limit, 900s timeout on Enterprise). This could work but is more expensive and still has the ephemeral /tmp problem for 100MB files. A $5/month Railway container with a persistent volume is simpler and more reliable for this workload.

**Impact on architecture:** The API endpoints stay the same. The frontend just points to a different origin for API calls. The Blob Storage strategy changes: files stored on the persistent volume instead of Vercel Blob, eliminating the download/upload cycle.

### 2.2 IMPORTANT: Simplify Session Storage

**Problem:** The architecture proposes Vercel KV (Redis) for session state and Vercel Blob for PDF storage. With a persistent server, this complexity is unnecessary.

**Decision:** Use local filesystem on the persistent server:
- `/data/sessions/{session_id}/` -- directory per session
- `/data/sessions/{session_id}/current.pdf` -- current PDF state
- `/data/sessions/{session_id}/versions/v1.pdf`, `v2.pdf`, ... -- undo history
- `/data/sessions/{session_id}/metadata.json` -- session metadata
- Cron job: clean up sessions older than 24h

This eliminates Vercel Blob and Vercel KV as dependencies. The architecture goes from 4 infrastructure pieces (Vercel CDN + Vercel Functions + Vercel Blob + Vercel KV) to 2 (Vercel CDN + Fly.io/Railway server).

### 2.3 IMPORTANT: Keep pdf-lib on Frontend as Fallback

**Problem:** Moving all PDF operations to the server kills offline capability for operations that currently work offline (rotate, delete, basic export).

**Decision:** Maintain a thin pdf-lib layer on the frontend for:
- Basic page operations (rotate, delete, reorder) when offline
- Basic export (flatten annotations without server features)
- Form filling (already client-side via pdf-lib)

The server is the **primary** path for all operations (better results, forensic redaction, etc.), but the frontend can fall back to pdf-lib when offline. This preserves the existing user experience for the operations that matter most day-to-day.

### 2.4 MODERATE: OCR Strategy Simplification

**Problem:** The architecture is uncertain about Tesseract availability on Vercel. With a container-based backend, this is solved.

**Decision:** Use **pytesseract + Tesseract 5** installed via `apt-get install tesseract-ocr` in the Dockerfile. This is the standard approach for containerized Python apps. No need for easyocr or external APIs.

Additionally, keep **Tesseract.js on the frontend as a fallback** for offline OCR or when the server is slow. This is already implemented and working -- no reason to remove it.

### 2.5 MODERATE: React is Overkill -- Consider Alternatives

**Concern:** The current app is 21K LOC of vanilla JS with no build step. Moving to React + Vite + TypeScript + Zustand + Tailwind adds significant complexity for a team that has been shipping vanilla JS effectively.

**Options evaluated:**

| Option | Pros | Cons |
|---|---|---|
| React 19 + Zustand | Strong ecosystem, component model, TypeScript | Heavy framework, build complexity, learning curve |
| Preact + signals | Smaller bundle, React-compatible, signals simpler than Zustand | Smaller ecosystem |
| Svelte 5 | Minimal boilerplate, excellent performance, runes are intuitive | Smaller ecosystem, Fabric.js integration less documented |
| Vanilla JS + Web Components | No framework overhead, closest to current code | No component model, same maintainability problems |

**Decision:** Proceed with **React 19 + Zustand** as proposed. The reasoning:
- Fabric.js and PDF.js both have well-documented React integration patterns
- TypeScript provides the safety net needed for a rewrite of this size
- Zustand is minimal enough to not add significant complexity
- The team needs a component model to avoid recreating the god-module problem

However, **defer Tailwind CSS**. Use CSS Modules or the existing CSS variable system. The current CSS is well-structured (variables.css, layout.css, components.css) and can be migrated directly. Adding Tailwind is a style preference, not a requirement, and adds unnecessary churn.

### 2.6 MINOR: Turborepo is Unnecessary

**Problem:** Turborepo adds build orchestration complexity for a two-app monorepo. With only `apps/web` and `apps/api`, a simple npm workspaces or pnpm workspaces setup is sufficient.

**Decision:** Use **pnpm workspaces** instead of Turborepo. The Python backend doesn't participate in the JS build system anyway. Keep it simple.

---

## 3. Risk Assessment (Revised)

| Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| 100MB file processing reliability | HIGH | Persistent server with local /data volume eliminates Blob I/O cycle | DevOps |
| Fabric.js JSON → PyMuPDF annotation embedding | HIGH | Build and test this mapping first (Phase 1 spike). If it fails, keep annotation flattening client-side via pdf-lib | Dev |
| Deploy size / Tesseract binary | RESOLVED | Container-based deployment, install via apt | DevOps |
| Cold start latency | RESOLVED | Persistent server, always warm | DevOps |
| Vercel timeout limits | RESOLVED | No serverless timeout ceiling on persistent server | DevOps |
| Offline degradation | MEDIUM | pdf-lib fallback on frontend for core operations | Dev |
| Rewrite scope creep | HIGH | Strict phasing (see Phase Plan below). Phase 1 must be usable before Phase 2 starts | Tech Lead |
| Cost control | LOW | Fly.io/Railway $5-15/month. Vercel free/Pro for static hosting | DevOps |

---

## 4. Scope Decisions

### What to Build First (Phase 1 MVP -- Weeks 1-6)

The MVP must be **usable for Novo Legal's core workflow**: open a PDF, annotate it, export it. Everything else is Phase 2+.

**Phase 1 features (MUST):**
1. PDF viewing (PDF.js, zoom, navigation, thumbnails)
2. Annotations (Fabric.js: draw, highlight, text, shapes, stamps, cover/redact)
3. Export (flatten annotations into PDF)
4. File upload to server + session management
5. Page operations (rotate, delete, reorder)
6. Merge PDFs
7. Dark mode (CSS variables, trivial)
8. Keyboard shortcuts
9. Drag-and-drop file loading
10. Welcome screen / file picker

**Phase 1 features (SHOULD):**
11. Crash recovery (IndexedDB auto-save for annotations)
12. Annotation undo/redo (client-side Fabric.js history)
13. Document undo/redo (server-side version history)

### Phase 2 (Weeks 7-12)
14. Forensic redaction (the key upgrade)
15. Redaction pattern search (SSN, email, phone, etc.)
16. OCR (server-side pytesseract)
17. OCR correction mode
18. Find/search (native text + OCR text)
19. Text editing (cover-and-replace)
20. Split PDF

### Phase 3 (Weeks 13-16)
21. Bates numbering
22. Headers/footers
23. Exhibit stamps
24. Page labels
25. Digital signatures
26. Form field detection and filling
27. Form creation/editing

### Phase 4 (Weeks 17-20)
28. Document comparison
29. Comment/annotation summary report
30. Encryption/metadata/sanitization
31. PWA offline support (service worker)
32. Accessibility (WCAG 2.1 AA)
33. Onboarding tooltips
34. Recent files tracking
35. Export to images
36. Filevine integration (if scoped)

### Deferred (Post-launch)
- Image editing within PDFs (complex, 1,642 LOC, low priority)
- Form data import/export (JSON, XFDF, CSV)
- Comment threads and replies
- Link detection and navigation

---

## 5. Acceptance Criteria

### Phase 1 MVP (Gate to proceed to Phase 2)

| Criterion | Measurement |
|---|---|
| Can open PDFs up to 100MB | Upload completes within 60s on broadband, page renders within 2s |
| All 8 annotation tools work | Draw, highlight, text, shapes, stamps, cover, select, eraser |
| Export produces valid PDF | Annotations visible in Adobe Reader, original content preserved |
| Page operations work on 100MB files | Rotate/delete/reorder completes within 5s |
| Merge works | Combine 2+ PDFs, result is correct, handles 100MB+ inputs |
| Dark mode works | Full UI renders correctly in both themes |
| Keyboard shortcuts match v1 | All existing shortcuts from keyboard-shortcuts.js work |
| No data loss | Crash recovery restores annotations after browser crash |
| Performance | Page navigation (next/prev) under 500ms, zoom under 200ms |
| Deployment | Working on Vercel (frontend) + Fly.io/Railway (backend) |

### Full Feature Parity (Gate to sunset v1)

| Criterion | Measurement |
|---|---|
| All 26 features from v1 functional | Feature-by-feature checklist, QA sign-off |
| Forensic redaction works | Redacted content cannot be recovered from PDF (verified with PDF forensic tools) |
| OCR accuracy >= v1 | Same test documents, compare word accuracy rates |
| Offline mode works for core features | Annotations, viewing, basic export work without network |
| Accessibility audit passes | WCAG 2.1 AA, axe-core automated scan, manual keyboard navigation test |
| Performance >= v1 | All operations same speed or faster than current vanilla JS app |

---

## 6. Answers to Open Questions

### Q1: Vercel plan level
**Answer:** Assume Vercel Pro ($20/mo) for frontend hosting. The backend runs on Fly.io/Railway, so Vercel's serverless limits are irrelevant for PDF processing.

### Q2: Tesseract availability
**Answer:** Resolved. Container-based backend installs Tesseract via apt-get. No Vercel Python runtime constraint.

### Q3: Session storage costs
**Answer:** Eliminated. Local filesystem on persistent server. Cost is the server itself ($5-15/month for a small VM).

### Q4: Offline priority
**Answer:** Medium priority. Novo Legal works in an office environment with reliable internet. Offline annotation viewing/editing is important (they open files at their desk, annotate, then export). Offline PDF processing (merge, OCR, Bates) is nice-to-have, not critical. The pdf-lib fallback covers the 80% case.

### Q5: Timeline expectations
**Answer:** 20 weeks (5 months) for full feature parity across 4 phases. Phase 1 MVP in 6 weeks is the critical milestone. This is realistic for 1-2 developers working full-time.

### Q6: Filevine integration
**Answer:** Defer to Phase 4 or post-launch. The existing MCP server connection to Filevine could enable a "pull document from case" and "push edited PDF back to case" workflow. Scope this separately.

---

## 7. Architecture Decision Record

### ADR-001: Deployment Architecture

**Context:** The system designer proposed pure Vercel deployment (static frontend + Python serverless functions + Vercel Blob + Vercel KV). Analysis reveals this is fragile for 100MB file processing due to ephemeral /tmp, download/upload cycles per operation, 50MB deploy limit, and 300s timeout ceiling.

**Decision:** Two-tier deployment:
- Vercel: static frontend (React/Vite), edge routing
- Fly.io or Railway: persistent Python FastAPI server with local /data volume

**Consequences:**
- (+) Eliminates all Vercel serverless limitations for PDF processing
- (+) Simplifies infrastructure: 2 pieces instead of 4
- (+) Reduces cost: eliminates Vercel Blob and KV charges
- (+) Enables Tesseract installation via apt-get
- (-) Adds a second deployment target (manageable with CI/CD)
- (-) Server costs (~$5-15/month) vs. Vercel serverless (pay-per-invocation)

### ADR-002: Frontend Framework

**Context:** Multiple options evaluated (React, Preact, Svelte, vanilla JS).

**Decision:** React 19 + Zustand + CSS Modules (not Tailwind). TypeScript throughout.

**Consequences:**
- (+) Strong Fabric.js and PDF.js integration patterns
- (+) TypeScript catches bugs during a large rewrite
- (+) Component model prevents recreating the god-module problem
- (-) Larger bundle than vanilla JS (mitigated by code splitting)
- (-) React learning curve if team is vanilla-JS-only

### ADR-003: Offline Strategy

**Context:** Current app is fully offline. Backend introduces network dependency.

**Decision:** Tiered offline support:
- Tier 1 (always offline): viewing, annotations, zoom, navigation, auto-save
- Tier 2 (offline fallback via pdf-lib): rotate, delete, reorder, basic export
- Tier 3 (online only): forensic redaction, OCR, Bates, merge, comparison

**Consequences:**
- (+) Core daily workflow works offline
- (+) Advanced features get full Python treatment
- (-) Some operations that currently work offline will require network in v2
- (-) Frontend must maintain pdf-lib as a fallback dependency

---

## 8. Final Recommendation

Proceed with the modified architecture. The key changes from the system designer's proposal:

1. **Swap Vercel serverless for Fly.io/Railway persistent server** -- eliminates the top 4 risks
2. **Drop Vercel Blob and KV** -- use local filesystem on persistent server
3. **Drop Turborepo** -- use pnpm workspaces
4. **Drop Tailwind CSS** -- use CSS Modules with existing CSS variable system
5. **Keep pdf-lib on frontend** -- offline fallback for core operations
6. **Keep Tesseract.js on frontend** -- offline OCR fallback
7. **Add strict phasing** -- Phase 1 MVP must be usable before Phase 2 starts

The rest of the architecture (FastAPI, PyMuPDF, pikepdf, React 19, Zustand, Fabric.js, PDF.js, API design, data flow, session management) is approved as proposed.
