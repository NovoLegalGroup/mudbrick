/**
 * Mudbrick — Redaction Search Patterns (Phase 3)
 * Auto-detect sensitive data (SSN, credit cards, emails, phone numbers)
 * and create redaction rectangles over matching text.
 *
 * Works with the existing text layer (PDF.js text content items)
 * and OCR results to find text positions, then creates Fabric.js
 * redaction rectangles.
 */

/* ═══════════════════ Pattern Definitions ═══════════════════ */

export const REDACTION_PATTERNS = {
  ssn: {
    label: 'Social Security Numbers',
    description: 'XXX-XX-XXXX format',
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    validate: (match) => {
      const digits = match.replace(/[-\s]/g, '');
      if (digits.length !== 9) return false;
      // SSN cannot start with 000, 666, or 9xx
      const area = parseInt(digits.substring(0, 3));
      if (area === 0 || area === 666 || area >= 900) return false;
      // Group and serial cannot be 0000
      if (digits.substring(3, 5) === '00') return false;
      if (digits.substring(5) === '0000') return false;
      return true;
    },
  },
  creditCard: {
    label: 'Credit Card Numbers',
    description: 'Visa, Mastercard, Amex, Discover',
    regex: /\b(?:\d{4}[-\s]?){3}\d{1,4}\b/g,
    validate: (match) => {
      const digits = match.replace(/[-\s]/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      // Luhn check
      return luhnCheck(digits);
    },
  },
  email: {
    label: 'Email Addresses',
    description: 'user@domain.com',
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    validate: () => true,
  },
  phone: {
    label: 'Phone Numbers',
    description: 'US formats: (555) 123-4567, 555-123-4567, +1 555 123 4567',
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    },
  },
  date: {
    label: 'Dates',
    description: 'MM/DD/YYYY, MM-DD-YYYY, Month DD, YYYY',
    regex: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi,
    validate: () => true,
  },
  custom: {
    label: 'Custom Pattern',
    description: 'Enter your own regex or text to find',
    regex: null, // set dynamically
    validate: () => true,
  },
};

/* ═══════════════════ Pattern Search ═══════════════════ */

/**
 * Search for patterns in text content across all pages.
 * @param {Object} pdfDoc - PDF.js document
 * @param {string[]} patternNames - Which patterns to search for
 * @param {string} [customPattern] - Custom regex string (when 'custom' is in patternNames)
 * @returns {Promise<Array>} Matches with page numbers and text positions
 */
export async function searchPatterns(pdfDoc, patternNames, customPattern) {
  if (!pdfDoc) return [];

  const results = [];
  const pageCount = pdfDoc.numPages;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    // Build full text for the page with character position mapping
    const { fullText, charMap } = buildCharMap(textContent.items, viewport);

    for (const patternName of patternNames) {
      const pattern = REDACTION_PATTERNS[patternName];
      if (!pattern) continue;

      let regex = pattern.regex;
      if (patternName === 'custom' && customPattern) {
        try {
          regex = new RegExp(customPattern, 'gi');
        } catch {
          // Invalid regex — treat as literal
          regex = new RegExp(escapeRegex(customPattern), 'gi');
        }
      }
      if (!regex) continue;

      // Reset regex state
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        const matchText = match[0];

        // Validate match
        if (pattern.validate && !pattern.validate(matchText)) continue;

        // Get bounding rectangles for this match
        const startIdx = match.index;
        const endIdx = startIdx + matchText.length;
        const rects = getRectsForRange(charMap, startIdx, endIdx);

        if (rects.length > 0) {
          results.push({
            pageNum,
            pattern: patternName,
            text: matchText,
            rects, // [{ x, y, width, height }] in PDF coordinates
          });
        }
      }
    }
  }

  return results;
}

/**
 * Build a character-level position map from text content items.
 * Returns { fullText, charMap } where charMap[charIndex] = { x, y, w, h, item }
 */
function buildCharMap(items, viewport) {
  let fullText = '';
  const charMap = [];

  for (const item of items) {
    if (!item.str) {
      fullText += ' ';
      charMap.push(null);
      continue;
    }

    const tx = window.pdfjsLib?.Util?.transform?.(viewport.transform, item.transform)
      || transformPoint(viewport.transform, item.transform);

    const x = tx[4];
    const y = tx[5];
    const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
    const avgCharWidth = item.width / (item.str.length || 1);

    for (let i = 0; i < item.str.length; i++) {
      charMap.push({
        x: x + avgCharWidth * i,
        y: y - fontSize,
        w: avgCharWidth,
        h: fontSize,
      });
    }

    fullText += item.str;
    // Add space between items
    fullText += ' ';
    charMap.push(null);
  }

  return { fullText, charMap };
}

function transformPoint(viewportTransform, textTransform) {
  // Simplified matrix multiplication for [a,b,c,d,e,f] transforms
  const [a, b, c, d, e, f] = viewportTransform;
  const [ta, tb, tc, td, te, tf] = textTransform;
  return [
    a * ta + c * tb,
    b * ta + d * tb,
    a * tc + c * td,
    b * tc + d * td,
    a * te + c * tf + e,
    b * te + d * tf + f,
  ];
}

/**
 * Get bounding rectangles for a character range in the char map.
 */
function getRectsForRange(charMap, startIdx, endIdx) {
  const rects = [];
  let currentRect = null;

  for (let i = startIdx; i < endIdx && i < charMap.length; i++) {
    const pos = charMap[i];
    if (!pos) {
      if (currentRect) {
        rects.push(currentRect);
        currentRect = null;
      }
      continue;
    }

    if (!currentRect) {
      currentRect = { x: pos.x, y: pos.y, width: pos.w, height: pos.h };
    } else {
      // Extend current rect if on same line
      if (Math.abs(pos.y - currentRect.y) < pos.h * 0.5) {
        const newRight = pos.x + pos.w;
        currentRect.width = newRight - currentRect.x;
        currentRect.height = Math.max(currentRect.height, pos.h);
      } else {
        rects.push(currentRect);
        currentRect = { x: pos.x, y: pos.y, width: pos.w, height: pos.h };
      }
    }
  }

  if (currentRect) rects.push(currentRect);
  return rects;
}

/* ═══════════════════ Helpers ═══════════════════ */

function luhnCheck(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
