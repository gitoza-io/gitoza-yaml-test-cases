import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, FileDown, FileUp } from "lucide-react";
import { findFolderNode, getParentDirectoryPath } from "../utils/caseTree";
import { isArchivedDirectoryPath } from "../constants/casePaths";
import CaseEditorPanel from "../components/CaseEditorPanel";
import CsvImportPanel from "../components/CsvImportPanel";
import TitleBarAddButton from "../components/TitleBarAddButton";
import TreeToolbar from "../components/TreeToolbar";
import SearchPanel from "../components/SearchPanel";
import HiddenViewBanner from "../components/HiddenViewBanner";
import SearchToggleButton from "../components/SearchToggleButton";
import Tooltip from "../components/Tooltip";
import SidebarSection from "../components/SidebarSection";
import TestRepositoryThreeColumnLayout from "../components/TestRepositoryThreeColumnLayout";
import RepositoryFolderTree from "../components/RepositoryFolderTree";
import RepositoryVirtualCaseList from "../components/RepositoryVirtualCaseList";
import { TreeAreaHoverProvider } from "../contexts/TreeAreaHoverContext";
import { caseSearchKeys } from "../constants/searchKeys";
import { TOOLBAR_BTN_BASE, TOOLBAR_BTN_SELECTED } from "../constants/toolbarStyles";
import { useCaseListWindow } from "../hooks/useCaseListWindow";
import { useCasePointerDrag } from "../hooks/useCasePointerDrag";
import { useSearchFolderTree } from "../hooks/useSearchFolderTree";
import { usePinnedProjects } from "../hooks/usePinnedProjects";
import { useSearchPrefs } from "../hooks/useSearchPrefs";
import { commitInlineCaseCreate } from "../utils/inlineCaseCommit";
import { remapExpandKeys, remapPathUnderPrefix } from "../utils/patchRepositoryTree";

const LAST_FOLDER_STORAGE_KEY = "testRepo.twoPane.lastFolder";

function findFolderDisplayName(tree, directoryPath) {
  if (!directoryPath) return null;
  const found = findFolderNode(tree, directoryPath);
  if (!found) return directoryPath.split("/").pop() || directoryPath;
  const name = found.display_name ?? found.name ?? "";
  return found.is_project ? name.replace(/\.gitoza\.test$/i, "") : name;
}

function TestRepository({
  tree = [],
  projectsReady = false,
  treeStructureLoadingPrefixes = null,
  filteredRows = [],
  archivedViewOpen = false,
  onOpenArchivedView,
  onCloseArchivedView,
  dashboardSummary,
  selectedCaseFilePath,
  selectedFolderPath = null,
  onSelectBrowseFolder,
  caseDetail,
  caseDetailLoading = false,
  isEditingCase,
  onSelectCase,
  onClearSelection,
  onToggleEdit,
  onSaveCase,
  onPostCaseComment,
  onDeleteCaseComment,
  onArchiveCase,
  onArchiveFolder,
  onRestoreFolder,
  onRestoreCase,
  onDeleteCase,
  onRenameCase,
  showCreateFormInPanel,
  onStartCreate,
  onCancelCreate,
  onCreateCase,
  onImportBatch,
  onCommitInlineCase,
  effectiveProjectDir,
  contextTargetFolder,
  onContextCreateTestCase,
  onRenameFolder,
  onCreateFolder,
  onDeleteFolder,
  onDeleteProject,
  editorLocked = false,
  onOpenCreateProject,
  creatingProject = false,
  onCommitInlineProject,
  sidebarFooter,
  sidebarTitleRight,
  activeRepoSlug,
  onSearchCases,
  activeSearchChips,
  onImportComplete,
  onOpenExportCases,
  caseFilesDirty = false,
  csvImportDirectory,
  onCsvImportSelectProject,
  onCsvImportClosed,
  onMoveCasesToFolder,
  reviewEnabled = true,
  storageSyncConfigured = false,
  onOpenStorageSyncSettings,
  gitProfileVersion = 0,
  allUsernames = null,
  filterOptions = {},
  onFolderExpand,
  loadingPrefixes,
  loadedPrefixes = null,
  folderRenameRemap = null,
  onFolderRenameRemapConsumed,
  priorityFilter = "all",
  onRegisterCaseListWindow,
  vscodeMode = false,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [importModeOpen, setImportModeOpen] = useState(false);
  const [selectedCasePaths, setSelectedCasePaths] = useState(() => new Set());
  const [creatingCaseInPath, setCreatingCaseInPath] = useState(null);
  const [creatingCaseError, setCreatingCaseError] = useState(null);
  const didInitialFolderRef = useRef(false);
  const prevArchivedViewOpenRef = useRef(archivedViewOpen);
  const { history, favorites, pushHistory, toggleFavorite, isFavorite } =
    useSearchPrefs("case");
  const { pinnedProjectPaths, isPinned, togglePin } = usePinnedProjects(activeRepoSlug, tree);

  useEffect(() => {
    if (!selectedCaseFilePath) setSelectedCasePaths(new Set());
  }, [selectedCaseFilePath]);

  useEffect(() => {
    if (!folderRenameRemap?.oldPathKey || !folderRenameRemap?.newPathKey) return;
    const { oldPath, newPath, oldPathKey, newPathKey } = folderRenameRemap;
    setExpanded((prev) => remapExpandKeys(prev, oldPathKey, newPathKey));
    try {
      const stored = localStorage.getItem(LAST_FOLDER_STORAGE_KEY);
      if (stored) {
        const remapped = remapPathUnderPrefix(stored, oldPath, newPath);
        if (remapped !== stored) {
          localStorage.setItem(LAST_FOLDER_STORAGE_KEY, remapped);
        }
      }
    } catch (_) {}
    onFolderRenameRemapConsumed?.();
  }, [folderRenameRemap, onFolderRenameRemapConsumed]);

  const searchActive = Boolean(activeSearchChips?.length);
  const searchResetKey = useMemo(
    () =>
      (activeSearchChips ?? [])
        .map((c) => `${c.key}:${c.value ?? ""}`)
        .join("|"),
    [activeSearchChips],
  );

  const {
    searchTree,
    searchFolderPath,
    searchExpanded,
    setSearchExpanded,
    handleSelectSearchFolder,
  } = useSearchFolderTree({
    apiTree: tree,
    rows: filteredRows,
    searchActive,
    searchResetKey,
  });

  const listFolderPath = searchOpen ? searchFolderPath : selectedFolderPath;
  const listWindowEnabled = useMemo(() => {
    if (importModeOpen) return false;
    if (archivedViewOpen) return Boolean(selectedFolderPath);
    if (searchOpen) return searchActive;
    return Boolean(selectedFolderPath);
  }, [
    importModeOpen,
    archivedViewOpen,
    searchOpen,
    searchActive,
    selectedFolderPath,
  ]);

  const caseListWindow = useCaseListWindow({
    repoSlug: activeRepoSlug,
    folderPath: listFolderPath,
    searchChips: searchOpen && searchActive ? activeSearchChips : [],
    priorityFilter,
    archiveMode: archivedViewOpen,
    enabled: listWindowEnabled,
  });

  useEffect(() => {
    onRegisterCaseListWindow?.({
      invalidate: caseListWindow.invalidate,
      invalidateAll: caseListWindow.invalidateAll,
      patchLocal: caseListWindow.patchLocal,
      patchLocalForFolder: caseListWindow.patchLocalForFolder,
      sortLocal: caseListWindow.sortLocal,
      snapshotRows: caseListWindow.snapshotRows,
    });
    return () => onRegisterCaseListWindow?.(null);
  }, [
    caseListWindow.invalidate,
    caseListWindow.invalidateAll,
    caseListWindow.patchLocal,
    caseListWindow.patchLocalForFolder,
    caseListWindow.sortLocal,
    caseListWindow.snapshotRows,
    onRegisterCaseListWindow,
  ]);

  const listCasePathsInOrder = useMemo(
    () => caseListWindow.items.map((c) => c.file_path).filter(Boolean),
    [caseListWindow.items],
  );

  const searchListTitle = useMemo(() => {
    if (!searchActive) return "Search results";
    if (searchFolderPath) return findFolderDisplayName(searchTree, searchFolderPath);
    return "Search results";
  }, [searchActive, searchFolderPath, searchTree]);

  const searchSidebarTree = useMemo(() => {
    if (!searchActive) return null;
    if (searchTree.length > 0) {
      return (
        <RepositoryFolderTree
          tree={searchTree}
          selectedFolderPath={searchFolderPath}
          onSelectFolder={handleSelectSearchFolder}
          expanded={searchExpanded}
          onExpandedChange={setSearchExpanded}
          badgeSourceRows={filteredRows}
          loadedPrefixes={loadedPrefixes}
        />
      );
    }
    return (
      <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
        No matching cases in any folder.
      </div>
    );
  }, [
    searchActive,
    searchTree,
    searchFolderPath,
    handleSelectSearchFolder,
    searchExpanded,
    setSearchExpanded,
    filteredRows,
    loadedPrefixes,
  ]);

  const handleSelectBrowseFolder = useCallback(
    (path) => {
      if (!path) return;
      onSelectBrowseFolder?.(path);
      try {
        localStorage.setItem(LAST_FOLDER_STORAGE_KEY, path);
      } catch (_) {}
      onFolderExpand?.(path);
    },
    [onSelectBrowseFolder, onFolderExpand],
  );

  const handleMoveCasesToFolderAndClear = useCallback(
    async (paths, target) => {
      if (!onMoveCasesToFolder) return;
      const previousFolder = selectedFolderPath;

      handleSelectBrowseFolder(target);
      setSelectedCasePaths(new Set());
      onClearSelection?.();

      try {
        await onMoveCasesToFolder(paths, target);
      } catch {
        if (previousFolder && previousFolder !== target) {
          handleSelectBrowseFolder(previousFolder);
        }
      }
    },
    [onMoveCasesToFolder, onClearSelection, handleSelectBrowseFolder, selectedFolderPath],
  );

  const browseSelectionConfig = useMemo(() => {
    if (editorLocked) return null;
    const base = {
      selectedPaths: selectedCasePaths,
      onChange: setSelectedCasePaths,
      orderedPaths: listCasePathsInOrder,
    };
    if (onMoveCasesToFolder) {
      return { ...base, onMoveCasesToFolder: handleMoveCasesToFolderAndClear };
    }
    return base;
  }, [
    editorLocked,
    selectedCasePaths,
    listCasePathsInOrder,
    onMoveCasesToFolder,
    handleMoveCasesToFolderAndClear,
  ]);

  const searchSelectionConfig = useMemo(() => {
    if (editorLocked) return null;
    return {
      selectedPaths: selectedCasePaths,
      onChange: setSelectedCasePaths,
      orderedPaths: listCasePathsInOrder,
    };
  }, [editorLocked, selectedCasePaths, listCasePathsInOrder]);

  const archiveSelectionConfig = useMemo(() => {
    if (editorLocked) return null;
    return {
      selectedPaths: selectedCasePaths,
      onChange: setSelectedCasePaths,
      orderedPaths: listCasePathsInOrder,
    };
  }, [editorLocked, selectedCasePaths, listCasePathsInOrder]);

  const multiSelectActive = Boolean(browseSelectionConfig?.onMoveCasesToFolder) && !archivedViewOpen;
  const browseDrag = useCasePointerDrag({
    multiSelectActive,
    caseSelectionConfig: browseSelectionConfig,
  });

  useEffect(() => {
    didInitialFolderRef.current = false;
  }, [archivedViewOpen]);

  useEffect(() => {
    if (prevArchivedViewOpenRef.current === archivedViewOpen) return;
    prevArchivedViewOpenRef.current = archivedViewOpen;
    caseListWindow.invalidateAll();
  }, [archivedViewOpen, caseListWindow.invalidateAll]);

  useEffect(() => {
    if (!archivedViewOpen || !selectedFolderPath) return;
    if (!isArchivedDirectoryPath(selectedFolderPath)) {
      onSelectBrowseFolder?.(null);
    }
  }, [archivedViewOpen, selectedFolderPath, onSelectBrowseFolder]);

  useEffect(() => {
    if (didInitialFolderRef.current || searchOpen) return;
    if (archivedViewOpen) return;
    if (selectedFolderPath) {
      didInitialFolderRef.current = true;
      return;
    }
    if (!tree?.length) return;

    let initialPath = null;
    if (selectedCaseFilePath) {
      initialPath = getParentDirectoryPath(selectedCaseFilePath);
    } else {
      try {
        const last = localStorage.getItem(LAST_FOLDER_STORAGE_KEY);
        if (last && findFolderNode(tree, last)) initialPath = last;
      } catch (_) {}
      if (!initialPath) {
        initialPath = tree[0]?.directory_path ?? null;
      }
    }
    if (initialPath) {
      handleSelectBrowseFolder(initialPath);
    }
    didInitialFolderRef.current = true;
  }, [
    tree,
    searchOpen,
    archivedViewOpen,
    selectedCaseFilePath,
    selectedFolderPath,
    handleSelectBrowseFolder,
  ]);

  const handleSearch = useCallback(
    (chips) => {
      if (chips.length > 0) pushHistory(chips);
      onSearchCases?.(chips);
    },
    [pushHistory, onSearchCases],
  );

  const handleCloseSearch = useCallback(() => {
    onSearchCases?.([]);
    setSearchOpen(false);
  }, [onSearchCases]);

  const handleSearchClick = useCallback(() => {
    if (searchOpen) {
      handleCloseSearch();
    } else {
      onCloseArchivedView?.();
      setSearchOpen(true);
    }
  }, [searchOpen, handleCloseSearch, onCloseArchivedView]);

  const searchButton = vscodeMode ? null : (
    <SearchToggleButton
      isOpen={searchOpen}
      hasActiveChips={!!activeSearchChips?.length}
      onClick={handleSearchClick}
      ariaLabelWhenClosed="Filter cases"
    />
  );

  const handleArchivedClick = useCallback(() => {
    if (archivedViewOpen) {
      onCloseArchivedView?.();
    } else {
      handleCloseSearch();
      onOpenArchivedView?.();
    }
  }, [archivedViewOpen, onOpenArchivedView, onCloseArchivedView, handleCloseSearch]);

  const archivedButton = (
    <Tooltip label={archivedViewOpen ? "Back to tree" : "Archived cases"} placement="bottom">
      <button
        type="button"
        onClick={handleArchivedClick}
        className={`${TOOLBAR_BTN_BASE} ${archivedViewOpen ? TOOLBAR_BTN_SELECTED : ""}`}
        aria-label={archivedViewOpen ? "Back to tree" : "Archived cases"}
      >
        {archivedViewOpen ? (
          <ArrowLeft className="h-4 w-4" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );

  const handleAddProjectClick = useCallback(() => {
    onCloseArchivedView?.();
    onOpenCreateProject?.();
  }, [onCloseArchivedView, onOpenCreateProject]);

  const handleImportClick = useCallback(() => {
    onCloseArchivedView?.();
    if (searchOpen) handleCloseSearch();
    onCancelCreate?.();
    onClearSelection?.();
    setImportModeOpen(true);
  }, [onCloseArchivedView, searchOpen, handleCloseSearch, onCancelCreate, onClearSelection]);

  const handleImportComplete = useCallback(
    (createdCount) => {
      if (createdCount > 0) {
        onCsvImportClosed?.();
        onImportComplete?.();
        setImportModeOpen(false);
      }
    },
    [onImportComplete, onCsvImportClosed],
  );

  const handleCloseImport = useCallback(() => {
    onCsvImportClosed?.();
    setImportModeOpen(false);
  }, [onCsvImportClosed]);

  const handleSelectCaseWithImportExit = useCallback(
    (row) => {
      if (importModeOpen) handleCloseImport();
      onSelectCase?.(row);
    },
    [importModeOpen, handleCloseImport, onSelectCase],
  );

  const handleExportClick = useCallback(() => {
    if (caseFilesDirty) return;
    onCloseArchivedView?.();
    if (searchOpen) handleCloseSearch();
    onCancelCreate?.();
    onClearSelection?.();
    onOpenExportCases?.();
  }, [
    caseFilesDirty,
    onCloseArchivedView,
    searchOpen,
    handleCloseSearch,
    onCancelCreate,
    onClearSelection,
    onOpenExportCases,
  ]);

  const handleStartCreatingCase = useCallback(
    (path) => {
      setCreatingCaseInPath(path);
      setCreatingCaseError(null);
      handleSelectBrowseFolder(path);
    },
    [handleSelectBrowseFolder],
  );

  const handleCommitInlineCase = useCallback(
    (path, isProject, caseId) =>
      commitInlineCaseCreate({
        path,
        isProject,
        caseId,
        onCommitInlineCase,
        clearCreating: () => setCreatingCaseInPath(null),
        restoreCreating: setCreatingCaseInPath,
        setError: setCreatingCaseError,
        clearError: () => setCreatingCaseError(null),
      }),
    [onCommitInlineCase],
  );

  const importButton = !editorLocked && !vscodeMode ? (
    <Tooltip label="Import test cases (CSV)" placement="bottom">
      <button
        type="button"
        onClick={handleImportClick}
        className={TOOLBAR_BTN_BASE}
        aria-label="Import test cases (CSV)"
      >
        <FileUp className="h-4 w-4" />
      </button>
    </Tooltip>
  ) : null;

  const exportTooltipLabel = caseFilesDirty
    ? "Save case changes first"
    : "Export test cases (CSV or PDF)";
  const exportButton = onOpenExportCases && !vscodeMode ? (
    <Tooltip label={exportTooltipLabel} placement="bottom">
      <button
        type="button"
        onClick={handleExportClick}
        disabled={caseFilesDirty}
        className={TOOLBAR_BTN_BASE}
        aria-label="Export test cases"
        title={caseFilesDirty ? "Save case changes first" : undefined}
      >
        <FileDown className="h-4 w-4" />
      </button>
    </Tooltip>
  ) : null;

  const projectToolbar = (
    <TreeToolbar
      addButton={
        onOpenCreateProject && !editorLocked ? (
          <TitleBarAddButton
            tooltip="Create project"
            onClick={handleAddProjectClick}
            ariaLabel="Create project"
          />
        ) : null
      }
      sortButton={null}
      searchNode={searchButton}
      extraActions={
        vscodeMode ? null : (
        <>
          {importButton}
          {exportButton}
          {archivedButton}
        </>
        )
      }
      onBeforeAction={searchOpen ? handleCloseSearch : undefined}
    />
  );

  const folderLabel = findFolderDisplayName(tree, selectedFolderPath);
  const activeListTitle = searchOpen
    ? searchListTitle
    : archivedViewOpen
      ? (folderLabel ?? "Archived cases")
      : folderLabel;
  const activeListFolderPath = searchOpen ? searchFolderPath : selectedFolderPath;

  const sharedVirtualListProps = {
    cases: caseListWindow.items,
    total: caseListWindow.total,
    loading: caseListWindow.loading,
    loadingMore: caseListWindow.loadingMore,
    hasMore: caseListWindow.hasMore,
    onLoadMore: caseListWindow.loadMore,
    folderPath: activeListFolderPath,
    listTitle: activeListTitle,
    selectedCaseFilePath,
    onSelectCase: handleSelectCaseWithImportExit,
    editorLocked,
  };

  const treeColumnBody = searchOpen ? (
    <SearchPanel
      searchKeys={caseSearchKeys(reviewEnabled)}
      filterOptions={filterOptions}
      onSearch={handleSearch}
      onClose={handleCloseSearch}
      history={history}
      favorites={favorites}
      onToggleFavorite={toggleFavorite}
      isFavorite={isFavorite}
      resultsInSeparateColumn
      sidebarResultsContent={searchSidebarTree}
      freeTextSearchKey="q"
      freeTextPlaceholder="Search by ID, title, tag, path…"
    />
  ) : (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {archivedViewOpen ? (
        <HiddenViewBanner
          label="Archived"
          tooltip="Only archived cases are shown. Click the toolbar button to go back to the main tree."
        />
      ) : null}
      <RepositoryFolderTree
        tree={tree}
        projectsReady={projectsReady}
        treeStructureLoadingPrefixes={treeStructureLoadingPrefixes}
        selectedFolderPath={selectedFolderPath}
        onSelectFolder={handleSelectBrowseFolder}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onContextCreateTestCase={
          editorLocked || archivedViewOpen ? undefined : onContextCreateTestCase
        }
        onCommitInlineCase={
          editorLocked || archivedViewOpen ? undefined : handleCommitInlineCase
        }
        onStartCreatingCase={
          editorLocked || archivedViewOpen ? undefined : handleStartCreatingCase
        }
        onRenameFolder={editorLocked || archivedViewOpen ? undefined : onRenameFolder}
        onCreateFolder={editorLocked || archivedViewOpen ? undefined : onCreateFolder}
        onArchiveFolder={editorLocked || archivedViewOpen ? undefined : onArchiveFolder}
        onRestoreFolder={editorLocked || !archivedViewOpen ? undefined : onRestoreFolder}
        onDeleteFolder={editorLocked ? undefined : onDeleteFolder}
        onDeleteProject={editorLocked ? undefined : onDeleteProject}
        editorLocked={editorLocked}
        archivedView={archivedViewOpen}
        creatingProject={archivedViewOpen ? false : creatingProject}
        onCommitInlineProject={
          editorLocked || archivedViewOpen ? undefined : onCommitInlineProject
        }
        onFolderExpand={onFolderExpand}
        loadingPrefixes={loadingPrefixes}
        dragOverFolderPath={browseDrag.dragOverFolderPath}
        draggingSourcePaths={browseDrag.draggingSourcePaths}
        pinningEnabled
        pinnedProjectPaths={pinnedProjectPaths}
        onTogglePinProject={togglePin}
        isPinnedProject={isPinned}
      />
    </div>
  );

  const caseListColumn = archivedViewOpen ? (
    <RepositoryVirtualCaseList
      {...sharedVirtualListProps}
      showNoFolderWhenEmpty
      emptyMessage={selectedFolderPath ? "No archived cases in this folder" : "Select a folder"}
      archivedView
      caseSelectionConfig={archiveSelectionConfig}
      onRestoreCase={onRestoreCase}
      onDeleteCase={onDeleteCase}
    />
  ) : searchOpen ? (
    <RepositoryVirtualCaseList
      {...sharedVirtualListProps}
      caseSelectionConfig={searchSelectionConfig}
      onArchiveCase={onArchiveCase}
      onRestoreCase={onRestoreCase}
      onDeleteCase={onDeleteCase}
      onRenameCase={onRenameCase}
      emptyMessage={
        activeSearchChips?.length ? "No matching cases found." : "Apply a filter to see results."
      }
    />
  ) : (
    <RepositoryVirtualCaseList
      {...sharedVirtualListProps}
      showNoFolderWhenEmpty
      emptyMessage="No cases in this folder"
      caseSelectionConfig={browseSelectionConfig}
      onDeleteCase={onDeleteCase}
      onArchiveCase={editorLocked ? undefined : onArchiveCase}
      onRestoreCase={editorLocked ? undefined : onRestoreCase}
      onRenameCase={editorLocked ? undefined : onRenameCase}
      creatingCaseInPath={creatingCaseInPath}
      creatingCaseError={creatingCaseError}
      onCommitInlineCase={editorLocked ? undefined : handleCommitInlineCase}
      onClearCreatingCase={() => {
        setCreatingCaseInPath(null);
        setCreatingCaseError(null);
      }}
      onNewCase={
        editorLocked || !selectedFolderPath
          ? undefined
          : () => handleStartCreatingCase(selectedFolderPath)
      }
      dragProps={
        vscodeMode
          ? undefined
          : {
        pointerDragUI: browseDrag.pointerDragUI,
        draggingSourcePaths: browseDrag.draggingSourcePaths,
        handleCaseRowPointerDown: browseDrag.handleCaseRowPointerDown,
      }}
    />
  );

  const detailColumn = importModeOpen ? (
    <CsvImportPanel
      directory={csvImportDirectory}
      targetFolder={contextTargetFolder}
      repoSlug={activeRepoSlug}
      projects={dashboardSummary?.projects ?? []}
      onSelectProject={onCsvImportSelectProject}
      onImportBatch={onImportBatch}
      onCancel={handleCloseImport}
      onImportComplete={handleImportComplete}
    />
  ) : (
    <CaseEditorPanel
      caseDetail={caseDetail}
      selectedCaseFilePath={selectedCaseFilePath}
      caseDetailLoading={caseDetailLoading}
      isEditing={isEditingCase}
      onToggleEdit={onToggleEdit}
      onClearSelection={onClearSelection}
      onSave={onSaveCase}
      onPostCaseComment={onPostCaseComment}
      onDeleteCaseComment={onDeleteCaseComment}
      onArchive={onArchiveCase}
      showCreateForm={showCreateFormInPanel}
      onStartCreate={onStartCreate}
      onCancelCreate={onCancelCreate}
      onCreate={onCreateCase}
      directory={effectiveProjectDir}
      targetFolder={contextTargetFolder}
      editorLocked={editorLocked}
      reviewEnabled={reviewEnabled}
      allTags={filterOptions?.tags}
      paramKeys={filterOptions?.param_keys}
      paramValuesByKey={filterOptions?.param_values_by_key}
      allUsernames={allUsernames}
      repoSlug={activeRepoSlug}
      storageSyncConfigured={storageSyncConfigured}
      onOpenStorageSyncSettings={onOpenStorageSyncSettings}
      gitProfileVersion={gitProfileVersion}
      manualSave={vscodeMode}
    />
  );

  return (
    <TestRepositoryThreeColumnLayout
      treeColumn={
        <TreeAreaHoverProvider>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-200 px-2 py-2 dark:border-slate-700">
              <SidebarSection
                title="Test Repository"
                titleRight={sidebarTitleRight}
                toolbar={projectToolbar}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{treeColumnBody}</div>
            {sidebarFooter != null ? (
              <div
                data-sidebar-footer
                className="shrink-0 border-t border-slate-200 px-2 py-1.5 dark:border-slate-700"
              >
                {sidebarFooter}
              </div>
            ) : null}
          </div>
        </TreeAreaHoverProvider>
      }
      caseListColumn={caseListColumn}
      detailColumn={detailColumn}
    />
  );
}

export default TestRepository;
