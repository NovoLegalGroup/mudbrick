# Mudbrick v2 -- UI Interaction Matrix

> Date: 2026-03-19
> Status: Technical interaction contract for the UI shell redesign
> Primary references: [UI-SHELL-SPEC.md](UI-SHELL-SPEC.md), [UI-COMPONENT-MAP.md](UI-COMPONENT-MAP.md)

---

## 1. Purpose

This matrix defines the expected interaction behavior for the redesigned shell.

Each row should become:

- an automated test where practical
- a manual QA row in the Pre-7 matrix
- a design review checkpoint during the shell rewrite

---

## 2. Column Definitions

- `Area`: shell region or screen
- `Trigger`: user action
- `Expected behavior`: what the app must do
- `Backing modules`: likely implementation area
- `Automated coverage`: test layer expected
- `Manual QA`: human validation focus

---

## 3. Home / No-Document State

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Home shell | App launches with no active document | Show open panel, drag/drop zone, update panel, and exactly one recent-files surface | `App.tsx`, `WelcomeScreen.tsx`, `RecentFilesPanel.tsx` | component | verify no duplicated recent section |
| Home shell | Click `Open` | Open Tauri file dialog and load selected PDF into editor shell | `useTauri`, `api.openFile`, document store | integration | verify transition from home to editor |
| Home shell | Drag PDF into drop zone | Load first valid PDF and enter editor shell | drop zone + open flow | integration | verify drag feedback and load state |
| Recent files | Click recent file row | Open selected file and leave home shell | session store + open flow | component/integration | verify correct file opens |
| Recent files | Click remove icon | Remove only that item from list without opening file | session store | component | verify keyboard and mouse both work |
| Update panel | Update available | Surface update notice without blocking open flow | updater hook | component | verify not visually dominant |

---

## 4. Menu Bar and Primary Command Bar

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Menu bar | Open `File` menu | Show real file commands only; disabled items reflect document state | command registry + shell menu | component | inspect enable/disable behavior |
| Command bar | Click `Save` | Save current document to source path | `api.save`, document store | integration | verify save state and toast/status |
| Command bar | Click `Save As` | Open save dialog and write to new path | `useTauri`, `api.saveAs` | integration | verify file path change handling |
| Command bar | Click `Print` | Open print flow when implemented; otherwise command must be hidden/disabled | command registry | component | verify no fake enabled print action |
| Command bar | Click `Undo` | Reverse latest applicable action | undo system | integration | verify visible document state changes |
| Command bar | Click `Redo` | Reapply latest undone action | undo system | integration | verify visible document state changes |
| Command bar | Click annotation tool | Activate tool and update right task pane to properties mode if applicable | annotation store + shell pane state | component | verify tool state + pane sync |
| Command bar | Click `Compare` | Open compare task pane or modal from visible shell entry point | compare launcher + UI store | component/integration | verify feature is reachable without hidden state |
| Command bar | Click `Security` | Open security task pane or modal from visible shell entry point | security launcher + UI store | component/integration | verify feature is reachable |
| Command bar | Click `Export PDF` | Open export options flow through shared dialog contract | export dialog + modal host | component | verify dialog and focus behavior |
| Command bar | Window shrinks to 1280px | Lower-priority actions move to overflow without hiding primary commands | responsive shell layout | component/visual | verify no clipped controls |

---

## 5. Viewer Utility Bar

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Utility bar | Click previous page | Navigate to previous page and sync current page state | document store + viewer scroll | component/integration | verify sidebar selection updates |
| Utility bar | Click next page | Navigate to next page and sync current page state | document store + viewer scroll | component/integration | verify sidebar selection updates |
| Utility bar | Type page number | Jump to valid page; reject or clamp invalid input gracefully | viewer nav logic | component | verify boundaries 1 and last page |
| Utility bar | Click zoom in/out | Update zoom and rerender pages | viewer zoom hooks | component | verify scale text sync |
| Utility bar | Click fit width | Fit current document width to workspace | viewer zoom hooks | component | verify page width result |
| Utility bar | Click fit page | Fit page within viewport | viewer zoom hooks | component | verify page fully visible |
| Utility bar | Use find command | Open search mode and sync highlights/results | search UI + viewer highlights | integration | verify result navigation |

---

## 6. Left Navigation Rail and Left Pane

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Left rail | Select `Pages` | Show thumbnail organizer pane | UI store + pages pane | component | verify default state |
| Left rail | Select `Outline` with no data | Show disabled or explicit unsupported state, not fake empty content pretending to work | UI store + outline pane | component | verify honest messaging |
| Left rail | Select `Outline` with data | Show bookmark tree and navigate viewer on click | outline source + outline pane | integration | verify nested navigation |
| Left pane | Click thumbnail | Navigate viewer to page and update current page state | page list + viewer | component/integration | verify scroll target |
| Left pane | Reorder pages by drag | Persist new order and refresh document version | page list + API | integration | verify version increment |
| Left pane | Open page context menu | Show valid page actions only | page list + command registry | component | verify action availability |
| Left pane | Choose `Delete page` | Delete selected page with correct state refresh | pages API | integration | verify resulting page count |

---

## 7. Center Document Workspace

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Viewer | Load document | Render pages, set page count, default fit mode, and show active page | `PdfViewer`, `PageCanvas`, `usePdfDocument` | integration | verify first render quality |
| Viewer | Scroll document | Update current page indicator based on viewport position | viewer scroll logic | component | verify page state feels stable |
| Viewer | Activate draw/highlight/text/shape/stamp/redact | Tool is visibly usable on page surface, not toolbar-only state | `AnnotationCanvas`, annotation tools | integration | verify end-to-end with export |
| Viewer | Select annotation object | Right task pane updates to relevant properties | annotation store + pane state | component | verify selected object editing |
| Viewer | OCR/search highlights visible | Highlights render as overlays without obscuring main document chrome | search/OCR layers | component/manual | verify readability |

---

## 8. Right Task Pane

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Task pane | Open properties mode | Show annotation properties only when a relevant tool/selection exists | right pane host + annotation store | component | verify hidden when irrelevant |
| Task pane | Open security mode | Show encrypt/metadata/sanitize tools in consistent pane shell | security panel + right pane host | component | verify pane switching |
| Task pane | Open compare mode | Show compare setup/results without bespoke overlay behavior | compare view + right pane host | component/integration | verify compare stays discoverable |
| Task pane | Open OCR mode | Show OCR controls and progress area | OCR panel + right pane host | component/integration | verify long-running state |
| Task pane | Collapse pane | Increase canvas space without losing active mode context | UI store | component | verify reopen restores mode |
| Task pane | Switch modes with unsaved input | Warn or preserve state according to feature rules | pane host + feature state | component/manual | verify no silent loss |

---

## 9. Dialogs and Shared Modal Contract

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Modal host | Open any shared dialog | Focus enters dialog and background becomes inert | shared modal | component/a11y | verify keyboard trap |
| Modal host | Press Escape | Close dialog unless operation is intentionally blocking | shared modal | component | verify focus return |
| Modal host | Close dialog | Focus returns to original launcher | shared modal | component/a11y | verify launcher focus |
| Export dialog | Choose export action | Run export flow and provide progress/success/error states | export dialog + API | integration | verify output path |
| Bates dialog | Submit valid form | Apply Bates numbering and refresh document state | Bates dialog + API | integration | verify visible output |
| Header/footer dialog | Submit valid form | Apply headers/footers and refresh document state | header/footer dialog + API | integration | verify visible output |

---

## 10. Keyboard and Window Behavior

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Global shortcuts | `Ctrl+O` | Open file dialog | shortcut registry | component | verify in home and editor states |
| Global shortcuts | `Ctrl+S` | Save current document | shortcut registry + save handler | integration | verify no-op when no document |
| Global shortcuts | `Ctrl+Shift+S` | Save As flow | shortcut registry + save-as handler | integration | verify save dialog opens |
| Global shortcuts | listed shortcut not implemented | shortcut must not appear in help/menu | shortcut registry | component | verify truthfulness |
| Window resize | Shrink to 1280px | shell remains intentional, no overlapping toolbars | shell layout | visual/component | verify no clipping |
| Window resize | Collapse right pane | viewer grows and remains usable | shell layout + UI store | component/manual | verify smooth transition |

---

## 11. Error and Edge States

| Area | Trigger | Expected behavior | Backing modules | Automated coverage | Manual QA |
|---|---|---|---|---|---|
| Document open | Open fails | Show actionable error and remain in stable shell state | open flow + toast/status | integration | verify no broken transition |
| Save/export | Operation fails | Show error in toast and relevant surface; do not leave UI in fake success state | save/export flows | integration | verify retry path |
| Empty data | Outline/search/comments unavailable | Show honest disabled/empty state with no fake affordance | left pane modes | component | verify clarity |
| Long-running task | OCR/redaction/export running | Surface progress in task pane/status area without blocking unrelated reading navigation unless necessary | task state + status bar | component/manual | verify desktop feel |

---

## 12. Completion Criteria

- Every visible shell command has a documented interaction row
- Every advanced tool is either reachable from the shell or explicitly deferred
- Every shortcut shown to the user maps to a real command
- Every dialog follows the shared modal contract
- Every interaction row is represented in automated tests or manual QA
