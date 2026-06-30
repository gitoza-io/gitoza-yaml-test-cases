import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TestRepository from "./TestRepository";
import CreateProjectModal from "../components/CreateProjectModal";
import { useConfirm } from "../components/ConfirmProvider";
import { CASES_ROOT } from "../constants/casePaths";
import {
  createFolder,
  createProject,
  createTestCase,
  deleteCase,
  deleteFolder,
  deleteProject,
  findRunsReferencingCases,
  getCaseDetail,
  getCaseFilters,
  updateCase,
  initializeCasesRoot,
} from "../services/api";
import { useLazyRepositoryTree } from "../hooks/useLazyRepositoryTree";
import { onCasesUpdated } from "../api/vscodeApi";
import { findFolderNode, isProjectDirectoryPath } from "../utils/caseTree";
import {
  formatRunReferenceWarning,
  pathUnderPrefix,
  pathsFromCaseDeletePayload,
} from "../utils/deleteConfirmCopy";

const ACTIVE_REPO = "vscode";

export default function TestRepositoryPage({ hasCasesRoot, onCasesRootInitialized }) {
  const confirm = useConfirm();
  const { repositoryTree, projectsReady, treeStructureLoadingPrefixes, loadData } =
    useLazyRepositoryTree(ACTIVE_REPO);

  const [selectedCaseFilePath, setSelectedCaseFilePath] = useState(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [showCreateFormInPanel, setShowCreateFormInPanel] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({});
  const caseListWindowRef = useRef(null);

  useEffect(() => {
    getCaseFilters(ACTIVE_REPO)
      .then(setFilterOptions)
      .catch(() => setFilterOptions({}));
  }, []);

  useEffect(() => {
    return onCasesUpdated(() => {
      void loadData();
      caseListWindowRef.current?.invalidateAll?.();
      if (selectedCaseFilePath) {
        getCaseDetail(selectedCaseFilePath, ACTIVE_REPO)
          .then(setCaseDetail)
          .catch(() => {});
      }
    });
  }, [loadData, selectedCaseFilePath]);

  useEffect(() => {
    if (!selectedCaseFilePath) {
      setCaseDetail(null);
      return;
    }
    let cancelled = false;
    setCaseDetailLoading(true);
    getCaseDetail(selectedCaseFilePath, ACTIVE_REPO)
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
  }, [selectedCaseFilePath]);

  const effectiveProjectDir = useMemo(() => {
    if (!selectedFolderPath) return null;
    if (isProjectDirectoryPath(selectedFolderPath)) return selectedFolderPath;
    const node = findFolderNode(repositoryTree, selectedFolderPath);
    if (!node) return selectedFolderPath;
    let path = selectedFolderPath;
    while (path && !isProjectDirectoryPath(path)) {
      const parent = path.replace(/\/[^/]+$/, "");
      if (!parent || parent === path) break;
      path = parent;
    }
    return isProjectDirectoryPath(path) ? path : selectedFolderPath;
  }, [selectedFolderPath, repositoryTree]);

  const handleSelectCase = useCallback((row) => {
    setShowCreateFormInPanel(false);
    setIsEditingCase(false);
    setSelectedCaseFilePath(row?.file_path ?? null);
  }, []);

  const handleSelectBrowseFolder = useCallback((path) => {
    setSelectedFolderPath(path);
    setSelectedCaseFilePath(null);
    setIsEditingCase(false);
    setShowCreateFormInPanel(false);
  }, []);

  const handleToggleEdit = useCallback((editing) => {
    setIsEditingCase(Boolean(editing));
  }, []);

  const handleSaveCase = useCallback(async (payload) => {
    const filePath = payload.file_path;
    await updateCase(
      filePath,
      {
        title: payload.title,
        priority: payload.priority,
        tags: payload.tags,
        body: payload.body,
        requirement_id: payload.requirement_id,
        assigned_to: payload.assigned_to,
        automated: payload.automated,
        params: payload.params,
      },
      ACTIVE_REPO,
    );
    const detail = await getCaseDetail(filePath, ACTIVE_REPO);
    setCaseDetail(detail);
    setIsEditingCase(false);
  }, []);

  const handleCreateCase = useCallback(
    async (payload) => {
      const res = await createTestCase(
        {
          ...payload,
          directory: payload.directory || effectiveProjectDir,
        },
        ACTIVE_REPO,
      );
      await loadData();
      if (res?.file_path) {
        setSelectedCaseFilePath(res.file_path);
        setShowCreateFormInPanel(false);
        setIsEditingCase(false);
      }
    },
    [effectiveProjectDir, loadData],
  );

  const handleCreateProject = useCallback(
    async (name) => {
      await createProject(name, ACTIVE_REPO);
      await loadData();
      setShowCreateProjectModal(false);
      setCreatingProject(false);
      if (!hasCasesRoot) {
        onCasesRootInitialized?.();
      }
    },
    [hasCasesRoot, loadData, onCasesRootInitialized],
  );

  const handleCommitInlineProject = useCallback(
    async (name) => {
      setCreatingProject(false);
      if (!name?.trim()) return;
      if (!hasCasesRoot) {
        await initializeCasesRoot();
        onCasesRootInitialized?.();
      }
      await handleCreateProject(name.trim());
    },
    [handleCreateProject, hasCasesRoot, onCasesRootInitialized],
  );

  const handleCreateFolder = useCallback(
    async (parentPath, folderName) => {
      await createFolder(parentPath, folderName, ACTIVE_REPO);
      await loadData();
    },
    [loadData],
  );

  const handleCommitInlineCase = useCallback(
    async (path, _isProject, caseId) => {
      await createTestCase(
        {
          directory: isProjectDirectoryPath(path) ? path : effectiveProjectDir,
          target_folder: isProjectDirectoryPath(path) ? undefined : path,
          case_id: caseId,
          title: caseId,
        },
        ACTIVE_REPO,
      );
      await loadData();
    },
    [effectiveProjectDir, loadData],
  );

  const clearSelectionUnderPath = useCallback((deletedPath) => {
    if (selectedCaseFilePath && pathUnderPrefix(selectedCaseFilePath, deletedPath)) {
      setSelectedCaseFilePath(null);
      setCaseDetail(null);
      setIsEditingCase(false);
    }
    if (selectedFolderPath && pathUnderPrefix(selectedFolderPath, deletedPath)) {
      setSelectedFolderPath(null);
    }
  }, [selectedCaseFilePath, selectedFolderPath]);

  const appendRunWarning = useCallback(async (paths, description) => {
    try {
      const refs = await findRunsReferencingCases(paths);
      const warning = formatRunReferenceWarning(refs);
      if (!warning) return description;
      return description ? `${description}\n\n${warning}` : warning;
    } catch {
      return description;
    }
  }, []);

  const handleDeleteCase = useCallback(
    async (payload) => {
      const paths = pathsFromCaseDeletePayload(payload);
      if (!paths.length) return;

      const rows = payload.rows ?? (payload.row ? [payload.row] : []);
      const count = paths.length;
      const firstLabel =
        rows[0]?.title?.trim() || rows[0]?.case_id || paths[0].split("/").pop()?.replace(/\.ya?ml$/i, "");

      let description =
        count === 1
          ? `Permanently delete "${firstLabel}"? This cannot be undone.`
          : `Permanently delete ${count} test cases? This cannot be undone.`;

      if (
        isEditingCase &&
        selectedCaseFilePath &&
        paths.some((p) => p === selectedCaseFilePath)
      ) {
        description = `You have unsaved changes on this case.\n\n${description}`;
      }

      description = await appendRunWarning(paths, description);

      const ok = await confirm({
        title: count === 1 ? "Delete test case?" : `Delete ${count} test cases?`,
        description,
        confirmLabel: "Delete",
        variant: "danger",
      });
      if (!ok) return;

      await deleteCase(paths);
      for (const p of paths) {
        clearSelectionUnderPath(p);
      }
      await loadData();
      caseListWindowRef.current?.invalidateAll?.();
    },
    [
      appendRunWarning,
      clearSelectionUnderPath,
      confirm,
      isEditingCase,
      loadData,
      selectedCaseFilePath,
    ],
  );

  const handleDeleteFolder = useCallback(
    async (folderPath) => {
      if (!folderPath) return;
      const node = findFolderNode(repositoryTree, folderPath);
      const label = node?.display_name ?? node?.name ?? folderPath.split("/").pop();
      const caseCount = node?.case_count ?? 0;

      let description = `Permanently delete suite "${label}"`;
      if (caseCount > 0) {
        description += ` and ${caseCount} test case${caseCount === 1 ? "" : "s"}`;
      }
      description += "? This cannot be undone.";
      description = await appendRunWarning([folderPath], description);

      const ok = await confirm({
        title: "Delete test suite?",
        description,
        confirmLabel: "Delete",
        variant: "danger",
      });
      if (!ok) return;

      await deleteFolder(folderPath);
      clearSelectionUnderPath(folderPath);
      await loadData();
      caseListWindowRef.current?.invalidateAll?.();
    },
    [appendRunWarning, clearSelectionUnderPath, confirm, loadData, repositoryTree],
  );

  const handleDeleteProject = useCallback(
    async (node) => {
      const projectPath = node?.directory_path;
      if (!projectPath) return;
      const label = node.display_name ?? node.name ?? projectPath.split("/").pop();
      const caseCount = node.case_count ?? 0;
      const suiteCount = node.children?.length ?? 0;

      let description = `Permanently delete project "${label}"`;
      if (caseCount > 0 || suiteCount > 0) {
        const parts = [];
        if (caseCount > 0) {
          parts.push(`${caseCount} test case${caseCount === 1 ? "" : "s"}`);
        }
        if (suiteCount > 0) {
          parts.push(`${suiteCount} suite${suiteCount === 1 ? "" : "s"}`);
        }
        description += ` and ${parts.join(" in ")}`;
      }
      description += "? This cannot be undone.";
      description = await appendRunWarning([projectPath], description);

      const ok = await confirm({
        title: "Delete project?",
        description,
        confirmLabel: "Delete",
        variant: "danger",
      });
      if (!ok) return;

      await deleteProject(projectPath);
      clearSelectionUnderPath(projectPath);
      await loadData();
      caseListWindowRef.current?.invalidateAll?.();
    },
    [appendRunWarning, clearSelectionUnderPath, confirm, loadData],
  );

  if (!hasCasesRoot) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Initialize test repository
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          No <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">{CASES_ROOT}</code>{" "}
          folder found in this workspace. Create your first project to get started.
        </p>
        <button
          type="button"
          onClick={() => setShowCreateProjectModal(true)}
          className="mt-6 rounded-ui bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create first project
        </button>
        {showCreateProjectModal ? (
          <CreateProjectModal
            onSubmit={async (name) => {
              await initializeCasesRoot();
              await handleCreateProject(name);
            }}
            onClose={() => setShowCreateProjectModal(false)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <TestRepository
        vscodeMode
        tree={repositoryTree}
        projectsReady={projectsReady}
        treeStructureLoadingPrefixes={treeStructureLoadingPrefixes}
        selectedCaseFilePath={selectedCaseFilePath}
        selectedFolderPath={selectedFolderPath}
        onSelectBrowseFolder={handleSelectBrowseFolder}
        caseDetail={caseDetail}
        caseDetailLoading={caseDetailLoading}
        isEditingCase={isEditingCase}
        onSelectCase={handleSelectCase}
        onClearSelection={() => {
          setSelectedCaseFilePath(null);
          setIsEditingCase(false);
        }}
        onToggleEdit={handleToggleEdit}
        onSaveCase={handleSaveCase}
        showCreateFormInPanel={showCreateFormInPanel}
        onStartCreate={() => setShowCreateFormInPanel(true)}
        onCancelCreate={() => setShowCreateFormInPanel(false)}
        onCreateCase={handleCreateCase}
        onCommitInlineCase={handleCommitInlineCase}
        effectiveProjectDir={effectiveProjectDir}
        contextTargetFolder={selectedFolderPath}
        onContextCreateTestCase={() => setShowCreateFormInPanel(true)}
        onCreateFolder={handleCreateFolder}
        onOpenCreateProject={() => setCreatingProject(true)}
        creatingProject={creatingProject}
        onCommitInlineProject={handleCommitInlineProject}
        activeRepoSlug={ACTIVE_REPO}
        reviewEnabled={false}
        filterOptions={filterOptions}
        priorityFilter="all"
        onRegisterCaseListWindow={(api) => {
          caseListWindowRef.current = api;
        }}
        onDeleteCase={handleDeleteCase}
        onDeleteFolder={handleDeleteFolder}
        onDeleteProject={handleDeleteProject}
      />
      {showCreateProjectModal ? (
        <CreateProjectModal
          onSubmit={handleCreateProject}
          onClose={() => setShowCreateProjectModal(false)}
        />
      ) : null}
    </div>
  );
}
