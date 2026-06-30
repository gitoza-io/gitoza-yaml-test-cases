import type { RunCaseResult } from "./messageTypes";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export interface RunCaseResultUpdate {
  path: string;
  result: RunCaseResult;
}

/**
 * Apply batch result updates to run YAML cases by normalized path.
 * Unknown paths are ignored; cases not in updates are unchanged.
 */
export function applyResultUpdates<T extends { path: string; result: RunCaseResult }>(
  cases: T[],
  updates: RunCaseResultUpdate[],
): T[] {
  if (!updates.length) {
    return cases;
  }
  const byPath = new Map<string, RunCaseResult>();
  for (const u of updates) {
    const norm = normalizePath(u.path.trim());
    if (norm) {
      byPath.set(norm, u.result);
    }
  }
  if (byPath.size === 0) {
    return cases;
  }
  return cases.map((c) => {
    const next = byPath.get(normalizePath(c.path));
    return next !== undefined ? { ...c, result: next } : c;
  });
}
