import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Archive,
  FilePlus2,
  Files,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { isArchivedCasePath, stripCasesRootPrefix } from "../constants/casePaths";
import { buildCaseTree, pruneEmptyNodes } from "../utils/caseTree";
import { computeRenamedCasePath, buildCaseActionPayload } from "../utils/caseCatalogMove";
import { isCaseInRenameSession, isRenameNameConflictError } from "../utils/renameConflict";
import ContextMenu from "./ContextMenu";
import InlineRenameConflictAlert from "./InlineRenameConflictAlert";
import InlineRenameInput from "./InlineRenameInput";
import CaseTreeCaseRow from "./CaseTreeCaseRow";
import VirtualCaseList from "./VirtualCaseList";
import {
  sidebarRowNoHoverClass,
  TreeRowGuides,
  TREE_ROW_CONTENT_GAP,
  treeRowSelectedFullWidthClass,
  treeRowHoverFullWidthClass,
} from "./SidebarSection";
import { findFolderDropPathFromPoint } from "../utils/folderDrop";

/** Drag payload: list of repo-relative case YAML paths. */
export const CASE_PATHS_DRAG_MIME = "application/x-gitoza-case-paths";

/** Collect all case file_paths under a node (node.cases + recursive children). */
function collectCaseFilePaths(node) {
  const direct = (node.cases ?? []).map((c) => c.file_path);
  const fromChildren = (node.children ?? []).flatMap((ch) => collectCaseFilePaths(ch));
  return [...direct, ...fromChildren];
}

/**
 * Obsidian-style tree: level 1 = projects, level 2 = suites, level 3 = cases (by title, no file names).
 * Click case → onSelectCase(row). Context menu: folders (New Case / Suite / Rename / Delete); cases (Rename / Archive or Restore / Delete).
 * When pickerMode: show checkboxes on projects, suites, and cases; selectedFilePaths (Set), onToggleCase,
 * onToggleSuite(node) => Promise<void>, onToggleProject.
 *
 * When `caseSelectionConfig` is set (and not pickerMode): Ctrl/Cmd+click toggles selection, Shift+click range-selects
 * using `orderedPaths`, case rows use pointer-driven drag onto suite/project rows to move cases (HTML5 DnD is unreliable in WKWebView/Tauri).
 *
 * @param {{
 *   selectedPaths: Set<string>;
 *   onChange: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
 *   orderedPaths: string[];
 *   onMoveCasesToFolder: (filePaths: string[], targetFolderPath: string) => Promise<void>;
 * } | null} [caseSelectionConfig]
 */
function CaseTree({
  tree = [],
  rows = [],
  selectedCaseFilePath = null,
  onSelectCase,
  onContextCreateTestCase,
  onRenameFolder,
  onCreateFolder,
  onDeleteFolder,
  /** Called when user chooses Delete project from context menu on a project folder row. */
  onDeleteProject,
  editorLocked = false,
  /** Called when user commits inline new case: (parentDirPath, isProject, caseId). caseId null on cancel. */
  onCommitInlineCase,
  /** When true, show inline "new project" row at root. onCommitInlineProject(name) on commit, null on cancel. */
  creatingProject = false,
  onCommitInlineProject,
  /** Optional render prop for right-side content on each case row (e.g. approve/reject in Review). */
  caseRowRight,
  pickerMode = false,
  selectedFilePaths,
  onToggleCase,
  onToggleSuite,
  /** Picker mode: bulk toggle all cases under a project (lazy-load aware). */
  onToggleProject,
  /** When true, all tree nodes are forced to be expanded (used in search results). */
  forceExpandAll = false,
  /** When true, prune tree nodes that have zero cases (and no non-empty children). Hides empty suites/projects in search results. */
  hideEmptyNodes = false,
  /** When true, archive view: restore/delete only (no create/edit/drag). */
  archivedView = false,
  /** Controlled expand: when both provided, parent owns expanded state (for toolbar expand/collapse all). */
  expanded: expandedProp,
  onExpandedChange,
  /** Called when user chooses Archive from context menu on a case row. */
  onArchiveCase,
  /** Called when user chooses Restore from context menu on an archived case row. */
  onRestoreCase,
  /** Called when user chooses Delete from context menu on a case row. */
  onDeleteCase,
  /** Called when user commits inline rename on a case row: (row, newCaseIdStem). */
  onRenameCase,
  caseSelectionConfig = null,
  /** Review (editorLocked): bulk approve all cases under a project/suite folder. */
  onReviewBulkApprove,
  /** Review (editorLocked): bulk reject all cases under a project/suite folder. */
  onReviewBulkReject,
  /** When true, disable review bulk menu actions (e.g. readOnly or in-flight approval). */
  reviewBulkActionsDisabled = false,
  /** Lazy-load: fetch case rows for this folder when the user expands it. */
  onFolderExpand,
  /** Set of directory_path values currently loading case rows. */
  loadingPrefixes,
}) {
  const [internalExpanded, setInternalExpanded] = useState(() => new Set());
  const isControlled = expandedProp !== undefined && onExpandedChange != null;
  const expanded = isControlled ? expandedProp : internalExpanded;
  const setExpanded = isControlled ? onExpandedChange : setInternalExpanded;

  const [contextMenu, setContextMenu] = useState(null);
  const [renamingPath, setRenamingPath] = useState(null);
  const [renamingCaseSession, setRenamingCaseSession] = useState(null);
  const [renameCaseConflict, setRenameCaseConflict] = useState(null);
  const [renameFolderConflict, setRenameFolderConflict] = useState(null);
  const [creatingInPath, setCreatingInPath] = useState(null);
  const [creatingCaseInPath, setCreatingCaseInPath] = useState(null);
  const [creatingCaseError, setCreatingCaseError] = useState(null);
  const [dragOverFolderPath, setDragOverFolderPath] = useState(null);
  /** Floating chip + source-row styling while pointer-dragging cases to a folder. */
  const [pointerDragUI, setPointerDragUI] = useState(null);
  const selectionAnchorRef = useRef(null);
  /** True while a case row pointer-drag is active (after movement slop); used for folder highlight. */
  const isDraggingCasesRef = useRef(false);
  const pointerDragPathsRef = useRef(null);
  const pointerSessionActiveRef = useRef(false);

  const multiSelectActive = Boolean(caseSelectionConfig) && !pickerMode && !editorLocked;

  const getSelectedActionPaths = useCallback(
    (clickedCase) => {
      const clickedPath = clickedCase?.file_path;
      if (!multiSelectActive || !caseSelectionConfig || !clickedPath) return [];
      const selected = caseSelectionConfig.selectedPaths;
      if (selected && selected.size > 0) {
        // If the user right-clicked an unselected item, treat that as a single-target action.
        if (!selected.has(clickedPath)) return [clickedPath];
        return Array.from(selected);
      }
      return [clickedPath];
    },
    [multiSelectActive, caseSelectionConfig],
  );

  const endCaseDrag = useCallback(() => {
    isDraggingCasesRef.current = false;
    setDragOverFolderPath(null);
    setPointerDragUI(null);
    document.body.style.cursor = "";
  }, []);

  const notifyCaseDragStart = useCallback(() => {
    isDraggingCasesRef.current = true;
    setDragOverFolderPath(null);
  }, []);

  const applyMoveCasesToFolder = useCallback(
    async (paths, targetFolderPath) => {
      if (!caseSelectionConfig?.onMoveCasesToFolder || !targetFolderPath || !Array.isArray(paths) || paths.length === 0)
        return;
      const filtered = paths.filter((p) => {
        if (typeof p !== "string" || !p.includes("/")) return false;
        const parent = p.slice(0, p.lastIndexOf("/"));
        return parent !== targetFolderPath;
      });
      if (filtered.length === 0) return;
      await caseSelectionConfig.onMoveCasesToFolder(filtered, targetFolderPath);
    },
    [caseSelectionConfig],
  );

  /**
   * WKWebView (Tauri) does not deliver HTML5 dragover/drop to folder rows; use pointer capture + hit-test instead.
   */
  const handleCaseRowPointerDown = useCallback(
    (e, dragMeta) => {
      if (e.button !== 0 || !multiSelectActive || !caseSelectionConfig || pointerSessionActiveRef.current) return;
      if (e.target?.closest?.('input[type="checkbox"]')) return;

      const dragPaths = dragMeta.paths;
      const startX = e.clientX;
      const startY = e.clientY;
      const rowEl = e.currentTarget;
      let slopBroken = false;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!slopBroken) {
          if (dx * dx + dy * dy < 36) return;
          slopBroken = true;
          pointerSessionActiveRef.current = true;
          try {
            rowEl.setPointerCapture(ev.pointerId);
          } catch (_) {}
          isDraggingCasesRef.current = true;
          pointerDragPathsRef.current = dragPaths;
          notifyCaseDragStart();
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        }
        ev.preventDefault();
        setPointerDragUI({
          x: ev.clientX,
          y: ev.clientY,
          paths: dragPaths,
          summaryLine: dragMeta.summaryLine,
          detailLine: dragMeta.detailLine,
        });
        const p = findFolderDropPathFromPoint(ev.clientX, ev.clientY);
        setDragOverFolderPath(p);
      };

      const finish = async (ev) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.style.userSelect = "";
        if (!slopBroken) return;
        try {
          if (rowEl.hasPointerCapture?.(ev.pointerId)) rowEl.releasePointerCapture(ev.pointerId);
        } catch (_) {}

        const targetPath = findFolderDropPathFromPoint(ev.clientX, ev.clientY);
        const pathsToMove = pointerDragPathsRef.current;
        pointerDragPathsRef.current = null;
        isDraggingCasesRef.current = false;
        setDragOverFolderPath(null);
        pointerSessionActiveRef.current = false;
        endCaseDrag();

        try {
          if (targetPath && pathsToMove?.length) await applyMoveCasesToFolder(pathsToMove, targetPath);
        } finally {
          const suppressClick = (ce) => {
            ce.preventDefault();
            ce.stopPropagation();
            document.removeEventListener("click", suppressClick, true);
          };
          document.addEventListener("click", suppressClick, true);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [multiSelectActive, caseSelectionConfig, notifyCaseDragStart, applyMoveCasesToFolder, endCaseDrag],
  );

  const handleCaseRowClick = useCallback(
    (c, e) => {
      if (!multiSelectActive || !caseSelectionConfig) {
        onSelectCase?.(c);
        return;
      }
      const path = c.file_path;
      const order = caseSelectionConfig.orderedPaths;
      if (e.shiftKey && selectionAnchorRef.current && order.length) {
        const i1 = order.indexOf(selectionAnchorRef.current);
        const i2 = order.indexOf(path);
        if (i1 !== -1 && i2 !== -1) {
          const [a, b] = i1 <= i2 ? [i1, i2] : [i2, i1];
          caseSelectionConfig.onChange(new Set(order.slice(a, b + 1)));
          onSelectCase?.(c);
          e.preventDefault();
          return;
        }
      }
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        caseSelectionConfig.onChange((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        selectionAnchorRef.current = path;
        onSelectCase?.(c);
        return;
      }
      selectionAnchorRef.current = path;
      caseSelectionConfig.onChange(new Set([path]));
      onSelectCase?.(c);
    },
    [multiSelectActive, caseSelectionConfig, onSelectCase],
  );

  const rawTree = useMemo(
    () => buildCaseTree(tree, rows),
    [tree, rows],
  );
  const treeWithCases = useMemo(
    () => (hideEmptyNodes ? pruneEmptyNodes(rawTree) : rawTree),
    [rawTree, hideEmptyNodes],
  );

  useEffect(() => {
    if (!forceExpandAll || !treeWithCases.length) return;
    const keys = new Set();
    const collect = (nodes, prefix) => {
      for (const n of nodes) {
        const pk = prefix ? `${prefix}/${n.name}` : n.name;
        keys.add(pk);
        if (n.children?.length) collect(n.children, pk);
      }
    };
    collect(treeWithCases, "");
    setExpanded(keys);
  }, [forceExpandAll, treeWithCases]);

  const toggle = useCallback((pathKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }, [setExpanded]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const handleContextNewCase = () => {
    if (contextMenu?.node?.directory_path && onCommitInlineCase) {
      setCreatingCaseInPath(contextMenu.node.directory_path);
      setCreatingCaseError(null);
      const pathKey = stripCasesRootPrefix(contextMenu.node.directory_path ?? "") || contextMenu.node.name;
      setExpanded((prev) => new Set([...prev, pathKey]));
    } else if (contextMenu?.node?.directory_path) {
      onContextCreateTestCase?.(contextMenu.node.directory_path);
    }
    setContextMenu(null);
  };

  const handleContextNewSuite = () => {
    if (contextMenu?.node?.directory_path) {
      setCreatingInPath(contextMenu.node.directory_path);
      setExpanded((prev) => new Set([...prev, contextMenu.node.name]));
    }
    setContextMenu(null);
  };

  const handleContextRename = () => {
    if (contextMenu?.node?.directory_path) {
      setRenamingPath(contextMenu.node.directory_path);
      setRenameFolderConflict(null);
    }
    setContextMenu(null);
  };

  const handleContextDelete = () => {
    if (contextMenu?.node?.directory_path) onDeleteFolder?.(contextMenu.node.directory_path);
    setContextMenu(null);
  };

  const handleRenameCommit = async (folderPath, newName) => {
    if (newName == null) {
      setRenamingPath(null);
      setRenameFolderConflict(null);
      return;
    }
    if (!onRenameFolder) {
      setRenamingPath(null);
      setRenameFolderConflict(null);
      return;
    }
    setRenameFolderConflict(null);
    try {
      await onRenameFolder(folderPath, newName);
      setRenamingPath(null);
      setRenameFolderConflict(null);
    } catch (err) {
      if (isRenameNameConflictError(err)) {
        setRenameFolderConflict({ folderPath, displayName: err.displayName });
        setRenamingPath(folderPath);
        return;
      }
      setRenamingPath(null);
      setRenameFolderConflict(null);
    }
  };

  const handleCreateFolderCommit = (parentPath, folderName) => {
    setCreatingInPath(null);
    if (folderName && onCreateFolder) onCreateFolder(parentPath, folderName);
  };

  const handleCaseRenameCommit = async (caseRow, newName) => {
    if (newName == null) {
      setRenamingCaseSession(null);
      setRenameCaseConflict(null);
      return;
    }
    if (!onRenameCase) return;
    const sourcePath = caseRow.file_path;
    const targetPath = computeRenamedCasePath(sourcePath, newName);
    setRenamingCaseSession({ sourcePath, targetPath });
    setRenameCaseConflict(null);
    try {
      await onRenameCase(caseRow, newName);
      setRenamingCaseSession(null);
      setRenameCaseConflict(null);
    } catch (err) {
      if (isRenameNameConflictError(err)) {
        setRenameCaseConflict({ sourcePath, displayName: err.displayName });
        setRenamingCaseSession({ sourcePath, targetPath: null });
        return;
      }
      setRenamingCaseSession(null);
      setRenameCaseConflict(null);
    }
  };

  if (!treeWithCases?.length && !creatingProject) {
    return (
      <div className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
        {hideEmptyNodes ? "No matching cases found." : "No test suites in repository."}
      </div>
    );
  }

  // Build context menu items for cases and folders.
  let contextMenuItems = [];
  if (contextMenu && !pickerMode) {
    if (contextMenu.case && !editorLocked) {
      const c = contextMenu.case;
      const isArchived = isArchivedCasePath(c.file_path);
      const actionPaths = getSelectedActionPaths(c);
      const actionCount = actionPaths.length || 1;
      const bulkSuffix = actionCount > 1 ? ` (${actionCount})` : "";
      if (isArchived) {
        if (onRestoreCase) {
          contextMenuItems.push({
            icon: Archive,
            label: `Restore${bulkSuffix}`,
            onClick: () => {
              const payload = buildCaseActionPayload(actionPaths, c);
              if (payload) onRestoreCase(payload);
            },
          });
        }
        if (onDeleteCase) {
          if (contextMenuItems.length > 0) {
            contextMenuItems.push({ type: "separator" });
          }
          contextMenuItems.push({
            icon: Trash2,
            label: `Delete permanently${bulkSuffix}`,
            variant: "danger",
            onClick: () => {
              const payload = buildCaseActionPayload(actionPaths, c);
              if (payload) onDeleteCase(payload);
            },
          });
        }
      } else {
        const renameEnabled = !multiSelectActive || !caseSelectionConfig?.selectedPaths || caseSelectionConfig.selectedPaths.size <= 1;
        if (onRenameCase && renameEnabled) {
          contextMenuItems.push({
            icon: Pencil,
            label: "Rename",
            onClick: () => {
              setRenamingCaseSession({ sourcePath: c.file_path, targetPath: null });
              setRenameCaseConflict(null);
              setContextMenu(null);
            },
          });
        }
        if (onArchiveCase) {
          if (contextMenuItems.length > 0) {
            contextMenuItems.push({ type: "separator" });
          }
          contextMenuItems.push({
            icon: Archive,
            label: `Archive${bulkSuffix}`,
            onClick: () => {
              const payload = buildCaseActionPayload(actionPaths, c);
              if (payload) onArchiveCase(payload);
            },
          });
        }
      }
    } else if (
      contextMenu.node &&
      editorLocked &&
      (onReviewBulkApprove || onReviewBulkReject)
    ) {
      const bulkPaths = collectCaseFilePaths(contextMenu.node);
      const n = bulkPaths.length;
      const bulkDisabled = n === 0 || reviewBulkActionsDisabled;
      if (onReviewBulkApprove) {
        contextMenuItems.push({
          icon: Check,
          label: `Approve all (${n})`,
          disabled: bulkDisabled,
          onClick: () => onReviewBulkApprove(bulkPaths),
        });
      }
      if (onReviewBulkReject) {
        if (contextMenuItems.length > 0) {
          contextMenuItems.push({ type: "separator" });
        }
        contextMenuItems.push({
          icon: XCircle,
          label: `Reject all (${n})`,
          disabled: bulkDisabled,
          onClick: () => onReviewBulkReject(bulkPaths),
        });
      }
    } else if (contextMenu.node && !editorLocked && archivedView) {
      const isProject = contextMenu.node?.is_project === true;
      if (!isProject && onDeleteFolder) {
        contextMenuItems = [
          {
            icon: Trash2,
            label: "Delete Suite",
            onClick: handleContextDelete,
            variant: "danger",
          },
        ];
      } else if (isProject && onDeleteProject) {
        contextMenuItems = [
          {
            icon: Trash2,
            label: "Delete project…",
            variant: "danger",
            onClick: () => onDeleteProject(contextMenu.node),
          },
        ];
      }
    } else if (contextMenu.node && !editorLocked && !archivedView) {
      contextMenuItems = [
        { icon: FilePlus2, label: "New Test Case", onClick: handleContextNewCase },
        { icon: FolderPlus, label: "New Test Suite", onClick: handleContextNewSuite },
      ];
      if (onRenameFolder) {
        contextMenuItems.push(
          { type: "separator" },
          { icon: Pencil, label: "Rename", onClick: handleContextRename },
        );
      }
    }
  }

  return (
    <>
      {pointerDragUI &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[400] max-w-[min(100vw-24px,20rem)]"
            style={{
              left: pointerDragUI.x,
              top: pointerDragUI.y,
              transform: "translate(14px, 12px)",
            }}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5 rounded-ui border-2 border-indigo-500 bg-white px-3 py-2.5 shadow-xl dark:border-indigo-400 dark:bg-slate-900">
              <div className="flex shrink-0 items-center gap-1 text-indigo-600 dark:text-indigo-400" aria-hidden>
                <GripVertical className="h-5 w-5" />
                {pointerDragUI.paths.length > 1 ? <Files className="h-4 w-4" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                  {pointerDragUI.summaryLine}
                </p>
                {pointerDragUI.detailLine ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {pointerDragUI.detailLine}
                  </p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )}
      <ul className="space-y-0">
        {creatingProject && onCommitInlineProject && (
          <li>
            <div className="flex min-w-0">
              <TreeRowGuides level={0} />
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded py-1.5" style={{ paddingLeft: `${TREE_ROW_CONTENT_GAP}px` }}>
                <Box className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                <InlineRenameInput
                  initialValue=""
                  placeholder="Project name…"
                  onCommit={onCommitInlineProject}
                />
              </div>
            </div>
          </li>
        )}
        {treeWithCases.map((node) => (
          <TreeNode
            key={node.name + (node.directory_path ?? "")}
            node={node}
            pathKey={node.name}
            level={0}
            expanded={expanded}
            onToggle={toggle}
            selectedCaseFilePath={selectedCaseFilePath}
            contextMenuTargetFolderNode={contextMenu?.node ?? null}
            onSelectCase={onSelectCase}
            caseRowRight={caseRowRight}
            onContextMenu={(e, n) => {
              e.preventDefault();
              e.stopPropagation();
              if (archivedView) return;
              setContextMenu({ x: e.clientX, y: e.clientY, node: n });
            }}
            onContextMenuCase={(e, c) => {
              e.preventDefault();
              e.stopPropagation();
              if (multiSelectActive && caseSelectionConfig) {
                const clicked = c?.file_path;
                const selected = caseSelectionConfig.selectedPaths;
                if (clicked && (!selected || selected.size === 0 || !selected.has(clicked))) {
                  selectionAnchorRef.current = clicked;
                  caseSelectionConfig.onChange(new Set([clicked]));
                }
              }
              setContextMenu({ x: e.clientX, y: e.clientY, case: c });
            }}
            renamingPath={renamingPath}
            onRenameCommit={handleRenameCommit}
            creatingInPath={creatingInPath}
            onCreateFolderCommit={handleCreateFolderCommit}
            creatingCaseInPath={creatingCaseInPath}
            creatingCaseError={creatingCaseError}
            onCommitInlineCase={(path, isProject, caseId) => {
              setCreatingCaseError(null);
              const p = onCommitInlineCase?.(path, isProject, caseId);
              if (p && typeof p.then === "function") {
                p.then(() => {
                  setCreatingCaseInPath(null);
                  setCreatingCaseError(null);
                }).catch((err) => {
                  setCreatingCaseError(err?.message || "Invalid case ID");
                });
              } else {
                setCreatingCaseInPath(null);
              }
            }}
            pickerMode={pickerMode}
            selectedFilePaths={selectedFilePaths}
            onToggleCase={onToggleCase}
            onToggleSuite={onToggleSuite}
            onToggleProject={onToggleProject}
            collectCaseFilePaths={collectCaseFilePaths}
            renamingCaseSession={renamingCaseSession}
            renameCaseConflict={renameCaseConflict}
            renameFolderConflict={renameFolderConflict}
            onCaseRenameValueChange={() => setRenameCaseConflict(null)}
            onFolderRenameValueChange={() => setRenameFolderConflict(null)}
            onCaseRenameCommit={handleCaseRenameCommit}
            multiSelectActive={multiSelectActive}
            caseSelectionSelectedPaths={caseSelectionConfig?.selectedPaths}
            onCaseRowClick={handleCaseRowClick}
            dragOverFolderPath={dragOverFolderPath}
            draggingSourcePaths={pointerDragUI?.paths ?? null}
            onCaseRowPointerDown={handleCaseRowPointerDown}
            onFolderExpand={onFolderExpand}
            loadingPrefixes={loadingPrefixes}
            hideEmptyNodes={hideEmptyNodes}
          />
        ))}
      </ul>

      {contextMenu && !pickerMode && contextMenuItems.length > 0 && (
        <ContextMenu
          open
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextMenuItems}
        />
      )}
    </>
  );
}

function TreeNode({
  node,
  pathKey,
  level,
  expanded,
  onToggle,
  selectedCaseFilePath,
  /** When the folder context menu is open, same reference as `contextMenu.node` — highlights that project/suite row. */
  contextMenuTargetFolderNode = null,
  onSelectCase,
  caseRowRight,
  onContextMenu,
  onContextMenuCase,
  renamingPath,
  onRenameCommit,
  renameFolderConflict,
  onFolderRenameValueChange,
  creatingInPath,
  onCreateFolderCommit,
  creatingCaseInPath,
  creatingCaseError,
  onCommitInlineCase,
  pickerMode,
  selectedFilePaths,
  onToggleCase,
  onToggleSuite,
  onToggleProject,
  collectCaseFilePaths,
  renamingCaseSession,
  renameCaseConflict,
  onCaseRenameCommit,
  onCaseRenameValueChange,
  multiSelectActive = false,
  caseSelectionSelectedPaths,
  onCaseRowClick,
  dragOverFolderPath,
  draggingSourcePaths,
  onCaseRowPointerDown,
  onFolderExpand,
  loadingPrefixes,
  hideEmptyNodes = false,
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasCases = (node.cases?.length ?? 0) > 0;
  const isExpanded = expanded.has(pathKey);
  const isProject = node.is_project === true;
  const isRenaming = renamingPath === node.directory_path;
  const renameFolderConflictName =
    isRenaming &&
    renameFolderConflict?.folderPath === node.directory_path
      ? renameFolderConflict.displayName
      : null;
  const isCreatingChild = creatingInPath === node.directory_path;
  const isCreatingCase = creatingCaseInPath === node.directory_path;
  const editableName = isProject ? (node.name || "").replace(/\.gitoza\.test$/i, "") : node.name;
  const contentGap = TREE_ROW_CONTENT_GAP;

  const canBulkSelectFolder = hasCases || hasChildren || isProject;
  const treeCaseCount = collectCaseFilePaths(node).length;
  const useTreeCount = pickerMode || hideEmptyNodes;
  const loadedPaths = pickerMode && canBulkSelectFolder ? collectCaseFilePaths(node) : [];
  const selectedUnderPrefix =
    pickerMode && node.directory_path
      ? [...(selectedFilePaths ?? [])].filter((p) => p.startsWith(`${node.directory_path}/`))
      : [];
  const pathsForCheckboxState = [...new Set([...loadedPaths, ...selectedUnderPrefix])];
  const folderChecked =
    pathsForCheckboxState.length > 0 &&
    pathsForCheckboxState.every((fp) => selectedFilePaths?.has(fp));
  const folderIndeterminate =
    pathsForCheckboxState.length > 0 &&
    pathsForCheckboxState.some((fp) => selectedFilePaths?.has(fp)) &&
    !folderChecked;
  const showPickerFolderCheckbox = pickerMode && canBulkSelectFolder;
  const folderCheckboxLoading = Boolean(loadingPrefixes?.has?.(node.directory_path));

  const hasRenamingInFolder =
    renamingCaseSession != null &&
    (node.cases ?? []).some((c) => isCaseInRenameSession(c.file_path, renamingCaseSession));
  const virtualCasesEnabled = !hasRenamingInFolder && !isCreatingCase;

  const canToggleFolder = hasChildren || hasCases || isProject;

  const handleFolderClick = () => {
    if (isRenaming) return;
    if (canToggleFolder && !isExpanded && node.directory_path && onFolderExpand) {
      onFolderExpand(node.directory_path);
    }
    if (canToggleFolder) onToggle(pathKey);
  };

  const handleFolderKeyDown = (e) => {
    const target = e.target;
    const isEditable =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      (target.isContentEditable && target.getAttribute("contenteditable") !== "false");
    if (isEditable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleFolderClick();
    }
  };

  const folderDropTarget = node.directory_path;
  const canDropIntoFolder =
    multiSelectActive &&
    folderDropTarget &&
    Array.isArray(draggingSourcePaths) &&
    draggingSourcePaths.some((p) => {
      if (typeof p !== "string" || !p.includes("/")) return false;
      const parent = p.slice(0, p.lastIndexOf("/"));
      return parent !== folderDropTarget;
    });
  const isDragOverFolder =
    Boolean(canDropIntoFolder) && dragOverFolderPath === folderDropTarget;

  const isContextFolderHighlight =
    contextMenuTargetFolderNode != null && contextMenuTargetFolderNode === node;

  const handleFolderCheck = async (e) => {
    e.stopPropagation();
    if (isProject && onToggleProject) {
      if (!isExpanded) {
        if (node.directory_path && onFolderExpand) {
          onFolderExpand(node.directory_path);
        }
        onToggle(pathKey);
      }
      await onToggleProject(node, pathKey);
      return;
    }
    if (!isProject && onToggleSuite) {
      if (!isExpanded) {
        if (node.directory_path && onFolderExpand) {
          onFolderExpand(node.directory_path);
        }
        onToggle(pathKey);
      }
      await onToggleSuite(node);
    }
  };

  return (
    <li
      data-folder-drop-container={multiSelectActive && folderDropTarget ? folderDropTarget : undefined}
      className={`min-w-0 ${
        isDragOverFolder
          ? "bg-indigo-100/70 dark:bg-indigo-950/40"
          : ""
      }`}
    >
      {/* Folder row: full-width hover like case rows (project = minimal Box icon; suite = no icon) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={canToggleFolder ? isExpanded : undefined}
        onClick={handleFolderClick}
        onKeyDown={handleFolderKeyDown}
        onContextMenu={(e) => onContextMenu?.(e, node)}
        className={`flex min-w-0 w-full cursor-pointer ${
          isDragOverFolder
            ? "bg-transparent"
            : isContextFolderHighlight
              ? treeRowSelectedFullWidthClass
              : treeRowHoverFullWidthClass
        }`}
        data-folder-drop-header={multiSelectActive && folderDropTarget ? folderDropTarget : undefined}
      >
        <TreeRowGuides level={level} />
        <div className={`flex min-w-0 flex-1 items-center font-medium`} style={{ paddingLeft: `${contentGap}px` }}>
          {showPickerFolderCheckbox ? (
            <input
              type="checkbox"
              checked={folderChecked}
              disabled={folderCheckboxLoading}
              ref={(el) => { if (el) el.indeterminate = folderIndeterminate; }}
              onChange={handleFolderCheck}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
            />
          ) : null}
          <div className={`${sidebarRowNoHoverClass} flex min-w-0 flex-1 flex-col gap-1`}>
          <div className="flex min-w-0 items-center gap-1">
          {canToggleFolder ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {isProject ? (
            <Box className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          ) : null}
          {isRenaming ? (
            <InlineRenameInput
              initialValue={node.display_name ?? editableName ?? node.name}
              placeholder="Name…"
              onCommit={(val) => onRenameCommit(node.directory_path, val)}
              onValueChange={onFolderRenameValueChange}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{node.display_name ?? editableName ?? node.name}</span>
          )}
          {!isRenaming && (
            <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {loadingPrefixes?.has?.(node.directory_path)
                ? "…"
                : useTreeCount
                  ? treeCaseCount
                  : (node.case_count ?? 0)}
            </span>
          )}
          </div>
          {renameFolderConflictName ? (
            <InlineRenameConflictAlert name={renameFolderConflictName} />
          ) : null}
          </div>
        </div>
      </div>

      {/* Children: suites and cases */}
      {(hasChildren || hasCases || isCreatingChild || isCreatingCase) && isExpanded && (
        <ul className="space-y-0">
          {(node.children ?? []).map((child) => (
            <TreeNode
              key={child.name + (child.directory_path ?? "")}
              node={child}
              pathKey={`${pathKey}/${child.name}`}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedCaseFilePath={selectedCaseFilePath}
              contextMenuTargetFolderNode={contextMenuTargetFolderNode}
              onSelectCase={onSelectCase}
              caseRowRight={caseRowRight}
              onContextMenu={onContextMenu}
              onContextMenuCase={onContextMenuCase}
              renamingPath={renamingPath}
              onRenameCommit={onRenameCommit}
              renameFolderConflict={renameFolderConflict}
              onFolderRenameValueChange={onFolderRenameValueChange}
              creatingInPath={creatingInPath}
              onCreateFolderCommit={onCreateFolderCommit}
              creatingCaseInPath={creatingCaseInPath}
              creatingCaseError={creatingCaseError}
              onCommitInlineCase={onCommitInlineCase}
              pickerMode={pickerMode}
              selectedFilePaths={selectedFilePaths}
              onToggleCase={onToggleCase}
              onToggleSuite={onToggleSuite}
              onToggleProject={onToggleProject}
              collectCaseFilePaths={collectCaseFilePaths}
              renamingCaseSession={renamingCaseSession}
              renameCaseConflict={renameCaseConflict}
              onCaseRenameCommit={onCaseRenameCommit}
              onCaseRenameValueChange={onCaseRenameValueChange}
              multiSelectActive={multiSelectActive}
              caseSelectionSelectedPaths={caseSelectionSelectedPaths}
              onCaseRowClick={onCaseRowClick}
              dragOverFolderPath={dragOverFolderPath}
              draggingSourcePaths={draggingSourcePaths}
              onCaseRowPointerDown={onCaseRowPointerDown}
              onFolderExpand={onFolderExpand}
              loadingPrefixes={loadingPrefixes}
              hideEmptyNodes={hideEmptyNodes}
            />
          ))}
          <VirtualCaseList
            cases={node.cases ?? []}
            listId={pathKey}
            enabled={virtualCasesEnabled}
            renderRow={(c, _index, { virtual }) => {
              const inMultiSet = caseSelectionSelectedPaths?.has(c.file_path);
              const isSelected = multiSelectActive
                ? Boolean(inMultiSet)
                : selectedCaseFilePath === c.file_path;
              const checked = pickerMode && selectedFilePaths?.has(c.file_path);
              const isRenamingCase = isCaseInRenameSession(c.file_path, renamingCaseSession);
              const renameConflictName =
                isRenamingCase && renameCaseConflict?.sourcePath === renamingCaseSession?.sourcePath
                  ? renameCaseConflict.displayName
                  : null;
              const dragPaths =
                multiSelectActive &&
                caseSelectionSelectedPaths?.has(c.file_path) &&
                caseSelectionSelectedPaths.size > 0
                  ? Array.from(caseSelectionSelectedPaths)
                  : [c.file_path];
              const isDragSource = Boolean(draggingSourcePaths?.includes(c.file_path));
              return (
                <CaseTreeCaseRow
                  key={c.file_path}
                  as={virtual ? "div" : "li"}
                  caseRow={c}
                  level={level}
                  multiSelectActive={multiSelectActive}
                  isSelected={isSelected}
                  checked={checked}
                  isRenamingCase={isRenamingCase}
                  dragPaths={dragPaths}
                  isDragSource={isDragSource}
                  pickerMode={pickerMode}
                  caseRowRight={caseRowRight}
                  onCaseRowClick={onCaseRowClick}
                  onSelectCase={onSelectCase}
                  onCaseRenameCommit={onCaseRenameCommit}
                  onCaseRenameValueChange={onCaseRenameValueChange}
                  renameConflictName={renameConflictName}
                  onToggleCase={onToggleCase}
                  onContextMenuCase={onContextMenuCase}
                  onCaseRowPointerDown={onCaseRowPointerDown}
                />
              );
            }}
          />
          {isCreatingCase && onCommitInlineCase && (
            <li>
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0">
                  <TreeRowGuides level={level + 1} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5" style={{ paddingLeft: `${contentGap}px` }}>
                    <div className="flex min-w-0 items-center gap-2">
                      <FilePlus2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                      <InlineRenameInput
                        initialValue=""
                        placeholder="Case ID (filename)…"
                        onCommit={(val) => onCommitInlineCase(node.directory_path, isProject, val)}
                      />
                    </div>
                    {creatingCaseError && (
                      <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                        {creatingCaseError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )}
          {isCreatingChild && (
            <li>
              <div className="flex min-w-0">
                <TreeRowGuides level={level + 1} />
                <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5" style={{ paddingLeft: `${contentGap}px` }}>
                  <FolderPlus className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  <InlineRenameInput
                    initialValue=""
                    placeholder="Folder name…"
                    onCommit={(val) => onCreateFolderCommit(node.directory_path, val)}
                  />
                </div>
              </div>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default CaseTree;
