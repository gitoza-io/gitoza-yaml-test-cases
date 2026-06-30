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
