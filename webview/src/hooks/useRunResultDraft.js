import { useCallback, useMemo, useState } from "react";
import {
  applyPendingRunResults,
  persistedResultForPath,
} from "../utils/applyPendingRunResults";

/**
 * In-memory draft for run case results (Pass/Fail/Skip) before batch save.
 *
 * @param {{ runId: string | null; saveRunResults: (runId: string, updates: { path: string; result: string }[]) => Promise<object> }} opts
 */
export function useRunResultDraft({ runId, saveRunResults }) {
  const [persistedDetail, setPersistedDetail] = useState(null);
  const [pendingResults, setPendingResults] = useState(() => new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isDirty = pendingResults.size > 0;

  const displayDetail = useMemo(
    () => applyPendingRunResults(persistedDetail, pendingResults),
    [persistedDetail, pendingResults],
  );

  const resetFromServer = useCallback((detail) => {
    setPersistedDetail(detail);
    setPendingResults(new Map());
    setSaveError("");
  }, []);

  const discard = useCallback(() => {
    setPendingResults(new Map());
    setSaveError("");
  }, []);

  const setResult = useCallback(
    (filePath, result) => {
      if (!filePath) return;
      setPendingResults((prev) => {
        const next = new Map(prev);
        const persisted = persistedResultForPath(persistedDetail, filePath);
        if (result === persisted) {
          next.delete(filePath);
        } else {
          next.set(filePath, result);
        }
        return next;
      });
      setSaveError("");
    },
    [persistedDetail],
  );

  const save = useCallback(async () => {
    if (!runId || pendingResults.size === 0) return persistedDetail;
    setSaving(true);
    setSaveError("");
    try {
      const updates = [...pendingResults.entries()].map(([path, result]) => ({
        path,
        result,
      }));
      const detail = await saveRunResults(runId, updates);
      setPersistedDetail(detail);
      setPendingResults(new Map());
      return detail;
    } catch (err) {
      const message = err?.message || "Failed to save";
      setSaveError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [runId, pendingResults, persistedDetail, saveRunResults]);

  return {
    persistedDetail,
    displayDetail,
    pendingResults,
    isDirty,
    saving,
    saveError,
    setResult,
    save,
    discard,
    resetFromServer,
    setPersistedDetail,
  };
}
