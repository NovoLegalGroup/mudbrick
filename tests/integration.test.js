import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseIntegrationParams, postToCallback, isAllowedCallbackOrigin } from '../js/integration.js';

/* ═══════════════════ isAllowedCallbackOrigin ═══════════════════ */

describe('isAllowedCallbackOrigin', () => {
  it('allows novo-legal.com subdomains', () => {
    expect(isAllowedCallbackOrigin('https://dashboard.novo-legal.com/api/callback')).toBe(true);
    expect(isAllowedCallbackOrigin('https://staging.novo-legal.com/api/callback')).toBe(true);
  });

  it('allows Vercel preview deploys', () => {
    expect(isAllowedCallbackOrigin('https://my-app-abc123.vercel.app/api/callback')).toBe(true);
  });

  it('allows localhost with port', () => {
    expect(isAllowedCallbackOrigin('http://localhost:3000/api/callback')).toBe(true);
    expect(isAllowedCallbackOrigin('https://localhost:8080/api/callback')).toBe(true);
  });

  it('allows localhost without port', () => {
    expect(isAllowedCallbackOrigin('http://localhost/api/callback')).toBe(true);
  });

  it('rejects arbitrary origins', () => {
    expect(isAllowedCallbackOrigin('https://evil.com/steal')).toBe(false);
    expect(isAllowedCallbackOrigin('https://not-novo-legal.com/api')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedCallbackOrigin('not-a-url')).toBe(false);
    expect(isAllowedCallbackOrigin('')).toBe(false);
  });
});

/* ═══════════════════ parseIntegrationParams ═══════════════════ */

describe('parseIntegrationParams', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  function setSearch(search) {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search },
      writable: true,
      configurable: true,
    });
  }

  it('returns null when no fileUrl or url param', () => {
    setSearch('');
    expect(parseIntegrationParams()).toBeNull();
  });

  it('returns null when only unrelated params', () => {
    setSearch('?woId=123&callbackUrl=http://localhost:3000');
    expect(parseIntegrationParams()).toBeNull();
  });

  it('parses fileUrl with all params (work order)', () => {
    setSearch('?fileUrl=https://example.com/doc.pdf&woId=wo-123&callbackUrl=http://localhost:3000/api/cb&returnUrl=http://localhost:3000/orders/123&fileName=my-form.pdf');
    const result = parseIntegrationParams();
    expect(result).toEqual({
      fileUrl: 'https://example.com/doc.pdf',
      woId: 'wo-123',
      docId: '',
      callbackUrl: 'http://localhost:3000/api/cb',
      returnUrl: 'http://localhost:3000/orders/123',
      fileName: 'my-form.pdf',
    });
  });

  it('parses fileUrl with docId (case document)', () => {
    setSearch('?fileUrl=https://example.com/doc.pdf&docId=doc-456&callbackUrl=http://localhost:3000/api/cb&returnUrl=http://localhost:3000/cases/123&fileName=evidence.pdf');
    const result = parseIntegrationParams();
    expect(result).toEqual({
      fileUrl: 'https://example.com/doc.pdf',
      woId: '',
      docId: 'doc-456',
      callbackUrl: 'http://localhost:3000/api/cb',
      returnUrl: 'http://localhost:3000/cases/123',
      fileName: 'evidence.pdf',
    });
  });

  it('falls back to url param for backward compatibility', () => {
    setSearch('?url=https://example.com/legacy.pdf');
    const result = parseIntegrationParams();
    expect(result.fileUrl).toBe('https://example.com/legacy.pdf');
  });

  it('prefers fileUrl over url', () => {
    setSearch('?fileUrl=https://example.com/new.pdf&url=https://example.com/old.pdf');
    const result = parseIntegrationParams();
    expect(result.fileUrl).toBe('https://example.com/new.pdf');
  });

  it('strips query params from URL for default fileName', () => {
    setSearch('?fileUrl=https://xxx.supabase.co/storage/v1/object/sign/wo-files/form.pdf?token=abc123');
    const result = parseIntegrationParams();
    expect(result.fileName).toBe('form.pdf');
  });

  it('defaults woId and docId to empty string', () => {
    setSearch('?fileUrl=https://example.com/doc.pdf');
    const result = parseIntegrationParams();
    expect(result.woId).toBe('');
    expect(result.docId).toBe('');
  });

  it('strips callbackUrl when origin is not allowed', () => {
    setSearch('?fileUrl=https://example.com/doc.pdf&callbackUrl=https://evil.com/steal');
    const result = parseIntegrationParams();
    expect(result.callbackUrl).toBe('');
  });

  it('preserves callbackUrl when origin is allowed', () => {
    setSearch('?fileUrl=https://example.com/doc.pdf&callbackUrl=https://dashboard.novo-legal.com/api/cb');
    const result = parseIntegrationParams();
    expect(result.callbackUrl).toBe('https://dashboard.novo-legal.com/api/cb');
  });
});

/* ═══════════════════ postToCallback ═══════════════════ */

describe('postToCallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs multipart form data with file, woId, and fileName', async () => {
    const mockResponse = { id: 'file-456', version: 2 };
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const pdfBytes = new Uint8Array([37, 80, 68, 70]); // %PDF
    const result = await postToCallback(
      'http://localhost:3000/api/callback',
      pdfBytes,
      { woId: 'wo-123', fileName: 'form.pdf' },
    );

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/callback');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);

    const formData = opts.body;
    expect(formData.get('woId')).toBe('wo-123');
    expect(formData.get('fileName')).toBe('form.pdf');
    expect(formData.get('file')).toBeInstanceOf(Blob);

    expect(result).toEqual(mockResponse);
  });

  it('POSTs multipart form data with docId for case documents', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ document: { id: 'doc-456' } }),
    });

    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    await postToCallback(
      'http://localhost:3000/api/callback',
      pdfBytes,
      { docId: 'doc-456', fileName: 'evidence.pdf' },
    );

    const [, opts] = fetch.mock.calls[0];
    const formData = opts.body;
    expect(formData.get('docId')).toBe('doc-456');
    expect(formData.get('fileName')).toBe('evidence.pdf');
    expect(formData.get('woId')).toBeNull(); // not sent when empty
  });

  it('throws on HTTP error', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      postToCallback('http://localhost:3000/api/callback', new Uint8Array(), {
        woId: 'wo-123',
        fileName: 'form.pdf',
      }),
    ).rejects.toThrow('Callback failed: HTTP 500');
  });

  it('throws on network error', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      postToCallback('http://localhost:3000/api/callback', new Uint8Array(), {
        woId: 'wo-123',
        fileName: 'form.pdf',
      }),
    ).rejects.toThrow('Failed to fetch');
  });
});
