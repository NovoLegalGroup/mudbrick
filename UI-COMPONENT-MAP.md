# Mudbrick v2 -- UI Component Map

> Date: 2026-03-19
> Status: Implementation-ready current-to-target mapping for the shell redesign
> Primary references: [UI-SHELL-SPEC.md](UI-SHELL-SPEC.md), [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)

---

## 1. Purpose

This document maps the current frontend component tree to the target Acrobat-familiar shell.

It answers:

- what stays
- what moves
- what gets split
- what gets merged
- where each feature should live in the new shell

---

## 2. Action Labels

- `Keep`: component survives with minor adjustments
- `Refactor`: component survives but needs structural changes
- `Split`: component should be broken into smaller targeted components
- `Merge`: component should be absorbed into another shell region
- `Replace`: current implementation should be retired in favor of a new shell primitive
- `Defer`: keep hidden or disabled until backend/data support exists

---

## 3. Target Shell Composition

Recommended top-level shell components:

- `AppShell`
- `AppMenuBar`
- `PrimaryCommandBar`
- `ViewerUtilityBar`
- `LeftNavigationRail`
- `LeftPaneHost`
- `DocumentWorkspace`
- `RightTaskPaneHost`
- `StatusBar`
- `AppModalHost`

Recommended no-document shell components:

- `HomeShell`
- `HomeOpenPanel`
- `HomeRecentFiles`
- `UpdatePanel`

---

## 4. Current-to-Target Mapping

| Current file | Current role | Target role | Action | Target destination |
|---|---|---|---|---|
| `apps/web/src/App.tsx` | monolithic app routing + shell + modal mounting | top-level composition only | Split | `AppShell`, `HomeShell`, `AppModalHost`, shell command handlers |
| `apps/web/src/components/welcome/WelcomeScreen.tsx` | no-document landing screen with open + drag/drop + recent files | `HomeOpenPanel` plus scoped home content | Refactor | keep open/drop, remove embedded recent-files duplication |
| `apps/web/src/components/recent/RecentFilesPanel.tsx` | standalone recent files list | `HomeRecentFiles` | Refactor | single source of truth for recent files UI |
| `apps/web/src/components/viewer/PdfViewer.tsx` | viewer + zoom/nav controls | `DocumentWorkspace` viewer body only | Refactor | move page/zoom controls into `ViewerUtilityBar` |
| `apps/web/src/components/viewer/ThumbnailSidebar.tsx` | pages/outline tab host | `LeftPaneHost` pages and outline views | Split | rail selection moved to `LeftNavigationRail` |
| `apps/web/src/components/sidebar/OutlinePanel.tsx` | outline content | outline mode in `LeftPaneHost` | Keep/Defer | keep hidden or disabled until real outline data exists |
| `apps/web/src/components/sidebar/PageList.tsx` | thumbnail list and context menu | pages mode in `LeftPaneHost` | Keep | stays as main page organizer list |
| `apps/web/src/components/annotations/Toolbar.tsx` | annotation tool strip | annotate group in `PrimaryCommandBar` | Merge/Refactor | tool definitions reused, shell layout changes |
| `apps/web/src/components/annotations/PropertyPanel.tsx` | right-side properties panel | `RightTaskPaneHost` properties mode | Refactor | properties become one right-pane mode, not fixed panel |
| `apps/web/src/components/annotations/AnnotationCanvas.tsx` | page overlay for annotations | live overlay in document workspace | Keep/Refactor | must mount in page render path |
| `apps/web/src/components/export/ExportToolsBar.tsx` | export action cluster | output group in command bar | Merge | commands move into shell toolbar/menu |
| `apps/web/src/components/legal/LegalToolsBar.tsx` | legal tools action cluster | advanced/tools group or right-pane launcher set | Merge | do not keep as separate bar |
| `apps/web/src/components/export/ExportDialog.tsx` | export dialog | shared modal host dialog | Keep/Refactor | align to shared modal contract |
| `apps/web/src/components/export/ImageExportDialog.tsx` | image export dialog | shared modal host dialog | Keep/Refactor | align to shared modal contract |
| `apps/web/src/components/export/AnnotationReport.tsx` | report modal | output/report modal or right-pane report view | Refactor | must be reachable from shell |
| `apps/web/src/components/legal/BatesDialog.tsx` | Bates modal | shared modal host dialog | Keep | launched from documented shell command |
| `apps/web/src/components/legal/HeaderFooterDialog.tsx` | header/footer modal | shared modal host dialog | Keep | launched from documented shell command |
| `apps/web/src/components/compare/ComparisonViewer.tsx` | comparison overlay | compare tool in right pane or shared modal | Refactor | remove bespoke overlay behavior |
| `apps/web/src/components/security/SecurityPanel.tsx` | security overlay | security tool in right pane or shared modal | Refactor | remove bespoke overlay behavior |
| `apps/web/src/components/onboarding/OnboardingTooltips.tsx` | first-run tooltip flow | shell-aware onboarding | Refactor | targets must map to real regions |
| `apps/web/src/components/shared/Modal.tsx` | shared modal primitive | single dialog contract | Refactor | support wider layouts and scroll variants |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | shortcut registry and bindings | shell command registry | Refactor | align catalog to real commands only |
| `apps/web/src/stores/uiStore.ts` | basic sidebar/modal/theme state | shell region and pane state | Refactor | add left/right pane modes and overflow state |
| `apps/web/src/styles/variables.css` | tokens | shell token source | Refactor | remove undefined token use and add shell tokens |
| `apps/web/src/styles/global.css` | app layout primitives | shell layout primitives | Refactor | support two-row top chrome and pane layout |

---

## 5. New Components Recommended

| New component | Responsibility | Notes |
|---|---|---|
| `AppMenuBar.tsx` | File/Edit/View/Document/Tools/Help menus | may be custom or backed by Tauri-native menus |
| `PrimaryCommandBar.tsx` | top command groups | hosts file/history/annotate/document/advanced/output groups |
| `ViewerUtilityBar.tsx` | page nav + zoom + find | lifted out of `PdfViewer.tsx` |
| `LeftNavigationRail.tsx` | mode switcher for pages/outline/search | icon/label desktop rail |
| `LeftPaneHost.tsx` | renders left pane mode content | wraps pages, outline, search |
| `RightTaskPaneHost.tsx` | renders task-pane mode content | properties, security, compare, OCR, forms, etc. |
| `StatusBar.tsx` | low-noise document/process status | optional but recommended |
| `AppModalHost.tsx` | centralized dialog mounting | routes dialog state from `uiStore` |
| `ShellCommandRegistry.ts` or equivalent | command definitions and enablement rules | powers menu bar, toolbar, shortcuts |

---

## 6. File-Level Refactor Plan

### 6.1 `App.tsx`

Target outcome:

- handles document open/close/session orchestration
- mounts `HomeShell` or `AppShell`
- does not directly inline all toolbar/layout markup
- delegates modal mounting to `AppModalHost`

### 6.2 `PdfViewer.tsx`

Target outcome:

- viewer body only
- no top-level shell chrome responsibilities
- accepts page nav/zoom state from shell-level controls

### 6.3 `ThumbnailSidebar.tsx`

Target outcome:

- split into:
  - `LeftNavigationRail`
  - `LeftPaneHost`
  - `PagesPane`
  - `OutlinePane`

### 6.4 `Toolbar.tsx`, `ExportToolsBar.tsx`, `LegalToolsBar.tsx`

Target outcome:

- merged into one command-bar system
- command definitions live in a central registry
- shell decides grouping and visibility

### 6.5 `PropertyPanel.tsx`

Target outcome:

- becomes `RightTaskPaneHost` mode: `properties`
- hidden when no editable tool/selection is active

### 6.6 Overlay dialogs

`ComparisonViewer.tsx`, `SecurityPanel.tsx`, and `AnnotationReport.tsx` must either:

- move into the shared modal host, or
- move into right task pane mode

They must stop owning their own bespoke overlay contract.

---

## 7. Store and Command Mapping

### 7.1 `uiStore.ts`

Add or formalize:

- `leftPaneMode`
- `rightPaneMode`
- `leftPaneOpen`
- `rightPaneOpen`
- `commandOverflowOpen`
- `activeModal`

### 7.2 Command registry

Every visible command should have a definition that includes:

- command id
- label
- icon
- shortcut
- enablement rule
- placement(s): menu, toolbar, context menu, overflow
- handler

This registry should drive:

- menu bar items
- command bar buttons
- shortcut catalog
- onboarding references where applicable

---

## 8. Deletion or De-duplication Targets

The redesign should explicitly remove duplication in these places:

- recent files rendered in two places at once
- multiple ad hoc feature bars across the top shell
- shell-level actions that exist only as hidden mounted dialogs
- mixed modal implementations

---

## 9. Test Impact Map

| Area | Tests needed |
|---|---|
| `AppShell` composition | editor vs home shell render, region visibility, pane toggle behavior |
| command registry | enablement rules, placements, shortcut consistency |
| left navigation | rail mode switch, pane content, disabled outline state |
| right task pane | mode switching, collapse/expand, persistence behavior |
| modal host | focus trap, close, focus return, body scroll behavior |
| recent files | single-source rendering, open/remove behavior |
| annotation shell | visible tool => mounted overlay => export path |

---

## 10. Completion Criteria

- every top-level shell region has an owning component
- no shell responsibility remains trapped inside `App.tsx`
- current components are either mapped to a target role or explicitly retired
- test ownership exists for each region and interaction type
