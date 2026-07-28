export const CASES_ROOT = ".gitoza-lite/test/cases";
export const RUNS_ROOT = ".gitoza-lite/test/run";

export type RunCaseResult = "pending" | "passed" | "failed" | "skipped";

export interface RunYamlCase {
  path: string;
  result: RunCaseResult;
}

export interface RunDetail {
  run_id: string;
  file_path: string;
  title?: string;
  cases: RunCaseRow[];
}

export interface RunListItem {
  run_id: string;
  title?: string;
  file_path: string;
  case_count: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface RunCaseRow extends RunYamlCase {
  case_id: string;
  title?: string;
  /** Alias of path for list row components */
  file_path: string;
}

export interface Comment {
  author: string;
  timestamp: string;
  text: string;
}

export interface YamlCaseDetail {
  case_id: string;
  title?: string;
  tags: string[];
  status?: string;
  priority?: string;
  file_path: string;
  body: string;
  /** Parsed from file when present; not written on save */
  approve_status?: string;
  updated_at?: string;
  updated_by?: string;
  approved_by?: string;
  approved_at?: string;
  requirement_id?: string;
  assigned_to?: string;
  automated: boolean;
  /** Parsed from file when present; not written on save */
  comments?: Comment[];
  params: Record<string, string>;
}

export interface YamlCaseListItem {
  case_id: string;
  title?: string;
  tags: string[];
  status?: string;
  priority?: string;
  file_path: string;
  directory?: string;
  /** Parsed from file when present; not written on save */
  approve_status?: string;
  updated_at?: string;
  updated_by?: string;
  approved_by?: string;
  approved_at?: string;
  requirement_id?: string;
  assigned_to?: string;
  automated: boolean;
}

export interface YamlCaseListResponse {
  total: number;
  items: YamlCaseListItem[];
}

export interface RepositoryTreeNode {
  type: string;
  name: string;
  display_name: string;
  children?: RepositoryTreeNode[];
  directory_path?: string;
  is_project: boolean;
  case_count: number;
}

export interface CreateTestCasePayload {
  directory: string;
  case_id: string;
  title?: string;
  priority?: string;
  tags?: string[];
  body?: string;
  requirement_id?: string;
  assigned_to?: string;
  automated?: boolean;
  params?: Record<string, string>;
  target_folder?: string;
}

export interface UpdateCasePayload {
  title?: string;
  priority?: string;
  tags?: string[];
  body?: string;
  status?: string;
  requirement_id?: string;
  assigned_to?: string;
  automated?: boolean;
  params?: Record<string, string>;
}

export type WebviewRequestType =
  | "ready"
  | "getRepositoryTree"
  | "listCases"
  | "getCaseDetail"
  | "createProject"
  | "createFolder"
  | "createCase"
  | "updateCase"
  | "initializeCasesRoot"
  | "listRuns"
  | "getRunDetail"
  | "createRun"
  | "updateRunTitle"
  | "addRunCases"
  | "removeRunCase"
  | "setRunCaseResult"
  | "setRunCaseResults"
  | "deleteRun"
  | "initializeRunsRoot"
  | "deleteCase"
  | "deleteFolder"
  | "deleteProject"
  | "renameFolder"
  | "findRunsReferencingCases";

export interface WebviewRequest {
  type: WebviewRequestType;
  requestId: string;
  payload?: Record<string, unknown>;
}

export interface WebviewResponse {
  type: "response";
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface WebviewInitMessage {
  type: "init";
  theme: "light" | "dark";
  casesRoot: string | null;
  workspaceName: string | null;
  hasCasesRoot: boolean;
  runsRoot: string | null;
  hasRunsRoot: boolean;
}

export interface CasesUpdatedMessage {
  type: "casesUpdated";
}

export interface RunsUpdatedMessage {
  type: "runsUpdated";
}

export interface ThemeChangedMessage {
  type: "themeChanged";
  theme: "light" | "dark";
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type HostToWebviewMessage =
  | WebviewInitMessage
  | WebviewResponse
  | CasesUpdatedMessage
  | RunsUpdatedMessage
  | ThemeChangedMessage
  | ErrorMessage;
