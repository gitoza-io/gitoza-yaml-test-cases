import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import TestRepositoryThreeColumnLayout from "../components/TestRepositoryThreeColumnLayout";
import RepositoryFolderTree from "../components/RepositoryFolderTree";
import RunPaginatedCaseList from "../components/RunPaginatedCaseList";
import CaseDetailView from "../components/CaseDetailView";
import DetailPanelEmpty from "../components/DetailPanelEmpty";
import DetailPanelLoading from "../components/DetailPanelLoading";
import AddRunCasesModal from "../components/AddRunCasesModal";
import UnsavedChangesDialog from "../components/UnsavedChangesDialog";
import ContextMenu from "../components/ContextMenu";
import InlineRenameInput from "../components/InlineRenameInput";
import TitleBarAddButton from "../components/TitleBarAddButton";
import { useConfirm } from "../components/ConfirmProvider";
import { RUNS_ROOT } from "../constants/runPaths";
import { useRunResultDraft } from "../hooks/useRunResultDraft";
import { useRunBrowseState } from "../hooks/useRunBrowseState";
import {
  addRunCases,
  createRun,
  deleteRun,
  getCaseDetail,
  getRunDetail,
  initializeRunsRoot,
  listRuns,
  removeRunCase,
  saveRunResults,
} from "../services/api";
import { onCasesUpdated, onRunsUpdated } from "../api/vscodeApi";
import { TestCaseIcon, TestRunIcon } from "../components/TestEntityIcons";
import { countResultsFromCases } from "../utils/applyPendingRunResults";
import { browseColumnNoSelect } from "../utils/layoutClasses";
import {
  buildGroupedRunCaseListEntries,
  buildUnifiedRunTree,
  findRunFolderDisplayName,
  parseRunTreePath,
} from "../utils/runCaseTree";
import { displayNameFromSanitized, sanitizeNameForPath } from "../utils/sanitize";

const ACTIVE_REPO = "vscode";

export default function TestRunPage({
  hasCasesRoot,
  hasRunsRoot,
  onRunsRootInitialized,
  onDirtyChange,
  registerLeaveHandler,
}) {
  const confirm = useConfirm();
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [cachedRunDetails, setCachedRunDetails] = useState({});
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [selectedCasePath, setSelectedCasePath] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [showAddCasesModal, setShowAddCasesModal] = useState(false);
  const [caseListPage, setCaseListPage] = useState(1);
  const [unsavedDialog, setUnsavedDialog] = useState(null);
  const [runContextMenu, setRunContextMenu] = useState(null);

  const isDirtyRef = useRef(false);

  const {
    displayDetail,
    isDirty,
    saving,
    saveError,
    setResult,
    save,
    discard,
    resetFromServer,
  } = useRunResultDraft({
    runId: selectedRunId,
    saveRunResults,
  });

  isDirtyRef.current = isDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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

  const loadRunDetail = useCallback(
    async (runId) => {
      if (!runId || !hasRunsRoot) {
        resetFromServer(null);
        return;
      }
      setRunDetailLoading(true);
      try {
        const detail = await getRunDetail(runId);
        resetFromServer(detail);
        setCachedRunDetails((prev) => ({ ...prev, [runId]: detail }));
      } catch {
        resetFromServer(null);
      } finally {
        setRunDetailLoading(false);
      }
    },
    [hasRunsRoot, resetFromServer],
  );

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    return onRunsUpdated(() => {
      if (isDirtyRef.current) return;
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
      if (selectedRunId && !isDirtyRef.current) {
        void loadRunDetail(selectedRunId);
      }
    });
  }, [selectedCasePath, selectedRunId, loadRunDetail]);

  useEffect(() => {
    if (!selectedRunId) {
      resetFromServer(null);
      setSelectedCasePath(null);
      return;
    }
    void loadRunDetail(selectedRunId);
    setSelectedCasePath(null);
    setCaseListPage(1);
  }, [selectedRunId, loadRunDetail, resetFromServer]);

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

  useEffect(() => {
    if (!runContextMenu) return;
    const close = () => setRunContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [runContextMenu]);

  const runCases = useMemo(() => displayDetail?.cases ?? [], [displayDetail]);

  const displayRuns = useMemo(() => {
    if (!isDirty || !selectedRunId || !displayDetail?.cases) {
      return runs;
    }
    const counts = countResultsFromCases(displayDetail.cases);
    return runs.map((r) =>
      r.run_id === selectedRunId
        ? {
            ...r,
            case_count: displayDetail.cases.length,
            ...counts,
          }
        : r,
    );
  }, [runs, isDirty, selectedRunId, displayDetail]);

  const runDetailsByRunId = useMemo(
    () => ({
      ...cachedRunDetails,
      ...(selectedRunId && displayDetail ? { [selectedRunId]: displayDetail } : {}),
    }),
    [cachedRunDetails, selectedRunId, displayDetail],
  );

  const unifiedRunTree = useMemo(
    () => buildUnifiedRunTree(displayRuns, runDetailsByRunId),
    [displayRuns, runDetailsByRunId],
  );

  const {
    selectedFolderPath,
    expanded: folderExpanded,
    setExpanded: setFolderExpanded,
    handleSelectBrowseFolder,
  } = useRunBrowseState({
    tree: unifiedRunTree,
    selectedRunId,
    selectedCaseFilePath: selectedCasePath,
    enabled: displayRuns.length > 0,
  });

  useEffect(() => {
    setCaseListPage(1);
  }, [selectedFolderPath]);

  useEffect(() => {
    if (!selectedFolderPath) return;
    const parsed = parseRunTreePath(selectedFolderPath);
    if (!parsed?.runId || parsed.runId === selectedRunId) return;
    setSelectedRunId(parsed.runId);
  }, [selectedFolderPath, selectedRunId]);

  const folderScopedListEntries = useMemo(() => {
    if (!selectedFolderPath) return null;
    return buildGroupedRunCaseListEntries(runCases, unifiedRunTree, selectedFolderPath);
  }, [selectedFolderPath, runCases, unifiedRunTree]);

  const folderLabel = findRunFolderDisplayName(unifiedRunTree, selectedFolderPath);

  const existingRunPaths = useMemo(
    () => new Set(runCases.map((c) => c.file_path)),
    [runCases],
  );

  const guardUnsaved = useCallback((continueAction) => {
    if (!isDirtyRef.current) {
      continueAction();
      return;
    }
    setUnsavedDialog({ continueAction });
  }, []);

  useEffect(() => {
    if (!registerLeaveHandler) return undefined;
    registerLeaveHandler((proceed) => {
      guardUnsaved(proceed);
    });
    return () => registerLeaveHandler(null);
  }, [registerLeaveHandler, guardUnsaved]);

  const handleUnsavedSave = useCallback(async () => {
    const action = unsavedDialog?.continueAction;
    try {
      await save();
      setUnsavedDialog(null);
      await loadRuns();
      action?.();
    } catch {
      // saveError shown in column 2 header
    }
  }, [unsavedDialog, save, loadRuns]);

  const handleUnsavedDiscard = useCallback(() => {
    const action = unsavedDialog?.continueAction;
    discard();
    setUnsavedDialog(null);
    action?.();
  }, [unsavedDialog, discard]);

  const handleUnsavedCancel = useCallback(() => {
    setUnsavedDialog(null);
  }, []);

  const handleSelectBrowseFolderWithRun = useCallback(
    (path) => {
      if (!path) return;
      const parsed = parseRunTreePath(path);
      if (!parsed?.runId) return;

      const applySelection = () => {
        handleSelectBrowseFolder(path);
        if (parsed.runId !== selectedRunId) {
          setSelectedRunId(parsed.runId);
          setSelectedCasePath(null);
        } else if (parsed.isRunRoot) {
          setSelectedCasePath(null);
        }
        setCaseListPage(1);
      };

      if (parsed.runId !== selectedRunId) {
        guardUnsaved(applySelection);
      } else {
        applySelection();
      }
    },
    [handleSelectBrowseFolder, selectedRunId, guardUnsaved],
  );

  const handleCommitCreateRun = useCallback(
    async (name) => {
      if (!name?.trim()) {
        setCreatingRun(false);
        return;
      }
      const sanitized = sanitizeNameForPath(name);
      if (!sanitized) {
        setCreatingRun(false);
        await confirm({
          title: "Could not create run",
          description:
            "Invalid run name. Use only letters, numbers, underscores, and hyphens.",
          confirmLabel: "OK",
          variant: "danger",
        });
        return;
      }
      const title = displayNameFromSanitized(sanitized);
      try {
        if (!hasRunsRoot) {
          await initializeRunsRoot();
          onRunsRootInitialized?.();
        }
        const detail = await createRun(sanitized, title);
        await loadRuns();
        setCreatingRun(false);
        setSelectedRunId(detail.run_id);
      } catch (err) {
        setCreatingRun(false);
        await confirm({
          title: "Could not create run",
          description: err?.message || "Failed to create run",
          confirmLabel: "OK",
          variant: "danger",
        });
      }
    },
    [confirm, hasRunsRoot, loadRuns, onRunsRootInitialized],
  );

  const handleDeleteRun = useCallback(
    (runId) => {
      const performDelete = async () => {
        const run = runs.find((r) => r.run_id === runId);
        const label = run?.title?.trim() || runId;
        const ok = await confirm({
          title: "Delete test run?",
          description: `Permanently delete "${label}"? This cannot be undone.`,
          confirmLabel: "Delete",
          variant: "danger",
        });
        if (!ok) return;

        await deleteRun(runId);
        if (selectedRunId === runId) {
          setSelectedRunId(null);
        }
        setCachedRunDetails((prev) => {
          if (!prev[runId]) return prev;
          const next = { ...prev };
          delete next[runId];
          return next;
        });
        await loadRuns();
      };
      if (runId === selectedRunId && isDirtyRef.current) {
        guardUnsaved(() => {
          void performDelete();
        });
        return;
      }
      void performDelete();
    },
    [confirm, guardUnsaved, loadRuns, runs, selectedRunId],
  );

  const handleSetResult = useCallback(
    (_runId, filePath, result) => {
      setResult(filePath, result);
    },
    [setResult],
  );

  const handleSave = useCallback(async () => {
    try {
      await save();
      await loadRuns();
    } catch {
      // saveError shown in header
    }
  }, [save, loadRuns]);

  const handleAddCases = useCallback(
    (paths) => {
      const performAdd = async () => {
        if (!selectedRunId) return;
        const detail = await addRunCases(selectedRunId, paths);
        resetFromServer(detail);
        setCachedRunDetails((prev) => ({ ...prev, [selectedRunId]: detail }));
        setShowAddCasesModal(false);
        await loadRuns();
      };
      guardUnsaved(() => {
        void performAdd();
      });
    },
    [selectedRunId, resetFromServer, loadRuns, guardUnsaved],
  );

  const handleRemoveCase = useCallback(
    (row) => {
      const performRemove = async () => {
        if (!selectedRunId || !row?.file_path) return;
        const detail = await removeRunCase(selectedRunId, row.file_path);
        resetFromServer(detail);
        setCachedRunDetails((prev) => ({ ...prev, [selectedRunId]: detail }));
        if (selectedCasePath === row.file_path) {
          setSelectedCasePath(null);
        }
        await loadRuns();
      };
      guardUnsaved(() => {
        void performRemove();
      });
    },
    [selectedRunId, selectedCasePath, resetFromServer, loadRuns, guardUnsaved],
  );

  const getContextMenuItems = useCallback(
    (row, closeMenu) => [
      {
        label: "Remove from run",
        onClick: () => {
          closeMenu(null);
          handleRemoveCase(row);
        },
      },
    ],
    [handleRemoveCase],
  );

  const openAddCasesModal = useCallback(() => {
    guardUnsaved(() => setShowAddCasesModal(true));
  }, [guardUnsaved]);

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
        {creatingRun ? (
          <div className="mt-6 flex w-full max-w-xs items-center gap-2">
            <TestRunIcon className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <InlineRenameInput
              initialValue=""
              placeholder="Run name…"
              onCommit={handleCommitCreateRun}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreatingRun(true)}
            className="mt-6 rounded-ui bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create first run
          </button>
        )}
      </div>
    );
  }

  const selectedRun = displayRuns.find((r) => r.run_id === selectedRunId);
  const listTitle = folderLabel ?? selectedRun?.title ?? selectedRun?.run_id ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <TestRepositoryThreeColumnLayout
        storageKeys={{
          treeWidth: "testRun.col.treeWidth",
          listWidth: "testRun.col.listWidth",
        }}
        treeColumn={
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-end border-b border-slate-200 px-2 py-1 dark:border-slate-700">
              <TitleBarAddButton tooltip="New run" onClick={() => setCreatingRun(true)} />
            </div>
            <RepositoryFolderTree
              tree={unifiedRunTree}
              selectedFolderPath={selectedFolderPath}
              onSelectFolder={handleSelectBrowseFolderWithRun}
              expanded={folderExpanded}
              onExpandedChange={setFolderExpanded}
              creatingRun={creatingRun}
              onCommitCreateRun={handleCommitCreateRun}
              onContextMenuRun={(node, e) => {
                if (!node?.run_id) return;
                e.preventDefault();
                setRunContextMenu({ x: e.clientX, y: e.clientY, runId: node.run_id });
              }}
              editorLocked
            />
          </div>
        }
        caseListColumn={
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2 py-2 dark:border-slate-700">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {listTitle || "Cases"}
                </span>
                {isDirty ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
                ) : null}
                {saveError ? (
                  <span className="block truncate text-xs text-red-600 dark:text-red-400">{saveError}</span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={!isDirty || saving || !selectedRunId}
                  title="Save test results"
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1 rounded-ui border border-slate-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={!selectedRunId || !hasCasesRoot}
                  title={
                    !hasCasesRoot
                      ? "Initialize the test repository before adding cases"
                      : "Add cases from repository"
                  }
                  onClick={openAddCasesModal}
                  className="inline-flex shrink-0 items-center gap-1 rounded-ui border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add cases
                </button>
              </div>
            </div>
            <RunPaginatedCaseList
              cases={[]}
              listEntries={folderScopedListEntries}
              page={caseListPage}
              onPageChange={setCaseListPage}
              selectedCaseFilePath={selectedCasePath}
              onSelectCase={(row) => setSelectedCasePath(row?.file_path ?? null)}
              folderPath={selectedFolderPath}
              listTitle={listTitle}
              showNoRunWhenEmpty
              showNoFolderWhenEmpty
              noRunMessage="Select a run"
              noFolderMessage="Select a project or suite"
              emptyMessage={
                runDetailLoading
                  ? "Loading…"
                  : selectedFolderPath
                    ? "No cases in this folder"
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
      {runContextMenu ? (
        <ContextMenu
          open
          x={runContextMenu.x}
          y={runContextMenu.y}
          onClose={() => setRunContextMenu(null)}
          items={[
            {
              label: "Delete run",
              icon: Trash2,
              danger: true,
              onClick: () => {
                handleDeleteRun(runContextMenu.runId);
                setRunContextMenu(null);
              },
            },
          ]}
        />
      ) : null}
      <UnsavedChangesDialog
        open={Boolean(unsavedDialog)}
        saving={saving}
        onSave={() => void handleUnsavedSave()}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </div>
  );
}
