# Mudbrick v2 -- Migration Guide

Guide for the Novo Legal team transitioning from Mudbrick v1 (web) to v2 (desktop).

## What's New in v2

Mudbrick v2 is a complete rewrite as a **native desktop application** for Windows. Key improvements:

- **Desktop application** -- runs locally via Tauri, no browser required
- **Forensic redaction** -- permanently strips sensitive data from PDFs (SSN, credit card, email, phone, dates, custom regex)
- **OCR** -- extract text from scanned documents using Tesseract
- **Document encryption** -- AES-256 password protection with granular permissions
- **Document comparison** -- side-by-side diff with pixel-level change detection
- **PDF forms** -- detect, fill, flatten, and export/import form data
- **Digital signatures** -- draw, type, or upload signature images
- **Exhibit stamping** -- sequential exhibit labels with customizable format
- **Bates numbering** -- legal document numbering with prefix/suffix
- **Headers and footers** -- with dynamic tokens ({page}, {pages}, {date}, {filename})
- **Page labels** -- custom page numbering (Roman, alphabetic, etc.)
- **50+ levels of undo/redo** -- reliable version history
- **Accessibility** -- keyboard navigation, skip links, focus traps, screen reader announcements
- **Dark mode** -- system-aware theme with manual toggle
- **Annotation tools** -- draw, highlight, text, shapes (rect, ellipse, line, arrow), stamps, eraser
- **Export with annotations** -- flatten annotations into the PDF
- **Metadata management** -- view, edit, and sanitize PDF metadata

## System Requirements

| Requirement | Minimum |
|-------------|---------|
| Operating System | Windows 10 (1809+) or Windows 11 |
| WebView2 Runtime | Included with Windows 10 (April 2018+) and Windows 11. If missing, the installer will bootstrap it. |
| Disk Space | ~100 MB for the application |
| RAM | 4 GB minimum, 8 GB recommended for large PDFs |
| Display | 1280x720 minimum resolution |

## Installation

1. Download the `.msi` installer from the GitHub Release page (link provided by your IT team)
2. Double-click the installer to run it
3. If Windows SmartScreen shows a warning (unsigned build), click "More info" then "Run anyway"
4. Follow the installation wizard -- default settings are recommended
5. Launch Mudbrick from the Start menu or desktop shortcut

## First Launch

On first launch, you will see:

1. **Welcome screen** with a drag-and-drop zone and "Open PDF" button
2. **Onboarding tooltips** highlighting key features (dismiss by clicking through)
3. The backend (Python sidecar) starts automatically -- you may see a brief loading indicator

### Opening a File

- Click "Open PDF" or press `Ctrl+O`
- Drag and drop a PDF onto the welcome screen
- Click a file from the "Recent Files" list

## Key Differences from v1

| Feature | v1 (Web) | v2 (Desktop) |
|---------|----------|--------------|
| Platform | Browser (Chrome, Edge) | Native Windows app |
| File handling | Upload via browser | Native file dialogs, direct disk access |
| File size limit | ~50 MB (browser memory) | 100+ MB (limited by system RAM) |
| Offline support | Limited (service worker) | Full offline by default |
| Save | Download to Downloads folder | Save in-place or Save As |
| Undo/Redo | Limited | 50+ levels with version snapshots |
| Redaction | Visual only (overlay) | Forensic (permanent content removal) |
| OCR | Not available | Built-in Tesseract integration |
| Encryption | Not available | AES-256 with permissions |
| Forms | Not available | Detect, fill, flatten, export/import |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |
| `Ctrl+F` | Find in document |
| `Ctrl+P` | Print |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Reset zoom |
| `Page Up` / `Page Down` | Navigate pages |
| `Home` / `End` | First / last page |
| `Escape` | Deselect tool / close panel |
| `Delete` | Delete selected annotation |

## Fallback

The v1 web application remains available during the transition period. If you encounter issues with v2:

1. Use v1 as a fallback for urgent work
2. Report the issue to your IT team with:
   - What you were doing when the issue occurred
   - The file you were working with (if shareable)
   - Any error messages shown
   - Screenshots if applicable

## Support

- Report issues via your team's standard IT support channel
- Include the app version (visible in the title bar or About dialog)
- For crash reports, check `%APPDATA%/mudbrick/logs/` for log files
