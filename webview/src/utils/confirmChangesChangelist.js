import { filePath2Breadcrumb } from "./breadcrumb";
import { pathsToMinimalCaseRows } from "./confirmChangesCaseTree";
import {
  formatRunGroupSubtitle,
  runGroupFallbackLabel,
} from "./confirmChangesRunGroups";

const CASES_PREFIX = ".gitoza/test/cases/";

function normalizePath(path) {
  return (path || "").replace(/\\/g, "/");
}

function isCasePath(path) {
  return normalizePath(path).includes(CASES_PREFIX);
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function breadcrumbLabelForCasePath(filePath) {
  const crumbs = filePath2Breadcrumb(filePath);
  return crumbs.length > 0 ? crumbs.join(" › ") : normalizePath(filePath);
}

/**
 * @param {string} sectionId
 * @param {string} title
 * @param {number} count
 * @returns {{ kind: 'sectionHeader', id: string, title: string, count: number }}
 */
function sectionHeader(sectionId, title, count) {
  return {
    kind: "sectionHeader",
    id: `section:${sectionId}`,
    title,
    count,
  };
}

/**
 * Build flat changelist rows for Confirm (VS Code-style sidebar).
 *
 * @param {{
 *   caseChanges?: Array<{ path?: string, status?: string, old_path?: string | null }>;
 *   runGroups?: Array<{ runDir: string, runId?: string, paths?: string[], archived?: boolean }>;
 *   templateFiles?: string[];
 *   configFiles?: string[];
 *   runLabelsByDir?: Record<string, string>;
 * }} params
 * @returns {Array<object>}
 */
export function buildConfirmChangelistEntries({
  caseChanges = [],
  runGroups = [],
  templateFiles = [],
  configFiles = [],
  runLabelsByDir = {},
} = {}) {
  const entries = [];

  const sortedCaseChanges = [...caseChanges]
    .filter((c) => isCasePath(c?.path))
    .sort((a, b) => normalizePath(a.path).localeCompare(normalizePath(b.path)));

  if (sortedCaseChanges.length > 0) {
    entries.push(sectionHeader("cases", "Cases", sortedCaseChanges.length));
    const rows = pathsToMinimalCaseRows(sortedCaseChanges.map((c) => c.path));
    const rowByPath = new Map(rows.map((r) => [normalizePath(r.file_path), r]));
    for (const change of sortedCaseChanges) {
      const path = normalizePath(change.path);
      const row = rowByPath.get(path) ?? {
        file_path: path,
        case_id: path.split("/").pop()?.replace(/\.ya?ml$/i, "") ?? path,
        title: path.split("/").pop()?.replace(/\.ya?ml$/i, "") ?? path,
      };
      entries.push({
        kind: "case",
        id: `case:${path}`,
        file_path: path,
        caseRow: row,
        status: (change.status || "M").toUpperCase(),
        old_path: change.old_path ? normalizePath(change.old_path) : null,
        label: breadcrumbLabelForCasePath(path),
      });
    }
  }

  if (runGroups.length > 0) {
    entries.push(sectionHeader("runs", "Runs", runGroups.length));
    for (const group of runGroups) {
      const title = runLabelsByDir[group.runDir] ?? runGroupFallbackLabel(group.runDir);
      const subtitle = formatRunGroupSubtitle(group.paths ?? []);
      entries.push({
        kind: "runGroup",
        id: `run:${group.runDir}`,
        runDir: group.runDir,
        runId: group.runId,
        paths: group.paths ?? [],
        title,
        subtitle,
      });
    }
  }

  const templates = [...templateFiles].map(normalizePath).sort();
  if (templates.length > 0) {
    entries.push(sectionHeader("templates", "Templates", templates.length));
    for (const path of templates) {
      entries.push({
        kind: "template",
        id: `template:${path}`,
        path,
      });
    }
  }

  const configs = [...configFiles].map(normalizePath).sort();
  if (configs.length > 0) {
    entries.push(sectionHeader("config", "Project config", configs.length));
    for (const path of configs) {
      entries.push({
        kind: "config",
        id: `config:${path}`,
        path,
      });
    }
  }

  return entries;
}

/**
 * @param {Array<object>} entries
 * @returns {{ selectionKind: 'caseFolder' | 'runGroup' | 'other', selectedFilePath: string | null, selectedRunDir: string | null } | null}
 */
export function selectionFromChangelistEntry(entry) {
  if (!entry) return null;
  if (entry.kind === "case") {
    return {
      selectionKind: "caseFolder",
      selectedFilePath: entry.file_path,
      selectedRunDir: null,
    };
  }
  if (entry.kind === "runGroup") {
    return {
      selectionKind: "runGroup",
      selectedFilePath: null,
      selectedRunDir: entry.runDir,
    };
  }
  if (entry.kind === "template" || entry.kind === "config") {
    return {
      selectionKind: "other",
      selectedFilePath: entry.path,
      selectedRunDir: null,
    };
  }
  return null;
}

/**
 * @param {Array<object>} entries
 * @returns {{ selectionKind: 'caseFolder' | 'runGroup' | 'other', selectedFilePath: string | null, selectedRunDir: string | null } | null}
 */
export function findFirstSelectableEntry(entries) {
  const entry = (entries || []).find(
    (e) =>
      e.kind === "case" ||
      e.kind === "runGroup" ||
      e.kind === "template" ||
      e.kind === "config",
  );
  return selectionFromChangelistEntry(entry);
}

/**
 * Estimate row height for virtual list.
 * @param {object} entry
 * @returns {number}
 */
export function estimateChangelistRowHeight(entry) {
  if (entry?.kind === "sectionHeader") return 28;
  if (entry?.kind === "runGroup" && entry.subtitle) return 40;
  return 32;
}
