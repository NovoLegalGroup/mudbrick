# Mudbrick v2 -- QA Test Matrix

Comprehensive manual QA checklist for validating Mudbrick v2 before release.

**Tester:** _______________
**Date:** _______________
**Build:** _______________
**OS:** Windows 10 / Windows 11 (circle one)

Legend: Pass / Fail / N/A / Blocked

---

## 1. File Operations

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 1.1 | Open PDF via file dialog (Ctrl+O) | | |
| 1.2 | Open PDF via drag-and-drop on welcome screen | | |
| 1.3 | Open PDF from recent files list | | |
| 1.4 | Open a 1-page PDF | | |
| 1.5 | Open a 100+ page PDF | | |
| 1.6 | Open a 100+ MB PDF | | |
| 1.7 | Open an encrypted PDF (prompts for password) | | |
| 1.8 | Open a corrupted/invalid file (shows error) | | |
| 1.9 | Save (Ctrl+S) overwrites original | | |
| 1.10 | Save As (Ctrl+Shift+S) to new path | | |
| 1.11 | Close document returns to welcome screen | | |
| 1.12 | Undo (Ctrl+Z) after page operation | | |
| 1.13 | Redo (Ctrl+Shift+Z) after undo | | |
| 1.14 | Multiple undo steps (5+) | | |

## 2. Viewer

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 2.1 | Zoom in (Ctrl++) | | |
| 2.2 | Zoom out (Ctrl+-) | | |
| 2.3 | Zoom to 25% (minimum) | | |
| 2.4 | Zoom to 500% (maximum) | | |
| 2.5 | Fit to width | | |
| 2.6 | Fit to page | | |
| 2.7 | Reset zoom (Ctrl+0) | | |
| 2.8 | Navigate pages: next/prev buttons | | |
| 2.9 | Navigate pages: Page Up / Page Down | | |
| 2.10 | Navigate pages: Home (first) / End (last) | | |
| 2.11 | Navigate pages: thumbnail sidebar click | | |
| 2.12 | Navigate pages: page number input | | |
| 2.13 | Text selection on native text PDF | | |
| 2.14 | Text layer alignment matches rendered page | | |
| 2.15 | Outline/bookmarks panel shows TOC | | |
| 2.16 | Click outline entry navigates to page | | |

## 3. Annotations

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 3.1 | Draw tool: freehand drawing | | |
| 3.2 | Highlight tool: yellow highlight rectangle | | |
| 3.3 | Text tool: add text annotation | | |
| 3.4 | Shape: rectangle | | |
| 3.5 | Shape: ellipse | | |
| 3.6 | Shape: line | | |
| 3.7 | Shape: arrow | | |
| 3.8 | Stamp: place image stamp | | |
| 3.9 | Select and move annotation | | |
| 3.10 | Select and resize annotation | | |
| 3.11 | Delete selected annotation (Delete key) | | |
| 3.12 | Change annotation color via property panel | | |
| 3.13 | Change stroke width via property panel | | |
| 3.14 | Change opacity via property panel | | |
| 3.15 | Undo annotation creation | | |
| 3.16 | Redo annotation creation | | |
| 3.17 | Annotations persist across page navigation | | |
| 3.18 | Annotations survive save and re-open | | |

## 4. Page Operations

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 4.1 | Rotate page 90 degrees | | |
| 4.2 | Rotate page 180 degrees | | |
| 4.3 | Delete a page (not last page) | | |
| 4.4 | Cannot delete the only page | | |
| 4.5 | Reorder pages via drag in sidebar | | |
| 4.6 | Insert blank page after current | | |
| 4.7 | Duplicate a page | | |
| 4.8 | Insert pages from another PDF | | |
| 4.9 | Replace page with another PDF page | | |
| 4.10 | Crop page | | |
| 4.11 | Merge 2 PDFs into one | | |
| 4.12 | Merge 5 PDFs into one | | |
| 4.13 | Split PDF into page ranges | | |
| 4.14 | Split PDF into individual pages | | |

## 5. Export

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 5.1 | Export with annotations flattened | | |
| 5.2 | Export without annotations | | |
| 5.3 | Export save dialog works | | |
| 5.4 | Exported PDF is valid (opens in other readers) | | |
| 5.5 | Export page as image (PNG) | | |

## 6. OCR

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 6.1 | Start OCR on scanned document | | |
| 6.2 | OCR progress streaming (SSE updates) | | |
| 6.3 | OCR completion shows word count and confidence | | |
| 6.4 | OCR correction mode (edit detected text) | | |
| 6.5 | Cached OCR results load instantly on re-access | | |
| 6.6 | OCR on document with native text (skip or warn) | | |

## 7. Redaction

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 7.1 | Search for SSN pattern | | |
| 7.2 | Search for email pattern | | |
| 7.3 | Search for phone pattern | | |
| 7.4 | Search for credit card pattern | | |
| 7.5 | Search for date pattern | | |
| 7.6 | Search with custom regex | | |
| 7.7 | Review search results with highlights | | |
| 7.8 | Apply redaction to selected results | | |
| 7.9 | Verify redacted text is removed (not just covered) | | |
| 7.10 | Re-open redacted file -- text is permanently gone | | |
| 7.11 | Redaction on specific page range | | |

## 8. Legal Tools

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 8.1 | Bates numbering: default format | | |
| 8.2 | Bates numbering: custom prefix and start number | | |
| 8.3 | Bates numbering: specific page range | | |
| 8.4 | Headers/footers: static text in all 6 zones | | |
| 8.5 | Headers/footers: {page}/{pages} token | | |
| 8.6 | Headers/footers: {date} and {filename} tokens | | |
| 8.7 | Headers/footers: skip first page | | |
| 8.8 | Headers/footers: mirror mode (left/right swap on even pages) | | |
| 8.9 | Exhibit stamping: default format "Exhibit {num}" | | |
| 8.10 | Exhibit stamping: custom format and position | | |
| 8.11 | Page labels: set Roman numerals for intro pages | | |

## 9. Forms

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 9.1 | Detect form fields in a PDF with forms | | |
| 9.2 | Fill text field | | |
| 9.3 | Toggle checkbox | | |
| 9.4 | Select dropdown value | | |
| 9.5 | Flatten form (make fields non-editable) | | |
| 9.6 | Export form data as JSON | | |
| 9.7 | Import form data from JSON | | |
| 9.8 | PDF without forms shows "no fields detected" | | |

## 10. Signatures

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 10.1 | Draw signature with mouse/pen | | |
| 10.2 | Type signature with font selection | | |
| 10.3 | Upload signature image (PNG/JPEG) | | |
| 10.4 | Place signature on page | | |
| 10.5 | Resize placed signature | | |

## 11. Document Comparison

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 11.1 | Open two files for comparison | | |
| 11.2 | Side-by-side view | | |
| 11.3 | Detect modified pages | | |
| 11.4 | Detect added pages | | |
| 11.5 | Detect deleted pages | | |
| 11.6 | Identical files show all unchanged | | |

## 12. Security

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 12.1 | View PDF metadata | | |
| 12.2 | Edit PDF metadata (title, author) | | |
| 12.3 | Sanitize metadata (strip all) | | |
| 12.4 | Encrypt PDF with password | | |
| 12.5 | Set permissions (print yes, copy no) | | |
| 12.6 | Decrypt PDF with correct password | | |

## 13. UX and Accessibility

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 13.1 | Dark mode toggle | | |
| 13.2 | Dark mode persists across restart | | |
| 13.3 | System dark mode preference respected on first launch | | |
| 13.4 | All keyboard shortcuts work | | |
| 13.5 | Tab navigation through toolbar | | |
| 13.6 | Skip-to-content link visible on Tab | | |
| 13.7 | Focus trap in modal dialogs | | |
| 13.8 | Screen reader announcements for state changes | | |
| 13.9 | Onboarding tooltips show on first launch | | |
| 13.10 | Onboarding can be dismissed and does not reappear | | |
| 13.11 | Recent files list shows up to 10 items | | |
| 13.12 | Recent files can be removed individually | | |
| 13.13 | Find bar opens with Ctrl+F | | |
| 13.14 | Find bar: search, next, prev, close (Escape) | | |

## 14. Error Handling and Recovery

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 14.1 | Force-close app during edit -- file is recoverable | | |
| 14.2 | Force-close during export -- no corrupt output | | |
| 14.3 | Force-close during OCR -- can restart OCR | | |
| 14.4 | Backend sidecar crash -- app shows error, can retry | | |
| 14.5 | Open file that is locked by another process | | |
| 14.6 | Save to read-only location shows meaningful error | | |

## 15. Performance

| # | Test Case | Target | Result | Notes |
|---|-----------|--------|--------|-------|
| 15.1 | App launch to window visible | < 3s | | |
| 15.2 | Sidecar startup to health check | < 2s | | |
| 15.3 | Open 100 MB PDF | < 5s | | |
| 15.4 | Page navigation (next/prev) | < 500ms | | |
| 15.5 | Thumbnail generation per page | < 200ms | | |
| 15.6 | Page rotate/delete/reorder | < 3s | | |
| 15.7 | Export 100-page doc with annotations | < 10s | | |
| 15.8 | OCR per page | < 5s | | |
| 15.9 | Save 100 MB file | < 3s | | |

## 16. Platform Compatibility

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 16.1 | Install and run on Windows 10 (1809+) | | |
| 16.2 | Install and run on Windows 11 | | |
| 16.3 | WebView2 runtime available or bootstrapped | | |
| 16.4 | High-DPI display (150%, 200% scaling) | | |
| 16.5 | Multi-monitor setup | | |
