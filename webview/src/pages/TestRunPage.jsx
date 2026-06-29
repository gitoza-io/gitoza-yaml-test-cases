import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import TestRepositoryThreeColumnLayout from "../components/TestRepositoryThreeColumnLayout";
import RunSidebarList from "../components/RunSidebarList";
import RunPaginatedCaseList from "../components/RunPaginatedCaseList";
import CaseDetailView from "../components/CaseDetailView";
import DetailPanelEmpty from "../components/DetailPanelEmpty";
import DetailPanelLoading from "../components/DetailPanelLoading";
import AddRunCasesModal from "../components/AddRunCasesModal";
import { RUNS_ROOT } from "../constants/runPaths";
import {
  addRunCases,
  createRun,
  deleteRun,
  getCaseDetail,
  getRunDetail,
  initializeRunsRoot,
  listRuns,
  removeRunCase,
  setRunCaseResult,
} from "../services/api";
import { onCasesUpdated, onRunsUpdated } from "../api/vscodeApi";
import { TestCaseIcon } from "../components/TestEntityIcons";
import { browseColumnNoSelect } from "../utils/layoutClasses";

const ACTIVE_REPO = "vscode";

export default function TestRunPage({
  hasCasesRoot,
  hasRunsRoot,
  onRunsRootInitialized,
}) {
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [selectedCasePath, setSelectedCasePath] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [showAddCasesModal, setShowAddCasesModal] = useState(false);
  const [caseListPage, setCaseListPage] = useState(1);

  const loadRuns = useCallback(async () => {
    if (!hasRunsRoot) {
      setRuns([]);
      return;
    }
    try {
      const items = await listRuns();
      setRuns(Array.isArray(items) ? items : []);
    } catch {
      setRuns([]);
    }
  }, [hasRunsRoot]);

  const loadRunDetail = useCallback(async (runId) => {
    if (!runId || !hasRunsRoot) {
      setRunDetail(null);
      return;
    }
    setRunDetailLoading(true);
    try {
      const detail = await getRunDetail(runId);
      setRunDetail(detail);
    } catch {
      setRunDetail(null);
    } finally {
      setRunDetailLoading(false);
    }
  }, [hasRunsRoot]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    return onRunsUpdated(() => {
      void loadRuns();
      if (selectedRunId) {
        void loadRunDetail(selectedRunId);
      }
    });
  }, [loadRuns, loadRunDetail, selectedRunId]);

  useEffect(() => {
    return onCasesUpdated(() => {
      if (selectedCasePath) {
        getCaseDetail(selectedCasePath, ACTIVE_REPO)
          .then(setCaseDetail)
          .catch(() => {});
      }
      if (selectedRunId) {
        void loadRunDetail(selectedRunId);
      }
    });
  }, [selectedCasePath, selectedRunId, loadRunDetail]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      setSelectedCasePath(null);
      return;
    }
    void loadRunDetail(selectedRunId);
    setSelectedCasePath(null);
    setCaseListPage(1);
  }, [selectedRunId, loadRunDetail]);

  useEffect(() => {
    if (!selectedCasePath) {
      setCaseDetail(null);
      return;
    }
    let cancelled = false;
    setCaseDetailLoading(true);
    getCaseDetail(selectedCasePath, ACTIVE_REPO)
      .then((detail) => {
        if (!cancelled) setCaseDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setCaseDetail(null);
      })
      .finally(() => {
        if (!cancelled) setCaseDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCasePath]);

  const runCases = useMemo(() => runDetail?.cases ?? [], [runDetail]);

  const existingRunPaths = useMemo(
    () => new Set(runCases.map((c) => c.file_path)),
    [runCases],
  );

  const handleSelectRun = useCallback((run) => {
    setSelectedRunId(run?.run_id ?? null);
  }, []);

  const handleCommitCreateRun = useCallback(
    async (name) => {
      setCreatingRun(false);
      if (!name?.trim()) return;
      if (!hasRunsRoot) {
        await initializeRunsRoot();
        onRunsRootInitialized?.();
      }
      const detail = await createRun(name.trim(), name.trim());
      await loadRuns();
      setSelectedRunId(detail.run_id);
    },
    [hasRunsRoot, loadRuns, onRunsRootInitialized],
  );

  const handleDeleteRun = useCallback(
    async (runId) => {
      await deleteRun(runId);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }
      await loadRuns();
    },
    [loadRuns, selectedRunId],
  );

  const handleSetResult = useCallback(
    async (_runId, filePath, result) => {
      if (!selectedRunId) return;
      const detail = await setRunCaseResult(selectedRunId, filePath, result);
      setRunDetail(detail);
      await loadRuns();
    },
    [selectedRunId, loadRuns],
  );

  const handleAddCases = useCallback(
    async (paths) => {
      if (!selectedRunId) return;
      const detail = await addRunCases(selectedRunId, paths);
      setRunDetail(detail);
      setShowAddCasesModal(false);
      await loadRuns();
    },
    [selectedRunId, loadRuns],
  );

  const handleRemoveCase = useCallback(
    async (row) => {
      if (!selectedRunId || !row?.file_path) return;
      const detail = await removeRunCase(selectedRunId, row.file_path);
      setRunDetail(detail);
      if (selectedCasePath === row.file_path) {
        setSelectedCasePath(null);
      }
      await loadRuns();
    },
    [selectedRunId, selectedCasePath, loadRuns],
  );

  const getContextMenuItems = useCallback(
    (row, closeMenu) => [
      {
        label: "Remove from run",
        onClick: async () => {
          closeMenu(null);
          await handleRemoveCase(row);
        },
      },
    ],
    [handleRemoveCase],
  );

  if (!hasRunsRoot) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Initialize test runs
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          No <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">{RUNS_ROOT}</code>{" "}
          folder found. Create your first run to get started.
        </p>
        <button
          type="button"
          onClick={() => setCreatingRun(true)}
          className="mt-6 rounded-ui bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create first run
        </button>
        {creatingRun ? (
          <div className="mt-4 w-full max-w-xs">
            <RunSidebarList
              runs={[]}
              creatingRun
              onCommitCreateRun={handleCommitCreateRun}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const selectedRun = runs.find((r) => r.run_id === selectedRunId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <TestRepositoryThreeColumnLayout
        storageKeys={{
          treeWidth: "testRun.col.treeWidth",
          listWidth: "testRun.col.listWidth",
        }}
        treeColumn={
          <RunSidebarList
            runs={runs}
            selectedRunId={selectedRunId}
            onSelectRun={handleSelectRun}
            creatingRun={creatingRun}
            onStartCreateRun={() => setCreatingRun(true)}
            onCommitCreateRun={handleCommitCreateRun}
            onDeleteRun={handleDeleteRun}
          />
        }
        caseListColumn={
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2 py-2 dark:border-slate-700">
              <span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                {selectedRun?.title || selectedRun?.run_id || "Cases"}
              </span>
              <button
                type="button"
                disabled={!selectedRunId || !hasCasesRoot}
                title={
                  !hasCasesRoot
                    ? "Initialize the test repository before adding cases"
                    : "Add cases from repository"
                }
                onClick={() => setShowAddCasesModal(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-ui border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add cases
              </button>
            </div>
            <RunPaginatedCaseList
              cases={runCases}
              page={caseListPage}
              onPageChange={setCaseListPage}
              selectedCaseFilePath={selectedCasePath}
              onSelectCase={(row) => setSelectedCasePath(row?.file_path ?? null)}
              folderPath={selectedRunId}
              showNoRunWhenEmpty
              noRunMessage="Select a run"
              emptyMessage={
                runDetailLoading
                  ? "Loading…"
                  : "No cases in this run. Use Add cases to include tests from the repository."
              }
              loading={runDetailLoading}
              defaultRunId={selectedRunId}
              onSetResult={handleSetResult}
              getContextMenuItems={getContextMenuItems}
            />
          </div>
        }
        detailColumn={
          <div className={`flex h-full min-h-0 flex-col overflow-hidden ${browseColumnNoSelect}`}>
            {caseDetailLoading ? (
              <DetailPanelLoading />
            ) : caseDetail ? (
              <CaseDetailView testCase={caseDetail} simpleMode reviewEnabled={false} />
            ) : (
              <DetailPanelEmpty
                iconComponent={TestCaseIcon}
                title={selectedCasePath ? "Case not found" : "Select a case"}
                description={
                  selectedCasePath
                    ? "The case file may have been moved or deleted."
                    : selectedRunId
                      ? "Choose a case from the list to view its details."
                      : "Select a run, then a case."
                }
              />
            )}
          </div>
        }
      />
      {showAddCasesModal && selectedRunId ? (
        <AddRunCasesModal
          existingPaths={existingRunPaths}
          onConfirm={handleAddCases}
          onClose={() => setShowAddCasesModal(false)}
        />
      ) : null}
    </div>
  );
}
