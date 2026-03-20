# Common PDF Editor Backlog

> Purpose: list common PDF editor functions that are **not explicitly planned in Phases 1-4** of the current Mudbrick v2 Windows app roadmap and define a practical implementation path for them.
> Source of truth for current planned work: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
> Scope rule: this backlog is for post-parity or explicitly re-scoped work, not for features already scheduled in Phases 1-4.

---

## Scope Rule

This list includes only features that do **not** have an explicit Phase 1-4 roadmap item.

- If a feature is already scheduled in the current implementation plan, it does not belong here
- If a feature has placeholders or adjacent groundwork but no actual phase commitment, it still counts as unscheduled
- Priority is based on how common the feature is in everyday PDF editors and how often users expect it to be there

### Completed Since Backlog Creation

The following backlog items have now been delivered in the desktop codebase and are retained here as completion history:

- Create PDF from images
- Compress / optimize / reduce file size
- Attachment panel

---

## Missing Common Functions

Verification note: reviewed against the desktop codebase on 2026-03-19. Status values below now reflect the current repository state rather than only the original roadmap state.

| Function | Status | Why users expect it | Priority | Notes |
|---|---|---|---|---|
| Print | Missing | Nearly every desktop PDF editor exposes a native print action | High | Shortcut catalog references `Ctrl+P`, but there is no live print action yet |
| Duplicate selected pages | Partial | Common in page organizers for packet prep and court bundles | High | Implemented this turn as page duplication API plus context-menu duplicate for the selected page; multi-select UI is still not present |
| Insert pages from another PDF at a chosen position | Partial | Users expect to insert pages into the middle of a document without full merge/reorder gymnastics | High | Implemented this turn as insert-after-selected-page from another PDF; no full before/after/append picker dialog yet |
| Replace page from file/image | Implemented | Standard organize-pages capability | High | Implemented this turn through page context menu and backend replacement route for PDF or image sources |
| Crop UI / margin crop tool | Partial | Basic page cleanup is a common PDF editor expectation | High | Backend `/api/pages/{sid}/crop` exists, but there is still no real crop UI or margin presets |
| Bookmark / outline editor | Partial | Common for navigation in long PDFs | High | Read-only outline panel placeholder exists; editing workflow is still missing |
| Underline / strikeout / squiggly text markup | Missing | These are standard review annotations beside highlight | High | No dedicated review markup tools yet |
| Sticky note / comment annotation | Missing | Most PDF editors support note-style comments | High | No note/comment annotation workflow yet |
| Hyperlink create/edit/remove | Missing | Common in forms, briefs, exhibits, and internal navigation | Medium | No PDF link annotation editing flow yet |
| Print to PDF / create PDF from images | Implemented | Users often need to assemble PDFs from scans/screenshots/images | Medium | Implemented via welcome-screen import flow plus `/api/documents/from-images`; ordering UI and page-size presets are still optional polish |
| Compress / optimize / reduce file size | Implemented | Very common for filing/upload/email workflows | Medium | Implemented via `/api/documents/{sid}/optimize` and a live `Optimize PDF` toolbar action; preset-based compression profiles are still optional polish |
| Flatten annotations/forms as an explicit command | Implemented | Many editors let users choose flatten-now vs export-only flattening | Medium | Forms flatten already existed; explicit annotation flatten command was added this turn |
| Attachment panel (embedded files) | Implemented | Common in full PDF editors, especially legal/document bundles | Low | Implemented via sidebar `Files` tab plus `/api/attachments/{sid}` add/export/delete endpoints |

---

## Recommended Rollout

### Pack A: Core Everyday Gaps (Do First)

These are the most obvious omissions for a normal desktop PDF editor:

1. Print
2. Duplicate selected pages
3. Insert pages from another PDF at a chosen position
4. Replace page from file/image
5. Crop UI / page crop tool
6. Bookmark / outline editor
7. Underline / strikeout / squiggly markup
8. Sticky note / comment annotation

### Pack B: Strong Utility Features

These are high-value once the core gaps are closed:

9. Hyperlink create/edit/remove

Completed from this utility pack:

- Compress / optimize / reduce file size
- Create PDF from images
- Flatten annotations/forms as explicit command

### Pack C: Full-Editor Extras

These improve completeness more than core workflow:

Completed from this pack:

- Attachment panel

---

## Implementation Plan By Feature

### 1. Print

**Why now**
- A Windows desktop app feels incomplete without `Ctrl+P`
- This is one of the most immediately expected desktop actions

**Frontend**
- Add `Print` action in toolbar/file menu
- Add `Ctrl+P` shortcut
- Add lightweight print dialog if native print options need preselection

**Tauri / native**
- Use Tauri-side print integration or WebView print where sufficient
- If WebView printing is too limited, expose a native command from Rust

**Tests**
- Component test for print action visibility and shortcut binding
- Integration test for command dispatch
- Manual QA for printer dialog open/cancel/print on Windows 10/11

**Estimate**
- 2-4 days

### 2. Duplicate Selected Pages

**Frontend**
- Add `Duplicate page` and `Duplicate selected pages` in page organizer
- Reuse page selection model from reorder/delete UI

**Backend**
- Add `/api/pages/{sid}/duplicate`
- Copy pages in PyMuPDF while preserving page order and labels where possible

**Tests**
- Backend tests for single-page and multi-page duplication
- Integration test for selection + duplicate + undo/redo
- Output fixture test for duplicated page count/order

**Estimate**
- 2-3 days

### 3. Insert Pages From Another PDF

**Frontend**
- Add organizer action: `Insert from PDF...`
- Tauri open dialog for source PDF
- Position picker: before page / after page / append

**Backend**
- Add `/api/pages/{sid}/insert-from-file`
- Insert selected or all pages from source PDF into target session document

**Tests**
- Integration tests for insert at beginning/middle/end
- Fixture tests for page order and page count
- Manual QA with mixed page sizes and rotated pages

**Estimate**
- 3-5 days

### 4. Replace Page From File/Image

**Frontend**
- Add `Replace page...` on selected page
- Support PDF page or image as replacement source

**Backend**
- Add `/api/pages/{sid}/replace`
- For PDF source: replace with chosen source page
- For image source: convert image to PDF page with size controls

**Tests**
- Backend tests for replace with PDF and image
- Output fixture tests for page count stability
- Manual QA for undo/redo and thumbnail refresh

**Estimate**
- 4-6 days

### 5. Crop UI / Margin Crop Tool

**Current foundation**
- API design already mentions crop, but no scheduled UX

**Frontend**
- Add crop mode with draggable rectangle
- Add presets: trim margins, custom crop, apply to current/all/selected pages

**Backend**
- Finalize `/api/pages/{sid}/crop`
- Support crop box/media box strategy explicitly

**Tests**
- Coordinate transform unit tests
- Integration tests for apply crop and undo/redo
- Visual fixture tests for expected visible page area

**Estimate**
- 4-6 days

### 6. Bookmark / Outline Editor

**Current foundation**
- `OutlinePanel` exists as a placeholder in the proposed component structure

**Frontend**
- Add outline tree UI with add/edit/delete/reorder
- Support destination types: page, zoomed page position

**Backend**
- Add `/api/documents/{sid}/outline` GET/POST/PATCH/DELETE
- Persist outline/bookmarks via PyMuPDF or pikepdf

**Tests**
- Tree manipulation component tests
- Backend serialization tests
- Output tests reopening saved PDFs in Adobe/Acrobat-compatible readers

**Estimate**
- 1-2 weeks

### 7. Underline / Strikeout / Squiggly Markup

**Frontend**
- Add review tools beside highlight
- Reuse text selection and overlay pipeline from search/text layer

**Backend**
- Extend annotation renderer/export path for text markup annotations

**Tests**
- Text selection coordinate tests
- Output fixture tests for each markup style
- Manual QA on rotated pages and OCR text layers

**Estimate**
- 4-6 days

### 8. Sticky Note / Comment Annotation

**Frontend**
- Add note tool with icon placement + popup editor
- Add comment sidebar/panel for quick navigation

**Backend**
- Represent notes as canonical annotation objects
- Preserve author, timestamp, text, page position

**Tests**
- Component tests for create/edit/delete note
- Serialization tests
- Export/reopen fixture tests

**Estimate**
- 1 week

### 9. Hyperlink Create/Edit/Remove

**Frontend**
- Add link tool for rectangular region or selected text
- Support URL links and page-jump links

**Backend**
- Add `/api/links/{sid}` endpoints or fold into text/document router
- Persist PDF link annotations

**Tests**
- Validation tests for URL/page targets
- Output tests verifying working link annotations
- Manual QA in Acrobat and browser readers

**Estimate**
- 4-6 days

### 10. Create PDF From Images

**Status**
- Implemented on 2026-03-19

**Shipped scope**
- Welcome-screen `Create PDF from images` action
- Multi-file image picker through Tauri desktop dialogs
- Backend `/api/documents/from-images`
- Generated-session support for newly created PDFs without an original source file on disk

**Optional follow-up polish**
- Drag reordering before create
- Page size / fit-fill presets
- Explicit import-review dialog before session creation

### 11. Compress / Optimize / Reduce File Size

**Status**
- Implemented on 2026-03-19

**Shipped scope**
- Toolbar `Optimize PDF` action in the live editor shell
- Backend `/api/documents/{sid}/optimize`
- Safe rewrite/compaction flow using the document session/version pipeline
- User-facing success message with actual bytes saved when reduction is achieved

**Optional follow-up polish**
- Compression presets such as screen / office / print
- Estimated savings preview before run
- More aggressive image downsampling modes when needed for court/e-filing targets

### 12. Flatten Annotations / Forms As Explicit Command

**Status**
- Implemented

**Shipped scope**
- Explicit annotation flatten command in the live desktop shell
- Existing forms flatten support remains available
- Direct document mutation flow rather than export-only flattening

**Optional follow-up polish**
- Unified flatten dialog that combines annotation/forms choices in one surface
- More explicit user education around irreversible flatten behavior

### 13. Attachment Panel

**Status**
- Implemented on 2026-03-19

**Shipped scope**
- Sidebar `Files` tab for embedded attachments
- Add, export/save-as, and remove attachment actions
- Backend `/api/attachments/{sid}` list/add/export/delete endpoints
- Attachment-safe document mutation through the existing versioned session system

**Optional follow-up polish**
- Open attachment directly from the panel
- Attachment metadata editor (description, labels)
- Multi-select attachment actions

---

## Recommended Post-Parity Sequence

### Phase 5: Common Editor Essentials (4-6 weeks)

- Print
- Duplicate selected pages
- Insert pages from another PDF
- Replace page from file/image
- Crop UI
- Underline / strikeout / squiggly
- Sticky notes / comments

### Phase 6: Navigation And Productivity (3-5 weeks)

- Bookmark / outline editor
- Hyperlink create/edit/remove
- Done already: Flatten annotations/forms as explicit command

### Phase 7: Document Utility Expansion (Completed 2026-03-19)

- Done: Create PDF from images
- Done: Compress / optimize / reduce file size
- Done: Attachment panel

---

## TDD Expectations For This Backlog

All backlog work should inherit the strict Pre-7 testing model:

- Write failing tests before implementation
- Use output fixtures for anything that changes the saved PDF
- Add manual QA steps for every button and dialog
- Treat Acrobat/Adobe Reader reopen validation as part of definition of done

Per feature, aim for:
- Unit tests for parsing, validation, or page math
- Component tests for UI behavior
- Integration tests for frontend-to-backend flow
- Output fixture tests for produced PDFs

---

## Suggested Next Decision

If we want to turn this backlog into active roadmap work, the cleanest next step is:

1. Approve which of these should become Phase 5 after current parity
2. Mark any that should move earlier into Phase 4
3. Add acceptance criteria and QA fixtures for the approved remaining set
