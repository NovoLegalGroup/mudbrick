# Mudbrick — Dashboard Integration Guide

Answers to the four integration questions from the Novo Legal dashboard team, plus setup instructions.

---

## Q1 — URL Contract

Mudbrick accepts query parameters to load a remote PDF on launch:

```
https://<mudbrick-host>/?fileUrl=<signedUrl>&woId=<id>&callbackUrl=<url>&returnUrl=<url>&fileName=<name>
```

| Param | Required | Description |
|---|---|---|
| `fileUrl` | **Yes** | Signed URL to the PDF. Also accepts `url` for backward compatibility. |
| `woId` | No | Work order ID. Echoed back in the callback POST body. |
| `callbackUrl` | No | URL to POST the saved PDF to. Must match an allowed origin (see Security below). |
| `returnUrl` | No | Dashboard URL shown as a clickable link after a successful save-back. |
| `fileName` | No | Display name for the file in the editor tab. Defaults to the URL's basename. |

### Example

```
https://mudbrick.app/?fileUrl=https://xxx.supabase.co/storage/v1/object/sign/wo-files/tenant/wo-123/draft/form.pdf?token=abc&woId=wo-123&callbackUrl=https://dashboard.novo-legal.com/api/production/files/mudbrick-callback&returnUrl=https://dashboard.novo-legal.com/production/work-orders/wo-123&fileName=I-130_draft.pdf
```

**Important:** URL-encode the `fileUrl` value since it contains its own query parameters.

---

## Q2 — Save / Callback Mechanism

**Webhook POST.** When the user saves (Ctrl+S or the Save button), Mudbrick POSTs the edited PDF to the `callbackUrl` as `multipart/form-data`:

| Field | Type | Description |
|---|---|---|
| `file` | File (blob) | The saved PDF binary, with the filename from `fileName` |
| `woId` | String | The work order ID from the launch URL |
| `fileName` | String | The file's display name |

**Download (Ctrl+Shift+S) does NOT trigger the callback.** It saves a local copy only. This prevents duplicate versions in `work_order_files` when a user saves normally and also downloads a backup.

### Expected response

The callback endpoint should return `200 OK` with a JSON body. The response is currently logged but not displayed.

### Failure handling

If the callback POST fails, Mudbrick shows a warning toast and suggests using Save & Download for a local copy. The PDF is still saved in-memory within the editor.

---

## Q3 — Authentication

**No auth required.** Mudbrick is a static client-side application with no server component or user accounts. A signed URL is sufficient — Mudbrick simply fetches whatever URL is provided in `fileUrl`.

The **callback endpoint** should implement its own authentication. Suggestions:
- Include a short-lived token in the `callbackUrl` query string
- Validate the `woId` on the server side
- Use HMAC signature verification on the POST body

---

## Q4 — DOCX Support & PDF Form Fields

**DOCX:** Not supported. Mudbrick is a PDF-only editor. Only show the "Edit in Mudbrick" button for `.pdf` files.

**PDF Form Fields:** Fully supported. Mudbrick detects AcroForm fields via pdf-lib and renders them as interactive overlays:
- **Text fields** — editable text inputs
- **Checkboxes** — toggleable
- **Dropdowns** — selectable options
- **Radio buttons** — selectable options

Filled values are written back into the PDF's AcroForm on save via `writeFormValues()`. Form field structure (field names, positions, types) is preserved through the edit cycle. This works for immigration forms and other fillable PDFs.

---

## CORS Prerequisite

Mudbrick's CSP allows `connect-src https://*.supabase.co`, but the **Supabase storage bucket also needs CORS configured** to allow Mudbrick's origin.

In the Supabase dashboard, configure CORS on the `wo-files` bucket:

```json
{
  "AllowedOrigins": ["https://mudbrick.app"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

Without this, the browser will block the PDF fetch with a CORS error, regardless of the CSP policy.

---

## Security Notes

- **callbackUrl validation:** Mudbrick validates the `callbackUrl` origin against an allowlist (`js/integration.js`). Only known Novo Legal origins, Vercel preview deploys, and localhost are permitted. Arbitrary URLs are silently rejected (the callbackUrl is cleared, so save works normally without a POST).

- **No data passes through Mudbrick's server.** The PDF is fetched directly from Supabase to the user's browser, edited client-side, and POSTed directly from the browser to the callback URL.

- **CSP wildcard scope:** `https://*.supabase.co` allows connections to any Supabase project, intentionally. This keeps Mudbrick tenant-agnostic rather than tied to a specific project ID.

---

## Architecture Diagram

```
Dashboard                          Mudbrick (browser)                    Supabase Storage
   |                                     |                                     |
   |-- window.open(mudbrick?fileUrl=...) |                                     |
   |                                     |-- fetch(signedUrl) --------------->  |
   |                                     |<-------------- PDF bytes ----------  |
   |                                     |                                     |
   |                              [user edits PDF]                             |
   |                                     |                                     |
   |<-- POST callbackUrl (form-data) --- |                                     |
   |                                     |                                     |
   |-- 200 OK (JSON) -----------------> |                                     |
   |                                     |-- toast "Saved and sent"            |
```
