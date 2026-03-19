/**
 * Mudbrick v2 -- PDF-related TypeScript types
 */

export interface PageInfo {
  number: number; // 0-indexed
  width: number;
  height: number;
  rotation: number;
}

export interface DocumentInfo {
  sessionId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  currentVersion: number;
  pages: PageInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface VersionInfo {
  version: number;
  operation: string;
  timestamp: string;
  isCurrent: boolean;
}

export interface ZoomState {
  level: number;
  fitMode: 'none' | 'page' | 'width';
}

export interface ViewportInfo {
  width: number;
  height: number;
  scale: number;
}
