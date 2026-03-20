# Mudbrick v2 -- Performance Baseline

Template for recording performance measurements before release.

**Tester:** _______________
**Date:** _______________
**Build:** _______________
**Hardware:** _______________
**OS:** _______________

## Measurement Instructions

1. Use a stopwatch or browser DevTools performance timeline
2. Run each test 3 times and record the median
3. Use a cold start (app not running) for startup tests
4. Use a warm start (app already running) for operation tests
5. Test with the specified file sizes below

## Test Files

| File | Description | How to Generate |
|------|-------------|-----------------|
| small.pdf | 1 page, simple text | Any 1-page PDF |
| medium.pdf | 50 pages, mixed content | Merge multiple documents |
| large.pdf | 100+ MB, 200+ pages | Scan a large document or combine image-heavy PDFs |

**Note:** Large test files should not be committed to git. Generate them locally.

To generate a large test PDF programmatically:

```python
import fitz
doc = fitz.open()
for i in range(500):
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), f"Page {i+1} - " + "Lorem ipsum " * 50, fontsize=10)
doc.save("large_test.pdf")
doc.close()
```

## Startup Performance

| Metric | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|--------|-------|-------|-------|--------|-------|
| App launch to window visible | < 3s | | | | | |
| Sidecar startup to health check pass | < 2s | | | | | |
| Welcome screen fully rendered | < 3s | | | | | |

## File Operations

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| Open PDF | small.pdf | < 1s | | | | | |
| Open PDF | medium.pdf (50pg) | < 3s | | | | | |
| Open PDF | large.pdf (100MB+) | < 5s | | | | | |
| Create PDF from 10 images | image set | < 5s | | | | | |
| Save PDF | small.pdf | < 1s | | | | | |
| Save PDF | large.pdf (100MB+) | < 3s | | | | | |
| Save As (new path) | medium.pdf | < 2s | | | | | |
| First Save As on generated image PDF | generated-from-images.pdf | < 2s | | | | | |

## Navigation

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| Page next/prev | medium.pdf | < 500ms | | | | | |
| Page next/prev | large.pdf | < 500ms | | | | | |
| Jump to page (e.g., page 100) | large.pdf | < 1s | | | | | |
| Thumbnail render (per page) | medium.pdf | < 200ms | | | | | |
| Thumbnail render (per page) | large.pdf | < 200ms | | | | | |
| Sidebar thumbnail scroll (smooth) | large.pdf | subjective | | | | | |

## Page Operations

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| Rotate single page | medium.pdf | < 2s | | | | | |
| Delete single page | medium.pdf | < 2s | | | | | |
| Reorder pages (5 pages) | medium.pdf | < 3s | | | | | |
| Insert blank page | medium.pdf | < 2s | | | | | |
| Merge 2 files (50pg each) | medium.pdf x2 | < 5s | | | | | |
| Split into 5 parts | medium.pdf | < 5s | | | | | |

## Export

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| Export without annotations | medium.pdf | < 3s | | | | | |
| Export with 10 annotations | medium.pdf | < 5s | | | | | |
| Export with annotations | large.pdf (100pg) | < 10s | | | | | |
| Export page as PNG | single page | < 1s | | | | | |

## Document Utilities

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| Optimize PDF | medium.pdf | < 3s | | | | | |
| Add 5 MB attachment | medium.pdf | < 2s | | | | | |
| Export 5 MB attachment | medium.pdf | < 1s | | | | | |
| Remove attachment | medium.pdf | < 1s | | | | | |

## OCR

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| OCR single page (300 DPI) | scanned.pdf | < 5s | | | | | |
| OCR 10 pages (300 DPI) | scanned 10pg | < 50s | | | | | |
| Load cached OCR results | any | < 500ms | | | | | |

## Redaction

| Metric | File | Target | Run 1 | Run 2 | Run 3 | Median | Pass? |
|--------|------|--------|-------|-------|-------|--------|-------|
| Search SSN pattern (50 pages) | medium.pdf | < 3s | | | | | |
| Apply 10 redactions | medium.pdf | < 5s | | | | | |

## Memory Usage

| Metric | File | Target | Measurement | Pass? |
|--------|------|--------|-------------|-------|
| Idle (no document) | - | < 100 MB | | |
| With small PDF open | small.pdf | < 200 MB | | |
| With large PDF open | large.pdf (100MB+) | < 500 MB | | |
| After 10 page operations | medium.pdf | < 400 MB | | |
| After closing document | - | returns near idle | | |

## Notes

_Record any observations, anomalies, or concerns below:_

---
---
---
