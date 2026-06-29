import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderPlus, X } from "lucide-react";
import RepositoryFolderTree from "./RepositoryFolderTree";
import RepositoryVirtualCaseList from "./RepositoryVirtualCaseList";
import { useLazyRepositoryTree } from "../hooks/useLazyRepositoryTree";
import { usePickerBrowseState } from "../hooks/usePickerBrowseState";
import { getCases } from "../services/api";
import {
  normalizeCaseFilePath,
  toggleProjectSelection,
  toggleSuiteSelection,
} from "../utils/casePickerSelection";

const ACTIVE_REPO = "vscode";

/**
 * Modal to pick cases from the test repository and add them to a run.
 */
export default function AddRunCasesModal({
  existingPaths = new Set(),
  onConfirm,
  onClose,
}) {
  const { repositoryTree, projectsReady, treeStructureLoadingPrefixes } =
    useLazyRepositoryTree(ACTIVE_REPO);

  const [selectedFilePaths, setSelectedFilePaths] = useState(() => new Set());
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const {
    selectedFolderPath,
    expanded,
    setExpanded,
    handleSelectBrowseFolder,
  } = usePickerBrowseState({
    tree: repositoryTree,
    enabled: true,
  });

  const filterPath = useCallback(
    (filePath) => !existingPaths.has(normalizeCaseFilePath(filePath)),
    [existingPaths],
  );

  useEffect(() => {
    if (!selectedFolderPath) {
      setCases([]);
      return;
    }
    let cancelled = false;
    setCasesLoading(true);
    getCases(ACTIVE_REPO, { directory: selectedFolderPath })
      .then((res) => {
        if (cancelled) return;
        const items = (res?.items ?? []).filter((row) =>
          filterPath(row.file_path),
        );
        setCases(items);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFolderPath, filterPath]);

  const pickerRows = useMemo(
    () => cases.filter((row) => filterPath(row.file_path)),
    [cases, filterPath],
  );

  const loadCasesForPrefix = useCallback(async (directoryPath) => {
    const res = await getCases(ACTIVE_REPO, { path_prefix: directoryPath });
    return (res?.items ?? []).filter((row) => filterPath(row.file_path));
  }, [filterPath]);

  const handleToggleCase = useCallback((filePath) => {
    const norm = normalizeCaseFilePath(filePath);
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) {
        next.delete(norm);
      } else {
        next.add(norm);
      }
      return next;
    });
  }, []);

  const handleToggleProject = useCallback(
    async (node) => {
      if (!node?.directory_path) return;
      await toggleProjectSelection({
        directoryPath: node.directory_path,
        rows: pickerRows,
        setSelectedFilePaths,
        loadCasesForPrefix,
        filterPath,
      });
    },
    [pickerRows, loadCasesForPrefix, filterPath],
  );

  const handleToggleSuite = useCallback(
    async (node) => {
      if (!node?.directory_path) return;
      await toggleSuiteSelection({
        directoryPath: node.directory_path,
        rows: pickerRows,
        setSelectedFilePaths,
        loadCasesForPrefix,
        filterPath,
      });
    },
    [pickerRows, loadCasesForPrefix, filterPath],
  );

  const handleSubmit = async () => {
    if (selectedFilePaths.size === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm([...selectedFilePaths]);
    } catch (err) {
      setError(err?.message || "Failed to add cases");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex h-[min(720px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-ui border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-white/90" />
            <h2 className="text-lg font-semibold text-white">Add cases</h2>
            {selectedFilePaths.size > 0 ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                {selectedFilePaths.size} selected
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-white/70 transition hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-[220px] shrink-0 flex-col border-r border-slate-200 dark:border-slate-700">
            <RepositoryFolderTree
              tree={repositoryTree}
              projectsReady={projectsReady}
              treeStructureLoadingPrefixes={treeStructureLoadingPrefixes}
              selectedFolderPath={selectedFolderPath}
              onSelectFolder={handleSelectBrowseFolder}
              expanded={expanded}
              onExpandedChange={setExpanded}
              pickerMode
              pickerRows={pickerRows}
              selectedFilePaths={selectedFilePaths}
              onToggleProject={handleToggleProject}
              onToggleSuite={handleToggleSuite}
              filterPath={filterPath}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <RepositoryVirtualCaseList
              cases={pickerRows}
              loading={casesLoading}
              selectedCaseFilePath={null}
              folderPath={selectedFolderPath}
              showNoFolderWhenEmpty
              pickerMode
              selectedFilePaths={selectedFilePaths}
              onToggleCase={handleToggleCase}
              filterPath={filterPath}
            />
          </div>
        </div>

        {error ? (
          <p className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-ui px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedFilePaths.size === 0 || submitting}
            onClick={() => void handleSubmit()}
            className="rounded-ui bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add to run"}
          </button>
        </div>
      </div>
    </div>
  );
}
