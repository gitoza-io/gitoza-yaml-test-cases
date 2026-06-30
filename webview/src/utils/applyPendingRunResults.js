import { withExecutionMeta } from "./runCaseExecutionMeta";

/**
 * Apply pending result changes to a run detail for display.
 *
 * @param {object | null} detail - RunDetail from server
 * @param {Map<string, string>} pendingMap - file_path -> result
 * @returns {object | null}
 */
export function applyPendingRunResults(detail, pendingMap) {
  if (!detail) return null;
  if (!pendingMap?.size) return detail;

  const cases = (detail.cases ?? []).map((c) => {
    const pending = pendingMap.get(c.file_path);
    if (pending === undefined) return c;
    return withExecutionMeta(c, { result: pending });
  });

  return { ...detail, cases };
}

/**
 * @param {Array<{ result?: string }>} cases
 * @returns {{ passed: number; failed: number; skipped: number; pending: number }}
 */
export function countResultsFromCases(cases) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  for (const c of cases ?? []) {
    switch (c.result) {
      case "passed":
        passed += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      default:
        pending += 1;
        break;
    }
  }
  return { passed, failed, skipped, pending };
}

/**
 * Get persisted result for a case path from detail.
 */
export function persistedResultForPath(detail, filePath) {
  const row = (detail?.cases ?? []).find((c) => c.file_path === filePath);
  return row?.result ?? "pending";
}
