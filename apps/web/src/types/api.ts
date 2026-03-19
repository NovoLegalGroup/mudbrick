/**
 * Mudbrick v2 -- API TypeScript types (Desktop)
 *
 * Request and response types for all API endpoints.
 */

export interface HealthResponse {
  status: string;
  version: string;
}

export interface SessionCreateResponse {
  session_id: string;
  page_count: number;
  file_size: number;
}

export interface SessionInfoResponse {
  session_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  page_count: number;
  current_version: number;
  versions: VersionInfoResponse[];
  created_at: string;
  updated_at: string;
}

export interface VersionInfoResponse {
  version: number;
  operation: string;
  timestamp: string;
  is_current: boolean;
}

export interface UndoRedoResponse {
  version: number;
  page_count: number;
  operation: string;
}

export interface PageOperationResponse {
  success: boolean;
  page_count: number;
}

export interface MergeResponse {
  session_id: string;
  page_count: number;
}

export interface SaveResponse {
  success: boolean;
  file_path: string;
}

export interface ExportResponse {
  success: boolean;
  file_path: string;
}

export interface ApiErrorResponse {
  detail: string;
}

/** Generic API response wrapper for hooks */
export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
