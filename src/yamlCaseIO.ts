import { parse, stringify } from "yaml";
import type { Comment, YamlCaseDetail } from "./messageTypes";

const CASE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function isValidCaseId(caseId: string): boolean {
  return CASE_ID_RE.test(caseId.trim());
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function parseParams(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = String(k).trim();
    const val = String(v ?? "").trim();
    if (key && val) {
      out[key] = val;
    }
  }
  return out;
}

function parseAutomated(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

function parseComments(value: unknown): Comment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const comments: Comment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const author = String(rec.author ?? "").trim();
    const timestamp = String(rec.timestamp ?? "").trim();
    const text = String(rec.text ?? "").trim();
    if (author && text) {
      comments.push({ author, timestamp, text });
    }
  }
  return comments;
}

function lowerKeyMap(map: Record<string, unknown>): Record<string, unknown> {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(map)) {
    lower[k.toLowerCase()] = v;
  }
  return lower;
}

export function parseCaseYaml(
  content: string,
  filePath: string,
): YamlCaseDetail | null {
  const stripped = content.trimStart();
  if (!stripped.startsWith("---")) {
    return null;
  }
  const rest = stripped.slice(3);
  const end = rest.indexOf("\n---");
  let frontText: string;
  let body: string;
  if (end >= 0) {
    frontText = rest.slice(0, end);
    body = rest.slice(end + 4).trimStart();
  } else {
    frontText = rest;
    body = "";
  }

  let parsed: unknown;
  try {
    parsed = parse(frontText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const lower = lowerKeyMap(parsed as Record<string, unknown>);
  const caseId =
    filePath
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/\.yaml$/i, "")
      ?.replace(/\.yml$/i, "") ?? "";

  const approveStatus =
    String(lower.approve_status ?? "")
      .trim()
      .toLowerCase() || "draft";
  const status =
    String(lower.status ?? "")
      .trim()
      .toLowerCase() || "active";

  return {
    case_id: caseId,
    title: lower.title != null ? String(lower.title) : undefined,
    tags: parseTags(lower.tags),
    status,
    priority: lower.priority != null ? String(lower.priority) : undefined,
    file_path: filePath.replace(/\\/g, "/"),
    body,
    approve_status: approveStatus,
    updated_at: lower.updated_at != null ? String(lower.updated_at) : undefined,
    updated_by: lower.updated_by != null ? String(lower.updated_by) : undefined,
    approved_by: lower.approved_by != null ? String(lower.approved_by) : undefined,
    approved_at: lower.approved_at != null ? String(lower.approved_at) : undefined,
    requirement_id:
      lower.requirement_id != null ? String(lower.requirement_id) : undefined,
    assigned_to: lower.assigned_to != null ? String(lower.assigned_to) : undefined,
    automated: parseAutomated(lower.automated),
    comments: parseComments(lower.comments),
    params: parseParams(lower.params),
  };
}

export function parseCaseYamlFrontMatterOnly(
  content: string,
  filePath: string,
): YamlCaseDetail | null {
  const detail = parseCaseYaml(content, filePath);
  if (!detail) {
    return null;
  }
  return { ...detail, body: "" };
}

export function detailToFrontMatter(
  detail: YamlCaseDetail,
): Record<string, unknown> {
  const fm: Record<string, unknown> = {};

  if (detail.title?.trim()) {
    fm.title = detail.title.trim();
  }
  if (detail.tags.length > 0) {
    fm.tags = detail.tags;
  }
  if (detail.status?.trim()) {
    fm.status = detail.status.trim().toLowerCase();
  }
  if (detail.priority?.trim()) {
    fm.priority = detail.priority.trim().toLowerCase();
  }
  if (detail.requirement_id?.trim()) {
    fm.requirement_id = detail.requirement_id.trim();
  }
  if (detail.assigned_to?.trim()) {
    fm.assigned_to = detail.assigned_to.trim();
  }
  if (detail.automated) {
    fm.automated = true;
  }
  if (Object.keys(detail.params).length > 0) {
    fm.params = detail.params;
  }

  return fm;
}

export function serializeCaseYaml(detail: YamlCaseDetail): string {
  const fm = detailToFrontMatter(detail);
  const ordered: Record<string, unknown> = {};

  if (fm.title !== undefined) {
    ordered.title = fm.title;
  }
  for (const [k, v] of Object.entries(fm)) {
    if (k !== "title") {
      ordered[k] = v;
    }
  }

  const yamlHeader = stringify(ordered).trimEnd();
  const body = (detail.body ?? "").trim();

  if (!body) {
    return `---\n${yamlHeader}\n---\n\n`;
  }
  return `---\n${yamlHeader}\n---\n\n${body}\n`;
}
