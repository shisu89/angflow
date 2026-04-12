/**
 * DTOs shared by the interceptor, the in-memory backend, and the
 * frontend provider/nodes. These describe the wire format of the
 * /api/timeseries/** HTTP API.
 */

export interface DatasetMetadata {
  id: string;
  label: string;
  availableColumns: string[];
  rowCount: number;
  uploadedAt: string; // ISO 8601
}

export interface DatasetPayload extends DatasetMetadata {
  /** Unix ms, sorted ascending. */
  time: number[];
  /** Column name -> parallel array of same length as `time`; null = gap. */
  columns: Record<string, Array<number | null>>;
}

export interface UploadRequestBody {
  label: string;
  csv: string;
}

export interface PatchRequestBody {
  label?: string;
}

export interface BackendErrorBody {
  error: string;
  row?: number;    // 1-indexed, if applicable
  column?: string; // if applicable
}
