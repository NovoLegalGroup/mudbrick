/**
 * Mudbrick — Integration helpers for embedding in external dashboards.
 * Parses launch params and handles save-back callbacks.
 */

// Allowed callback origins. Requests to other origins are blocked to prevent
// a crafted Mudbrick URL from making the user's browser POST a PDF to an
// arbitrary server. Update this list when new environments are added.
const ALLOWED_CALLBACK_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*novo-legal\.com$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^https?:\/\/localhost(:\d+)?$/,
];

/**
 * Check whether a URL string's origin matches our allowlist.
 * @param {string} urlString
 * @returns {boolean}
 */
export function isAllowedCallbackOrigin(urlString) {
  try {
    const { origin } = new URL(urlString);
    return ALLOWED_CALLBACK_ORIGINS.some(re => re.test(origin));
  } catch {
    return false;
  }
}

/**
 * Parse query params into an integration config object.
 * Returns null if no fileUrl (i.e. Mudbrick was opened standalone).
 */
export function parseIntegrationParams() {
  const params = new URLSearchParams(window.location.search);
  const fileUrl = params.get('fileUrl') || params.get('url');
  if (!fileUrl) return null;

  const callbackUrl = params.get('callbackUrl') || '';

  return {
    fileUrl,
    woId: params.get('woId') || '',
    docId: params.get('docId') || '',
    callbackUrl: callbackUrl && isAllowedCallbackOrigin(callbackUrl) ? callbackUrl : '',
    returnUrl: params.get('returnUrl') || '',
    fileName: params.get('fileName') || fileUrl.split('/').pop()?.split('?')[0] || 'document.pdf',
  };
}

/**
 * POST saved PDF bytes back to callbackUrl as multipart/form-data.
 * @param {string} callbackUrl - URL to POST to
 * @param {Uint8Array} pdfBytes - Saved PDF bytes
 * @param {Object} meta - { woId, docId, fileName }
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function postToCallback(callbackUrl, pdfBytes, { woId, docId, fileName }) {
  const form = new FormData();
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), fileName);
  form.append('fileName', fileName);
  // Send the appropriate ID depending on the callback context
  if (docId) form.append('docId', docId);
  if (woId) form.append('woId', woId);

  const resp = await fetch(callbackUrl, { method: 'POST', body: form });
  if (!resp.ok) throw new Error(`Callback failed: HTTP ${resp.status}`);
  return resp.json();
}
