/**
 * Mudbrick v2 -- Typed API Client (Desktop / Local Sidecar)
 *
 * All operations use local file paths -- no HTTP upload.
 * Backend runs on localhost:8000 as a Tauri sidecar.
 */

import { API_BASE } from '@mudbrick/shared/src/constants';
import type {
  SessionCreateResponse,
  SessionInfoResponse,
  UndoRedoResponse,
  HealthResponse,
  ExportResponse,
  PageOperationResponse,
  MergeResponse,
  SaveResponse,
} from '../types/api';
import type { PageAnnotations } from '../types/annotation';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  // -- Helpers --

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, error.detail || 'Unknown error');
    }

    return response.json();
  }

  private async requestBlob(path: string): Promise<Blob> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, error.detail || 'Unknown error');
    }
    return response.blob();
  }

  // -- Health --

  async health(): Promise<HealthResponse> {
    return this.request('/health');
  }

  // -- Document Operations (file-path based, no upload) --

  /**
   * Open a PDF file by local filesystem path.
   * Backend reads the file directly from disk.
   */
  async openFile(filePath: string): Promise<SessionCreateResponse> {
    return this.request('/documents/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });
  }

  async getDocumentInfo(sessionId: string): Promise<SessionInfoResponse> {
    return this.request(`/documents/${sessionId}`);
  }

  /**
   * Save the current document back to its original file path (Ctrl+S).
   */
  async save(sessionId: string): Promise<SaveResponse> {
    return this.request(`/documents/${sessionId}/save`, { method: 'POST' });
  }

  /**
   * Save the current document to a new file path (Ctrl+Shift+S).
   */
  async saveAs(sessionId: string, filePath: string): Promise<SaveResponse> {
    return this.request(`/documents/${sessionId}/save-as`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });
  }

  async closeDocument(sessionId: string): Promise<{ success: boolean }> {
    return this.request(`/documents/${sessionId}/close`, { method: 'POST' });
  }

  async undo(sessionId: string): Promise<UndoRedoResponse> {
    return this.request(`/documents/${sessionId}/undo`, { method: 'POST' });
  }

  async redo(sessionId: string): Promise<UndoRedoResponse> {
    return this.request(`/documents/${sessionId}/redo`, { method: 'POST' });
  }

  // -- Page Operations --

  async rotatePage(
    sessionId: string,
    pages: number[],
    degrees: number,
  ): Promise<PageOperationResponse> {
    return this.request(`/pages/${sessionId}/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages, degrees }),
    });
  }

  async deletePage(
    sessionId: string,
    pages: number[],
  ): Promise<PageOperationResponse> {
    return this.request(`/pages/${sessionId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    });
  }

  async reorderPages(
    sessionId: string,
    order: number[],
  ): Promise<PageOperationResponse> {
    return this.request(`/pages/${sessionId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
  }

  async insertBlankPage(
    sessionId: string,
    after: number,
    size = 'letter',
  ): Promise<PageOperationResponse> {
    return this.request(`/pages/${sessionId}/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ after, size }),
    });
  }

  async getThumbnail(sessionId: string, page: number, width = 200): Promise<string> {
    const blob = await this.requestBlob(
      `/pages/${sessionId}/${page}/thumbnail?width=${width}`,
    );
    return URL.createObjectURL(blob);
  }

  // -- Merge (file-path based, no upload) --

  /**
   * Merge multiple local PDF files by path.
   */
  async mergeFiles(filePaths: string[]): Promise<MergeResponse> {
    return this.request('/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_paths: filePaths }),
    });
  }

  // -- Export --

  /**
   * Export document with annotations flattened.
   * outputPath is a local filesystem path chosen via Tauri save dialog.
   */
  async exportDocument(
    sessionId: string,
    annotations: Record<number, PageAnnotations>,
    outputPath: string,
    options: Record<string, unknown> = {},
  ): Promise<ExportResponse> {
    return this.request(`/export/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        annotations,
        output_path: outputPath,
        options,
      }),
    });
  }

  // -- SSE Streaming (for OCR, long operations) --

  /**
   * Create an EventSource for SSE streaming endpoints.
   */
  createEventSource(path: string): EventSource {
    return new EventSource(`${this.baseUrl}${path}`);
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Singleton API client */
export const api = new ApiClient();
