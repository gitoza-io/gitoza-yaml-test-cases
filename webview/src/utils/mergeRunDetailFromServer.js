import { withExecutionMeta } from "./runCaseExecutionMeta";

/**
 * Merge getRun payload into cache without dropping pending-case execution metadata
 * when the server omits fields or a reload races with optimistic UI.
 */
export function mergeRunDetailFromServer(prevDetail, serverDetail) {
  if (!serverDetail) return serverDetail ?? prevDetail ?? null;
  if (!prevDetail?.cases?.length) return serverDetail;

  const prevByPath = new Map((prevDetail.cases ?? []).map((c) => [c.file_path, c]));

  const cases = (serverDetail.cases ?? []).map((c) => {
    const pending = !c.result || c.result === "pending";
    if (!pending) return c;

    const p = prevByPath.get(c.file_path);
    if (!p) return c;

    const executedAt =
      (c.executed_at && String(c.executed_at).trim()) ||
      (p.executed_at && String(p.executed_at).trim()) ||
      null;
    const executedBy =
      (c.executed_by && String(c.executed_by).trim()) ||
      (p.executed_by && String(p.executed_by).trim()) ||
      null;

    if (!executedAt && !executedBy) return c;
    return {
      ...c,
      ...(executedAt ? { executed_at: executedAt } : {}),
      ...(executedBy ? { executed_by: executedBy } : {}),
    };
  });

  return { ...serverDetail, cases };
}

/**
 * Ensure pending cases on given paths have execution metadata (e.g. from add_run_cases response).
 */
/**
 * Merge DB-first set_run_results_batch / set_run_result API response into run cache.
 * Preserves title, tags, comments, and other case metadata from prevDetail.
 */
export function mergeRunResultsFromBatchResponse(prevDetail, response) {
  if (!response) return prevDetail ?? null;
  if (!prevDetail) return prevDetail ?? null;

  const stampedByPath = new Map(
    (response.cases ?? []).map((c) => [c.file_path, c]),
  );

  const cases = (prevDetail.cases ?? []).map((c) => {
    const stamped = stampedByPath.get(c.file_path);
    if (!stamped) return c;
    return {
      ...c,
      result: stamped.result ?? c.result,
      executed_at: stamped.executed_at ?? c.executed_at,
      executed_by: stamped.executed_by ?? c.executed_by,
      ...(stamped.comment !== undefined ? { comment: stamped.comment } : {}),
    };
  });

  const runPatch = response.run;
  const run = runPatch
    ? {
        ...(prevDetail.run ?? {}),
        ...(runPatch.passed !== undefined ? { passed: runPatch.passed } : {}),
        ...(runPatch.failed !== undefined ? { failed: runPatch.failed } : {}),
        ...(runPatch.skipped !== undefined ? { skipped: runPatch.skipped } : {}),
        ...(runPatch.updated_at ? { updated_at: runPatch.updated_at } : {}),
        ...(runPatch.updated_by !== undefined ? { updated_by: runPatch.updated_by } : {}),
      }
    : prevDetail.run;

  return { ...prevDetail, run, cases };
}

function directoryFromFilePath(filePath) {
  const fp = filePath || "";
  const index = fp.lastIndexOf("/");
  return index >= 0 ? fp.slice(0, index) : "";
}

/**
 * Seed a run detail cache entry from a search_run_cases row when the case is not yet loaded.
 * @param {object | null | undefined} detail
 * @param {object | null | undefined} searchRow
 * @param {string | null | undefined} [executedByHint]
 * @returns {object | null | undefined}
 */
export function mergeSearchCaseIntoRunDetail(detail, searchRow, executedByHint = null) {
  if (!detail || !searchRow?.file_path) return detail;
  const filePath = searchRow.file_path;
  if ((detail.cases ?? []).some((c) => c.file_path === filePath)) return detail;

  const hint = executedByHint ?? detail.run?.updated_by ?? null;
  const caseRow = withExecutionMeta(
    {
      file_path: filePath,
      case_id: searchRow.case_id ?? filePath,
      title: searchRow.title || searchRow.case_id || "Untitled",
      priority: searchRow.priority ?? null,
      result: searchRow.result ?? "pending",
      directory: searchRow.directory || directoryFromFilePath(filePath),
      tags: searchRow.tags ?? [],
      requirement_id: searchRow.requirement_id ?? null,
      automated: Boolean(searchRow.automated),
      assigned_to: searchRow.assigned_to ?? null,
      effective_assigned_to:
        searchRow.effective_assigned_to ??
        searchRow.assigned_to ??
        detail.run?.assigned_to ??
        null,
      executed_by: searchRow.executed_by ?? null,
      executed_at: searchRow.executed_at ?? null,
      comments: searchRow.comments ?? [],
    },
    { result: searchRow.result ?? "pending", executedByHint: hint },
  );

  return {
    ...detail,
    cases: [...(detail.cases ?? []), caseRow],
  };
}

export function applyRunAssignedToPaths(detail, filePaths, runAssignedTo) {
  const name = runAssignedTo?.trim();
  if (!detail || !name || !filePaths?.length) return detail;

  const paths = new Set(filePaths);
  return {
    ...detail,
    cases: (detail.cases ?? []).map((c) => {
      if (!paths.has(c.file_path)) return c;
      if (c.assigned_to?.trim()) return c;
      return {
        ...c,
        effective_assigned_to: name,
      };
    }),
  };
}

export function applyExecutedByToPaths(detail, filePaths, executedBy) {
  const name = executedBy?.trim();
  if (!detail || !name || !filePaths?.length) return detail;

  const paths = new Set(filePaths);
  return {
    ...detail,
    cases: (detail.cases ?? []).map((c) => {
      if (!paths.has(c.file_path)) return c;
      if (c.result && c.result !== "pending") return c;
      return withExecutionMeta(c, { result: "pending", executedByHint: name });
    }),
  };
}
