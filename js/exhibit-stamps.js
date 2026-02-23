/**
 * Mudbrick — Exhibit Stamps
 * Legal exhibit stickers with auto-incrementing numbering.
 * Follows the stamp pattern from annotations.js but with structured layout.
 */

/* ═══════════════════ Format Helpers ═══════════════════ */

const FORMATS = {
  letter:      { label: 'A, B, C...', fn: n => String.fromCharCode(64 + n) },           // A=1, B=2
  number:      { label: '1, 2, 3...', fn: n => String(n) },
  'roman-upper': { label: 'I, II, III...', fn: n => toRoman(n) },
  'roman-lower': { label: 'i, ii, iii...', fn: n => toRoman(n).toLowerCase() },
};

function toRoman(num) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
  }
  return result;
}

export { FORMATS as EXHIBIT_FORMATS };

/* ═══════════════════ State ═══════════════════ */

let _exhibitCount = 0;     // running count for auto-numbering
let _currentFormat = 'letter';
let _customPrefix = '';
let _includeDate = true;

export function resetExhibitCount() { _exhibitCount = 0; }
export function getExhibitCount() { return _exhibitCount; }
export function setExhibitOptions(format, prefix, includeDate) {
  _currentFormat = format || 'letter';
  _customPrefix = prefix || '';
  _includeDate = includeDate !== false;
}

/* ═══════════════════ Next Label ═══════════════════ */

/**
 * Scan all page annotations to count existing exhibit stamps, return next label.
 * @param {Object} pageAnnotations - Map of pageNum → JSON strings
 * @returns {number} Next exhibit number (1-based)
 */
export function countExistingExhibits(pageAnnotations) {
  let count = 0;
  for (const json of Object.values(pageAnnotations || {})) {
    if (!json) continue;
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const objects = data.objects || data;
      if (Array.isArray(objects)) {
        count += objects.filter(o => o.mudbrickType === 'exhibit-stamp').length;
      }
    } catch { /* skip malformed */ }
  }
  return count;
}

function formatLabel(num) {
  const fmt = FORMATS[_currentFormat] || FORMATS.letter;
  return _customPrefix + fmt.fn(num);
}

/* ═══════════════════ Add Exhibit Stamp ═══════════════════ */

/**
 * Add an exhibit stamp to the Fabric canvas.
 * @param {fabric.Canvas} canvas - Active Fabric canvas
 * @param {number} x - Canvas X
 * @param {number} y - Canvas Y
 * @param {number} zoom - Current zoom
 * @param {Object} [opts] - Override options
 * @returns {fabric.Group} The created stamp group
 */
export function addExhibitStamp(canvas, x, y, zoom, opts = {}) {
  const fabric = window.fabric;
  if (!fabric || !canvas) return null;

  _exhibitCount++;
  const num = opts.number || _exhibitCount;
  const label = opts.label || formatLabel(num);
  const dateStr = _includeDate ? new Date().toLocaleDateString('en-US') : '';
  const color = '#1565c0';
  const scale = zoom || 1;

  // "EXHIBIT" header
  const header = new fabric.Text('EXHIBIT', {
    originX: 'center',
    originY: 'top',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 14 * scale,
    fontWeight: 'bold',
    fill: color,
  });

  // Large label (A, B, 1, 2, I, II, etc.)
  const labelText = new fabric.Text(label, {
    originX: 'center',
    originY: 'top',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 28 * scale,
    fontWeight: 'bold',
    fill: color,
  });

  // Date line (optional)
  const dateLine = _includeDate ? new fabric.Text(dateStr, {
    originX: 'center',
    originY: 'top',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 10 * scale,
    fill: '#666',
  }) : null;

  // Stack layout: header → label → date
  const padding = 8 * scale;
  const gap = 4 * scale;
  let totalH = header.height + gap + labelText.height;
  if (dateLine) totalH += gap + dateLine.height;
  const maxW = Math.max(header.width, labelText.width, dateLine ? dateLine.width : 0);
  const boxW = maxW + padding * 2;
  const boxH = totalH + padding * 2;

  // Position items relative to center
  let yOff = -boxH / 2 + padding;
  header.set({ left: 0, top: yOff });
  yOff += header.height + gap;
  labelText.set({ left: 0, top: yOff });
  yOff += labelText.height + gap;
  if (dateLine) dateLine.set({ left: 0, top: yOff });

  // Border rectangle
  const border = new fabric.Rect({
    originX: 'center',
    originY: 'center',
    width: boxW,
    height: boxH,
    fill: 'rgba(255,255,255,0.92)',
    stroke: color,
    strokeWidth: 2 * scale,
    rx: 4 * scale,
    ry: 4 * scale,
  });

  const items = [border, header, labelText];
  if (dateLine) items.push(dateLine);

  const group = new fabric.Group(items, {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
    mudbrickType: 'exhibit-stamp',
    exhibitNumber: num,
    exhibitFormat: _currentFormat,
    exhibitLabel: label,
  });

  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.renderAll();
  return group;
}
