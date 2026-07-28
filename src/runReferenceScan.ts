import type { RunYamlCase } from "./messageTypes";

export interface RunReferenceMatch {
  run_id: string;
  title?: string;
  matching_paths: string[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Returns true when `casePath` is affected by any delete target (exact file or folder prefix).
 */
export function casePathMatchesDeleteTargets(
  casePath: string,
  deleteTargets: string[],
): boolean {
  const norm = normalizePath(casePath);
  for (const raw of deleteTargets) {
    const target = normalizePath(raw).replace(/\/+$/, "");
    if (!target) continue;
    if (norm === target) return true;
    if (target.endsWith(".yaml") || target.endsWith(".yml")) continue;
    const prefix = target.endsWith("/") ? target : `${target}/`;
    if (norm.startsWith(prefix)) return true;
  }
  return false;
}

export function findMatchingRunReferences(
  runs: Array<{
    run_id: string;
    title?: string;
    cases: RunYamlCase[];
  }>,
  deleteTargets: string[],
): RunReferenceMatch[] {
  const targets = deleteTargets.map((p) => normalizePath(p)).filter(Boolean);
  if (!targets.length) return [];

  const matches: RunReferenceMatch[] = [];
  for (const run of runs) {
    const matching_paths: string[] = [];
    for (const entry of run.cases) {
      const path = normalizePath(entry.path);
      if (casePathMatchesDeleteTargets(path, targets)) {
        matching_paths.push(path);
      }
    }
    if (matching_paths.length > 0) {
      matches.push({
        run_id: run.run_id,
        title: run.title,
        matching_paths,
      });
    }
  }
  return matches;
}

/**
 * Remap a case path when its folder prefix changes (folder rename).
 * Exact folder match and descendants under `oldPrefix/` are rewritten.
 */
export function remapPathUnderPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string,
): string {
  const norm = normalizePath(path);
  const oldNorm = normalizePath(oldPrefix).replace(/\/+$/, "");
  const newNorm = normalizePath(newPrefix).replace(/\/+$/, "");
  if (!oldNorm || !newNorm || oldNorm === newNorm) return norm;
  if (norm === oldNorm) return newNorm;
  const prefix = `${oldNorm}/`;
  if (norm.startsWith(prefix)) {
    return newNorm + norm.slice(oldNorm.length);
  }
  return norm;
}

/**
 * Apply folder-prefix remap to run case entries. Returns null when nothing changed.
 */
export function remapRunCasePaths(
  cases: RunYamlCase[],
  oldPrefix: string,
  newPrefix: string,
): RunYamlCase[] | null {
  let changed = false;
  const next = cases.map((entry) => {
    const remapped = remapPathUnderPrefix(entry.path, oldPrefix, newPrefix);
    if (remapped !== normalizePath(entry.path)) {
      changed = true;
      return { ...entry, path: remapped };
    }
    return entry;
  });
  return changed ? next : null;
}
