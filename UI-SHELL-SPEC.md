# Mudbrick v2 -- UI Shell Specification

> Date: 2026-03-19
> Status: Implementation-ready shell spec for the Windows desktop UI refresh
> Primary reference: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)

---

## 1. Purpose

This document defines the target desktop shell for Mudbrick v2.

It is the implementation-level companion to the UI remediation and Acrobat-familiar modernization plan in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

The goal is to give the team a concrete target for:

- layout
- command placement
- left/right pane behavior
- responsive rules
- state ownership
- testable UX expectations

This spec is intentionally Acrobat-familiar in information architecture but modern in visual execution.

---

## 2. Design Intent

### 2.1 User model

Primary users are legal staff already familiar with Adobe Acrobat Pro.

The shell should therefore feel immediately understandable in these ways:

- file and command controls live at the top
- page navigation lives on the left
- the document dominates the center
- advanced task tools live on the right
- zoom and page position stay close to the viewer

### 2.2 Non-goals

- Do not clone Acrobat pixel-for-pixel
- Do not recreate old gradients, bevels, or dated toolbar chrome
- Do not expose every feature as a top-level button
- Do not make the app feel like a browser page with floating widgets

---

## 3. Current Baseline

Current shell baseline is primarily implemented in:

- `apps/web/src/App.tsx`
- `apps/web/src/components/viewer/PdfViewer.tsx`
- `apps/web/src/components/viewer/ThumbnailSidebar.tsx`
- `apps/web/src/components/annotations/Toolbar.tsx`
- `apps/web/src/components/annotations/PropertyPanel.tsx`

Current high-level issues:

- command area is overloaded and not grouped by user mental model
- left pane mixes navigation and feature controls too loosely
- right pane is not a true task pane yet
- some advanced tools exist but are not surfaced from the shell
- modals and panels do not yet follow one interaction contract

---

## 4. Target Information Architecture

### 4.1 Window structure

The editor shell should be composed of these regions:

1. `Native/title region`
2. `Menu bar`
3. `Primary command bar`
4. `Viewer utility bar`
5. `Left navigation rail`
6. `Left content pane`
7. `Center document workspace`
8. `Right task pane`
9. `Status bar`
10. `Modal host`

### 4.2 Wireframe

```text
+----------------------------------------------------------------------------------+
| Title / Window controls                                                         |
+----------------------------------------------------------------------------------+
| File  Edit  View  Document  Tools  Help                                         |
+----------------------------------------------------------------------------------+
| Open Save Save As Print Undo Redo | Annotate Organize Protect Compare Export    |
+----------------------------------------------------------------------------------+
| Pg < 1 / 56 > | Zoom - 111% + | Fit Width Fit Page | Find | Current mode        |
+-----------+-----------------------------------------------+----------------------+
| Left rail  | Left content pane                            | Right task pane      |
| Pages      | thumbnails / outline / attachments           | context-sensitive    |
| Outline    |                                               | properties/tools     |
| Search     |               document canvas                 | redaction/security   |
| Attachments|                                               | compare/forms/etc    |
+-----------+-----------------------------------------------+----------------------+
| Status: page, selection, OCR progress, save state, background task state        |
+----------------------------------------------------------------------------------+
```

---

## 5. Region-by-Region Spec

### 5.1 Menu bar

Purpose:

- provide desktop-app familiarity
- expose infrequent but expected commands
- serve as fallback discoverability for toolbar actions

Required top-level menus:

- `File`
- `Edit`
- `View`
- `Document`
- `Tools`
- `Help`

Menu behavior:

- available in document and no-document states
- keyboard navigable with Alt behavior if implemented through Tauri/native shell
- all menu items must map to real commands, not placeholders

Minimum `File` items:

- Open
- Open Recent
- Save
- Save As
- Export PDF
- Export Images
- Print
- Close Document
- Exit

Minimum `Edit` items:

- Undo
- Redo
- Cut
- Copy
- Paste
- Delete
- Select All
- Find

Minimum `View` items:

- Zoom In
- Zoom Out
- Actual Size
- Fit Width
- Fit Page
- Toggle Left Pane
- Toggle Right Pane
- Toggle Dark Mode

### 5.2 Primary command bar

Purpose:

- keep high-frequency actions visible
- group actions by user intent
- avoid modal-only discovery for core features

Command groups:

| Group | Commands | Visibility | Notes |
|---|---|---|---|
| File | Open, Save, Save As, Print | Always visible | Open visible in both home and editor shell |
| History | Undo, Redo | Document open | Document-level commands; annotation mode can layer on top |
| Annotate | Select, Draw, Highlight, Text, Shape, Stamp, Redact | Document open | Tool buttons remain visible only if wired to live viewer |
| Document | Rotate, Delete, Reorder, Merge, Split | Document open | Can be compacted to dropdown/overflow at narrow widths |
| Advanced | Compare, Security, Forms, OCR, Redaction Review | Document open | Prefer task-pane launchers rather than full modal-only flows |
| Output | Export PDF, Export Images, Flatten, Annotation Report | Document open | Export actions grouped together |

Interaction rules:

- max two visual rows across top shell before commands collapse
- destructive commands must not sit adjacent to primary save actions without spacing/group separation
- toolbar grouping must remain stable between sessions

### 5.3 Viewer utility bar

Purpose:

- keep page position and zoom close to the document
- separate viewer controls from feature/task controls

Required controls:

- page previous/next
- page number input
- page count display
- zoom out
- zoom percentage
- zoom in
- fit width
- fit page
- actual size
- find

Rules:

- this row stays directly above the viewer canvas
- controls do not open unrelated tool dialogs
- page and zoom state must update in real time from the document store

### 5.4 Left navigation rail

Purpose:

- switch document-navigation views without consuming toolbar space

Required tabs:

- `Pages`
- `Outline`
- `Search`

Optional/deferred tabs:

- `Attachments`
- `Comments`

Rules:

- rail is icon + label or icon-only with tooltip
- currently unsupported views must show disabled state, not fake content
- active rail selection controls the left content pane

### 5.5 Left content pane

Purpose:

- display the selected navigation context from the left rail

Content modes:

| Mode | Content | Current data source | Notes |
|---|---|---|---|
| Pages | thumbnails, page reorder, page context menu | `ThumbnailSidebar` + page store | default mode |
| Outline | document bookmarks | outline extraction source TBD | disabled until real data exists |
| Search | find results list | text search state | should sync with viewer highlights |
| Attachments | attachment list | deferred | hidden until supported |

Rules:

- pages mode remains the default
- pane width should be resizable in a later pass if needed, but fixed width is acceptable for initial implementation
- outline/search results must navigate the viewer without lag

### 5.6 Center document workspace

Purpose:

- remain the dominant visual focus of the application

Required behavior:

- neutral gray work area around the page
- white document surface with clear page shadow
- active page emphasis
- smooth page scroll
- annotation overlays mounted directly on the page render path

Rules:

- no floating task UIs should cover the page center by default
- temporary overlays like find highlights or OCR correction markers must read as viewer-layer tools, not global chrome

### 5.7 Right task pane

Purpose:

- host advanced, context-sensitive tools without overcrowding the top toolbar

Pane modes:

| Mode | Content |
|---|---|
| Properties | annotation properties for active tool/selection |
| Redaction | pattern search, matches, review, apply |
| Security | encrypt, metadata, sanitize |
| Compare | compare setup and results |
| Forms | field list/editor/data actions |
| OCR | OCR controls, progress, correction mode entry |
| Export details | optional export options if not shown in modal |

Rules:

- only one task-pane mode visible at a time
- pane can be collapsed
- opening a mode should not destroy unsaved form state unless the user confirms
- if no mode is active, pane may stay hidden to maximize document space

### 5.8 Status bar

Purpose:

- surface low-noise document and processing status

Status items:

- current page
- selection status
- save state
- OCR/background task state
- zoom or render status if useful

Rules:

- do not duplicate command functions here
- status text must be compact and non-interfering

### 5.9 Modal host

Purpose:

- provide one accessibility and interaction contract for dialogs

Required modal behavior:

- focus trap
- Escape closes unless operation is intentionally blocking
- focus returns to launcher
- backdrop click behavior is explicit and consistent
- standardized header, close button, body, actions, scroll handling

Dialogs that must move to this contract:

- export
- image export
- Bates
- headers/footers
- comparison if kept modal
- security if kept modal
- annotation report if kept modal

---

## 6. Responsive Rules

### 6.1 Target widths

- `>= 1440px`: full shell, left pane + right pane visible when active
- `1280px - 1439px`: full shell with tighter spacing; secondary commands may collapse
- `1024px - 1279px`: right task pane becomes collapsible overlay or narrower drawer
- `< 1024px`: not a primary release target, but UI must remain functional for testing and small windows

### 6.2 Collapse priorities

Commands should collapse in this order:

1. low-frequency advanced tools
2. legal/specialized output actions
3. text labels on some buttons
4. secondary command groups into overflow

Commands that should stay visible longest:

- Open
- Save
- Undo
- Redo
- page navigation
- zoom
- search
- active annotation tool group

### 6.3 Pane priorities

- left navigation remains available longer than right task pane
- right task pane may collapse before left pane
- center canvas always gets priority over decorative chrome

---

## 7. Visual System Specification

### 7.1 Typography

- App chrome font: `Segoe UI Variable`, `Segoe UI`, `Arial`, `sans-serif`
- Document content uses document-rendered fonts and should not be visually contaminated by shell styling
- Chrome sizes:
  - menu bar: 12px-13px
  - toolbar labels: 12px
  - panel section headers: 12px-13px semibold
  - dialog titles: 16px-18px semibold

### 7.2 Color system

- shell background: light neutral gray
- panel surfaces: white or near-white
- canvas surround: medium neutral gray
- dividers: subtle cool gray
- text: dark neutral
- accent: Mudbrick/Novo red used sparingly for active, destructive, or high-attention actions

### 7.3 Icon system

- consistent line weight
- no mixed filled vs outlined metaphors without purpose
- keep icons monochrome by default
- only warnings/destructive flows use accent color

### 7.4 Motion

- quick panel transitions
- no decorative motion
- dialog transitions should reinforce desktop feel, not mobile/app-store feel

---

## 8. State Ownership and Store Changes

### 8.1 UI store additions

`uiStore.ts` should evolve to support:

- `leftPaneMode: 'pages' | 'outline' | 'search' | 'attachments'`
- `rightPaneMode: 'properties' | 'redaction' | 'security' | 'compare' | 'forms' | 'ocr' | null`
- `menuOpen` or equivalent if app-level menus are custom-rendered
- `commandOverflowOpen`
- `statusItems`

### 8.2 Document store responsibilities

`documentStore.ts` remains source of truth for:

- current page
- page count
- current version
- file metadata
- save state flags if added

### 8.3 Annotation store responsibilities

`annotationStore.ts` remains source of truth for:

- active tool
- page annotations
- tool properties
- selection state

Additional requirement:

- active selection metadata should be rich enough for right-pane properties

---

## 9. Implementation Slices

### Slice 1: shell frame extraction

Create a top-level frame that separates:

- menu bar
- primary command bar
- viewer utility bar
- left nav + left content host
- center viewer host
- right task pane host
- status bar

### Slice 2: navigation and pane model

- replace ad hoc sidebar behavior with explicit left-pane modes
- replace always-on property panel with right task pane host

### Slice 3: command migration

- migrate compare/security/report/export/legal entry points into planned command groups
- remove duplicate surface-specific launchers

### Slice 4: responsive and token cleanup

- align variables
- remove undefined tokens
- add width-specific layout behavior

### Slice 5: pilot validation

- run Acrobat-familiar task walkthroughs
- adjust labels, grouping, and pane discoverability

---

## 10. Acceptance Criteria

- An Acrobat user can find thumbnails, page navigation, zoom, save, export, and annotate without instruction
- The top shell is grouped by user intent, not by implementation history
- The right task pane hosts advanced tools instead of scattering them across unrelated dialogs
- No dead tabs or unreachable feature surfaces remain
- The document remains visually dominant over all shell chrome
- The shell is usable at 1280px width with no clipped primary actions
- All shell regions are covered by component/integration tests and manual QA rows
