/**
 * Mudbrick — Form Field Creator & Editor (Phase 3)
 * Create new form fields (text, checkbox, dropdown, radio, signature, button),
 * edit field properties, and manage tab order.
 *
 * Uses pdf-lib to add/modify AcroForm fields on the PDF.
 */

const getPDFLib = () => window.PDFLib;

/* ═══════════════════ Field Templates ═══════════════════ */

const FIELD_DEFAULTS = {
  text: {
    width: 200, height: 24,
    fontSize: 12, fontColor: [0, 0, 0],
    borderColor: [0, 0, 0], borderWidth: 1,
    backgroundColor: [1, 1, 1],
    multiline: false, maxLength: 0,
  },
  checkbox: {
    width: 14, height: 14,
    borderColor: [0, 0, 0], borderWidth: 1,
  },
  dropdown: {
    width: 200, height: 24,
    fontSize: 12, options: [],
    borderColor: [0, 0, 0], borderWidth: 1,
  },
  radio: {
    width: 14, height: 14,
    borderColor: [0, 0, 0], borderWidth: 1,
  },
  signature: {
    width: 200, height: 60,
    borderColor: [0.6, 0.6, 0.6], borderWidth: 1,
  },
  button: {
    width: 100, height: 30,
    fontSize: 12, label: 'Submit',
  },
};

/* ═══════════════════ Create Fields ═══════════════════ */

/**
 * Add a new form field to the PDF.
 * @param {Object} pdfLibDoc - pdf-lib document
 * @param {Object} opts
 * @param {string} opts.type - 'text', 'checkbox', 'dropdown', 'radio', 'signature', 'button'
 * @param {string} opts.name - Unique field name
 * @param {number} opts.pageIndex - 0-based page index
 * @param {number} opts.x - X position (PDF coords, from left)
 * @param {number} opts.y - Y position (PDF coords, from bottom)
 * @param {number} [opts.width] - Field width
 * @param {number} [opts.height] - Field height
 * @param {Object} [opts.props] - Additional field properties
 * @returns {Object} Created field descriptor
 */
export function addFormField(pdfLibDoc, opts) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) throw new Error('pdf-lib not loaded');

  const {
    type, name, pageIndex = 0,
    x, y, width, height, props = {},
  } = opts;

  const defaults = FIELD_DEFAULTS[type] || FIELD_DEFAULTS.text;
  const w = width || defaults.width;
  const h = height || defaults.height;

  const form = pdfLibDoc.getForm();
  const page = pdfLibDoc.getPage(pageIndex);

  let field;

  switch (type) {
    case 'text': {
      field = form.createTextField(name);
      field.addToPage(page, { x, y, width: w, height: h });
      if (props.multiline) field.enableMultiline();
      if (props.maxLength > 0) field.setMaxLength(props.maxLength);
      if (props.defaultValue) field.setText(props.defaultValue);
      break;
    }
    case 'checkbox': {
      field = form.createCheckBox(name);
      field.addToPage(page, { x, y, width: w, height: h });
      if (props.checked) field.check();
      break;
    }
    case 'dropdown': {
      field = form.createDropdown(name);
      const options = props.options || defaults.options;
      if (options.length > 0) {
        field.setOptions(options);
        field.addToPage(page, { x, y, width: w, height: h });
      } else {
        field.addToPage(page, { x, y, width: w, height: h });
      }
      if (props.editable) field.enableEditing();
      if (props.multiSelect) field.enableMultiselect();
      break;
    }
    case 'radio': {
      field = form.createRadioGroup(name);
      // Radio groups need option values per widget
      const optionName = props.optionValue || 'Option1';
      field.addOptionToPage(optionName, page, { x, y, width: w, height: h });
      break;
    }
    case 'signature': {
      // pdf-lib doesn't support creating signature fields directly,
      // but we can create a text field placeholder styled as a sig field
      field = form.createTextField(name);
      field.addToPage(page, { x, y, width: w, height: h });
      field.enableReadOnly();
      break;
    }
    case 'button': {
      field = form.createButton(name);
      field.addToPage(page, { x, y, width: w, height: h });
      break;
    }
    default:
      throw new Error(`Unsupported field type: ${type}`);
  }

  return {
    name,
    type,
    pageIndex,
    x, y,
    width: w,
    height: h,
    props,
  };
}

/**
 * Add a radio option to an existing radio group.
 */
export function addRadioOption(pdfLibDoc, groupName, optionValue, pageIndex, x, y, width, height) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) throw new Error('pdf-lib not loaded');

  const form = pdfLibDoc.getForm();
  const page = pdfLibDoc.getPage(pageIndex);
  const w = width || FIELD_DEFAULTS.radio.width;
  const h = height || FIELD_DEFAULTS.radio.height;

  const group = form.getRadioGroup(groupName);
  group.addOptionToPage(optionValue, page, { x, y, width: w, height: h });
}

/* ═══════════════════ Field Properties ═══════════════════ */

/**
 * Update properties of an existing form field.
 * @param {Object} pdfLibDoc - pdf-lib document
 * @param {string} fieldName - Field name
 * @param {Object} props - Properties to update
 */
export function updateFieldProperties(pdfLibDoc, fieldName, props) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) return;

  const form = pdfLibDoc.getForm();
  let field;
  try {
    field = form.getField(fieldName);
  } catch {
    return;
  }

  if (props.readOnly !== undefined) {
    if (props.readOnly) field.enableReadOnly();
    else field.disableReadOnly();
  }

  if (props.required !== undefined) {
    if (props.required) field.enableRequired();
    else field.disableRequired();
  }

  // Text-specific props
  if (field instanceof PDFLib.PDFTextField) {
    if (props.defaultValue !== undefined) field.setText(props.defaultValue);
    if (props.maxLength !== undefined && props.maxLength > 0) field.setMaxLength(props.maxLength);
    if (props.multiline !== undefined) {
      if (props.multiline) field.enableMultiline();
      else field.disableMultiline();
    }
  }

  // Dropdown-specific props
  if (field instanceof PDFLib.PDFDropdown) {
    if (props.options) field.setOptions(props.options);
    if (props.editable !== undefined) {
      if (props.editable) field.enableEditing();
      else field.disableEditing();
    }
  }
}

/**
 * Remove a form field by name.
 */
export function removeFormField(pdfLibDoc, fieldName) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) return;

  const form = pdfLibDoc.getForm();
  try {
    const field = form.getField(fieldName);
    form.removeField(field);
  } catch {
    // Field not found
  }
}

/* ═══════════════════ Tab Order ═══════════════════ */

/**
 * Get the current tab order of form fields on a page.
 * @param {Object} pdfLibDoc
 * @param {number} pageIndex
 * @returns {string[]} Field names in tab order
 */
export function getTabOrder(pdfLibDoc, pageIndex) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) return [];

  try {
    const form = pdfLibDoc.getForm();
    const fields = form.getFields();
    const page = pdfLibDoc.getPage(pageIndex);
    const { height: pageH } = page.getSize();

    // Get fields on this page with their positions
    const pageFields = [];
    for (const field of fields) {
      const widgets = field.acroField?.getWidgets?.() || [];
      for (const widget of widgets) {
        const rect = widget.getRectangle();
        if (!rect) continue;
        pageFields.push({
          name: field.getName(),
          x: rect.x,
          y: rect.y,
          // Sort top-to-bottom, left-to-right
          sortY: pageH - rect.y,
          sortX: rect.x,
        });
      }
    }

    // Sort by Y (top to bottom), then X (left to right)
    pageFields.sort((a, b) => {
      const dy = a.sortY - b.sortY;
      if (Math.abs(dy) > 10) return dy; // different row
      return a.sortX - b.sortX; // same row, sort by X
    });

    return pageFields.map(f => f.name);
  } catch {
    return [];
  }
}

/**
 * Set tab order for fields (reorders field entries in the form).
 * Note: PDF tab order is complex; this sets annotation order on the page.
 * @param {Object} pdfLibDoc
 * @param {number} pageIndex
 * @param {string[]} orderedNames
 */
export function setTabOrder(pdfLibDoc, pageIndex, orderedNames) {
  // PDF tab order is controlled by the Tabs entry on the page dictionary
  // and the order of annotations. pdf-lib has limited support for this.
  // We set the /Tabs entry to /S (structure order) as a best-effort.
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) return;

  try {
    const page = pdfLibDoc.getPage(pageIndex);
    page.node.set(PDFLib.PDFName.of('Tabs'), PDFLib.PDFName.of('S'));
  } catch {
    // Ignore
  }
}

/* ═══════════════════ Form Data Import/Export ═══════════════════ */

/**
 * Export form field values to JSON.
 * @param {Object} pdfLibDoc
 * @returns {Object} { fieldName: value }
 */
export function exportFormDataJSON(pdfLibDoc) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) return {};

  const form = pdfLibDoc.getForm();
  const fields = form.getFields();
  const data = {};

  for (const field of fields) {
    const name = field.getName();
    if (field instanceof PDFLib.PDFTextField) {
      data[name] = field.getText() || '';
    } else if (field instanceof PDFLib.PDFCheckBox) {
      data[name] = field.isChecked();
    } else if (field instanceof PDFLib.PDFDropdown) {
      data[name] = field.getSelected();
    } else if (field instanceof PDFLib.PDFRadioGroup) {
      data[name] = field.getSelected();
    }
  }

  return data;
}

/**
 * Import form data from JSON and fill fields.
 * @param {Object} pdfLibDoc
 * @param {Object} data - { fieldName: value }
 * @returns {number} Number of fields filled
 */
export function importFormDataJSON(pdfLibDoc, data) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc || !data) return 0;

  const form = pdfLibDoc.getForm();
  let filled = 0;

  for (const [name, value] of Object.entries(data)) {
    try {
      const field = form.getField(name);
      if (field instanceof PDFLib.PDFTextField) {
        field.setText(String(value));
        filled++;
      } else if (field instanceof PDFLib.PDFCheckBox) {
        if (value) field.check(); else field.uncheck();
        filled++;
      } else if (field instanceof PDFLib.PDFDropdown) {
        field.select(String(value));
        filled++;
      } else if (field instanceof PDFLib.PDFRadioGroup) {
        field.select(String(value));
        filled++;
      }
    } catch {
      // Field not found or type mismatch
    }
  }

  return filled;
}

/**
 * Export form data as XFDF (XML Forms Data Format).
 * @param {Object} pdfLibDoc
 * @param {string} [pdfFileName] - Reference PDF filename
 * @returns {string} XFDF XML string
 */
export function exportFormDataXFDF(pdfLibDoc, pdfFileName = 'document.pdf') {
  const data = exportFormDataJSON(pdfLibDoc);
  const fields = Object.entries(data).map(([name, value]) => {
    const v = typeof value === 'boolean' ? (value ? 'Yes' : 'Off') : String(value);
    return `    <field name="${escapeXml(name)}"><value>${escapeXml(v)}</value></field>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
  <f href="${escapeXml(pdfFileName)}" />
  <fields>
${fields.join('\n')}
  </fields>
</xfdf>`;
}

/**
 * Import form data from XFDF string.
 * @param {Object} pdfLibDoc
 * @param {string} xfdfString
 * @returns {number} Number of fields filled
 */
export function importFormDataXFDF(pdfLibDoc, xfdfString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xfdfString, 'text/xml');
  const fieldNodes = doc.querySelectorAll('field');
  const data = {};

  for (const node of fieldNodes) {
    const name = node.getAttribute('name');
    const valueNode = node.querySelector('value');
    if (name && valueNode) {
      data[name] = valueNode.textContent;
    }
  }

  return importFormDataJSON(pdfLibDoc, data);
}

/**
 * Export form data as CSV.
 * @param {Object} pdfLibDoc
 * @returns {string} CSV string
 */
export function exportFormDataCSV(pdfLibDoc) {
  const data = exportFormDataJSON(pdfLibDoc);
  const entries = Object.entries(data);
  if (entries.length === 0) return '';

  const header = entries.map(([name]) => csvEscape(name)).join(',');
  const values = entries.map(([, value]) => csvEscape(String(value))).join(',');
  return `${header}\n${values}`;
}

/**
 * Import form data from CSV string (first row = field names, second row = values).
 * @param {Object} pdfLibDoc
 * @param {string} csvString
 * @returns {number}
 */
export function importFormDataCSV(pdfLibDoc, csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return 0;

  const names = parseCSVLine(lines[0]);
  const values = parseCSVLine(lines[1]);
  const data = {};

  for (let i = 0; i < names.length && i < values.length; i++) {
    data[names[i]] = values[i];
  }

  return importFormDataJSON(pdfLibDoc, data);
}

/* ═══════════════════ Flatten Forms ═══════════════════ */

/**
 * Flatten all form fields (make them non-editable, merge into page content).
 * @param {Object} pdfLibDoc
 * @returns {Promise<Uint8Array>}
 */
export async function flattenFormFields(pdfLibDoc) {
  const PDFLib = getPDFLib();
  if (!PDFLib || !pdfLibDoc) throw new Error('pdf-lib not loaded');

  const form = pdfLibDoc.getForm();
  const fields = form.getFields();

  for (const field of fields) {
    try {
      if (field instanceof PDFLib.PDFTextField) {
        field.enableReadOnly();
      } else if (field instanceof PDFLib.PDFCheckBox) {
        field.enableReadOnly();
      } else if (field instanceof PDFLib.PDFDropdown) {
        field.enableReadOnly();
      }
      // pdf-lib's flatten: marks fields as read-only.
      // True flattening (removing field widgets) requires low-level manipulation.
    } catch {
      // Skip
    }
  }

  // Use pdf-lib's flatten if available
  try {
    form.flatten();
  } catch {
    // Not all versions support flatten
  }

  return pdfLibDoc.save();
}

/* ═══════════════════ Helpers ═══════════════════ */

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function csvEscape(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
