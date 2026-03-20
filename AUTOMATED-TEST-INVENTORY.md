# Mudbrick v2 -- Automated Test Inventory

Snapshot date: 2026-03-19

Purpose: satisfy the Pre-7 requirement for "a completed automated test inventory by module and feature" and make current coverage gaps explicit before Stage 7 packaging/release work.

## Current Execution Status

- Backend automated coverage exists across the major router/service areas, including the newer generated-document and attachment flows.
- Frontend automated coverage exists for a11y primitives, welcome components, stores, hooks, and utilities.
- The automated suite is **not currently runnable end-to-end in this shell**.

Execution blockers verified in this workspace:

- No runnable Python interpreter is available in the current shell for backend `pytest` execution.
- `apps/web` is missing installed local dev packages needed to run/build the test suite in this environment.
  - `typescript`
  - `@testing-library/react`
  - `@testing-library/jest-dom`

## Backend Coverage Inventory

| Area | Coverage Status | Evidence |
|---|---|---|
| Session lifecycle and versioning | Present | `apps/api/tests/test_session_manager.py`, `apps/api/tests/test_documents.py` |
| Page operations | Present | `apps/api/tests/test_pages.py` |
| Merge and split | Present | `apps/api/tests/test_merge.py`, `apps/api/tests/test_split.py` |
| Export and annotation rendering | Present | `apps/api/tests/test_export.py`, `apps/api/tests/test_export_images.py`, `apps/api/tests/test_annotation_renderer.py`, `apps/api/tests/test_flatten_annotations.py` |
| OCR | Present | `apps/api/tests/test_ocr.py`, `apps/api/tests/test_ocr_engine.py` |
| Text extract/search/edit | Present | `apps/api/tests/test_text.py`, `apps/api/tests/test_legal_text.py`, `apps/api/tests/test_legal_text_service.py` |
| Forensic redaction | Present | `apps/api/tests/test_redaction.py`, `apps/api/tests/test_redaction_engine.py` |
| Legal tools | Present | `apps/api/tests/test_bates.py`, `apps/api/tests/test_headers.py`, `apps/api/tests/test_exhibits.py`, `apps/api/tests/test_forms.py` |
| Security and comparison | Present | `apps/api/tests/test_security.py`, `apps/api/tests/test_compare.py`, `apps/api/tests/test_comparison_engine.py` |
| Phase 7 document utilities | Present | `apps/api/tests/test_documents.py`, `apps/api/tests/test_merge.py`, `apps/api/tests/test_attachments.py` |

## Frontend Coverage Inventory

| Area | Coverage Status | Evidence |
|---|---|---|
| Accessibility primitives | Present | `apps/web/src/components/a11y/__tests__/Announcer.test.tsx`, `FocusTrap.test.tsx`, `SkipLink.test.tsx` |
| Shared UI primitives | Present | `apps/web/src/components/shared/__tests__/Modal.test.tsx`, `Toast.test.tsx` |
| Welcome flow basics | Present | `apps/web/src/components/welcome/__tests__/DropZone.test.tsx`, `ProgressBar.test.tsx`, `WelcomeScreen.test.tsx` |
| Hooks | Present | `apps/web/src/hooks/__tests__/useDarkMode.test.ts`, `useUndoRedo.test.ts`, `useZoom.test.ts` |
| Stores | Present | `apps/web/src/stores/__tests__/annotationStore.test.ts`, `documentStore.test.ts`, `sessionStore.test.ts`, `uiStore.test.ts` |
| Utilities | Present | `apps/web/src/utils/__tests__/colorSampler.test.ts`, `zoom.test.ts` |
| Legal dialog slice | Present | `apps/web/tests/legalDialogs.test.tsx` |
| Viewer/document shell flows | Limited | No broad integration/component coverage yet for the live editor shell |
| OCR/redaction/security/compare panels | Limited | Feature code exists, but targeted frontend test coverage is still thin |
| Phase 7 document utilities UI | Limited | `uiStore` was extended for attachments, but there are no dedicated component tests yet for `AttachmentsPanel`, `Optimize PDF`, or create-from-images flow |

## Added Coverage In The Current Implementation Slice

- Backend tests for create-from-images and optimize document flow
- Backend tests for generated-session save-as after merge
- Backend tests for attachment list/add/export/delete
- Frontend store test update for the new attachments sidebar tab

## Pre-7 Required Follow-Ups

- Restore a runnable backend test environment in CI/local dev (`pytest` + Python 3.12).
- Restore a runnable frontend build/test environment in `apps/web`.
- Add frontend component/integration tests for:
  - `Create PDF from images`
  - `Optimize PDF`
  - `AttachmentsPanel`
  - main-shell page operation flows
  - compare/security/report entrypoint reachability
  - OCR and redaction panel interactions
- Add output/golden verification for:
  - generated image-to-PDF sessions
  - optimized PDF validity and reopen behavior
  - embedded attachments surviving save/reopen
- Ensure CI executes the frontend and backend suites as real gate checks, not documentation-only expectations.
