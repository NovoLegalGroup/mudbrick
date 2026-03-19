# Changelog

All notable changes to Mudbrick are documented in this file.

## [2.0.0] - TBD

Complete rewrite from web application to native Windows desktop application.

### Added

- **Desktop application** built with Tauri 2.x, React 19, TypeScript, and FastAPI
- **Native file dialogs** for open, save, and save-as operations
- **Forensic redaction engine** with built-in pattern matching (SSN, credit card, email, phone, date) and custom regex support. Redactions permanently strip content from PDF objects using PyMuPDF.
- **OCR engine** powered by pytesseract with per-word confidence scores, coordinate mapping, and result caching
- **Document comparison** with pixel-level page diff, change type detection (added, deleted, modified, unchanged), and diff image generation
- **PDF encryption** with AES-256, owner/user passwords, and granular permission control (print, copy, modify, annotate)
- **Metadata management** -- view, edit, and sanitize PDF metadata fields
- **PDF form support** -- detect fields (text, checkbox, radio, dropdown), fill values, flatten forms, export/import form data as JSON
- **Digital signatures** -- draw, type, or upload signature images and place on any page
- **Exhibit stamping** with customizable format string, position, font, and page selection
- **Bates numbering** with prefix/suffix, zero-padding, configurable position, font, and page range
- **Headers and footers** with six zone positions, dynamic token replacement ({page}, {pages}, {date}, {time}, {filename}, {author}, {title}), skip first/last page, mirror mode, and separator lines
- **Page labels** -- custom page numbering schemes (decimal, Roman, alphabetic) with arbitrary start values
- **Annotation tools** -- freehand draw, highlight, text annotation, rectangle, ellipse, line, arrow, image/stamp, eraser
- **Annotation property panel** -- color, stroke width, opacity, font size, font family, shape type
- **Export with annotation flattening** -- burn annotations into the PDF for sharing
- **Image export** -- export individual pages as PNG/JPEG
- **Document merge** -- combine multiple PDFs into a single document
- **Document split** -- extract page ranges into separate files with custom naming
- **50+ levels of undo/redo** with version snapshots stored on disk
- **Text extraction and search** with per-page results and bounding rectangles
- **Text editing** -- cover-and-replace text regions with background color matching
- **Find bar** (Ctrl+F) with match navigation and highlight overlay
- **Thumbnail sidebar** with page previews, click-to-navigate, and drag-to-reorder
- **Outline/bookmarks panel** for PDF table of contents navigation
- **Page operations** -- rotate, delete, reorder, insert blank, crop, duplicate, insert from file, replace with file or image
- **Dark mode** with system preference detection, manual toggle, and CSS custom properties
- **Accessibility** -- skip-to-content link, focus trap for modals, ARIA live region announcer, keyboard navigation throughout
- **Onboarding tooltips** for first-time users
- **Recent files** with persistent storage (up to 10 files)
- **Auto-updater** via Tauri's built-in update mechanism
- **Drag-and-drop** file opening on the welcome screen
- **Keyboard shortcuts** for all major operations
- **CI/CD** with GitHub Actions -- frontend lint/type-check/test, backend type-check/test, Tauri cargo check, Windows installer release workflow

### Changed

- **Architecture**: migrated from Vercel-hosted web app to Tauri desktop application with embedded FastAPI sidecar
- **PDF engine**: replaced browser-based PDF.js rendering with server-side PyMuPDF for all mutations, with PDF.js retained for client-side viewing
- **File handling**: replaced browser upload/download with native filesystem access via Tauri plugins
- **State management**: migrated from vanilla JavaScript to Zustand stores with TypeScript
- **UI framework**: migrated from vanilla HTML/CSS/JS to React 19 with TypeScript
- **Styling**: migrated from global CSS to scoped CSS modules with CSS custom properties for theming

### Improved

- **Performance**: no browser memory limits; supports 100+ MB PDFs
- **Undo/redo**: 50+ levels with disk-backed version snapshots (v1 had limited in-memory undo)
- **Redaction**: forensic content removal (v1 had visual-only overlay redaction)
- **Offline**: fully offline by default (v1 required network for initial load)
- **Type safety**: full TypeScript coverage on frontend, Python type hints on backend

### Technical Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.x (Rust + WebView2) |
| Frontend | React 19, TypeScript, Zustand, Vite 6 |
| Backend sidecar | Python 3.12, FastAPI, PyMuPDF, pytesseract |
| PDF viewing | PDF.js 4.x (client-side rendering) |
| Annotations | Fabric.js 6.x (client-side canvas) |
| Testing | Vitest + React Testing Library (frontend), pytest + pytest-asyncio (backend) |
| CI/CD | GitHub Actions |
