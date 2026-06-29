import CaseRowLabel from "./CaseRowLabel";
import InlineRenameConflictAlert from "./InlineRenameConflictAlert";
import InlineRenameInput from "./InlineRenameInput";
import {
  TreeRowGuides,
  TREE_ROW_CONTENT_GAP,
  treeRowSelectedFullWidthClass,
  treeRowHoverFullWidthClass,
} from "./SidebarSection";
import SidebarRow from "./SidebarRow";
import { TestCaseIcon } from "./TestEntityIcons";

/**
 * Single case row in CaseTree (extracted for VirtualCaseList reuse).
 */
function CaseTreeCaseRow({
  caseRow: c,
  level,
  multiSelectActive = false,
  isSelected = false,
  checked = false,
  isRenamingCase = false,
  dragPaths = [],
  isDragSource = false,
  pickerMode = false,
  caseRowRight,
  onCaseRowClick,
  onSelectCase,
  onCaseRenameCommit,
  onCaseRenameValueChange,
  renameConflictName = null,
  onToggleCase,
  onContextMenuCase,
  onCaseRowPointerDown,
  as: Root = "li",
}) {
  const contentGap = TREE_ROW_CONTENT_GAP;
  const titleShort =
    c.title && c.title.length > 48 ? `${c.title.slice(0, 48)}…` : (c.title ?? "");

  return (
    <Root>
      <div className="flex min-w-0 flex-col">
        <div
          className={`flex min-w-0 w-full ${
            isDragSource
              ? "opacity-60 ring-2 ring-indigo-400/80 ring-offset-1 ring-offset-white dark:ring-indigo-500/70 dark:ring-offset-slate-950"
              : isSelected
                ? treeRowSelectedFullWidthClass
                : treeRowHoverFullWidthClass
          }`}
          style={multiSelectActive && !isRenamingCase ? { touchAction: "none" } : undefined}
          onContextMenu={
            onContextMenuCase && !isRenamingCase ? (e) => onContextMenuCase(e, c) : undefined
          }
          onPointerDown={
            multiSelectActive && !isRenamingCase
              ? (e) =>
                  onCaseRowPointerDown?.(e, {
                    paths: dragPaths,
                    summaryLine:
                      dragPaths.length > 1
                        ? `${dragPaths.length} test cases`
                        : titleShort || c.case_id || "Untitled",
                    detailLine:
                      dragPaths.length > 1
                        ? "Drop on a project or suite folder"
                        : c.case_id || undefined,
                  })
              : undefined
          }
        >
          <TreeRowGuides level={level + 1} />
          <div
            className="flex min-w-0 flex-1 items-center gap-1"
            style={{ paddingLeft: `${contentGap}px` }}
          >
            {pickerMode ? (
              <input
                type="checkbox"
                checked={checked ?? false}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleCase?.(c.file_path);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              {isRenamingCase && onCaseRenameCommit ? (
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2 py-0.5">
                    <TestCaseIcon />
                    <InlineRenameInput
                      initialValue={c.case_id ?? ""}
                      placeholder="Case ID…"
                      onCommit={(val) => onCaseRenameCommit(c, val)}
                      onValueChange={onCaseRenameValueChange}
                    />
                  </div>
                  {renameConflictName ? (
                    <InlineRenameConflictAlert name={renameConflictName} />
                  ) : null}
                </div>
              ) : (
                <SidebarRow
                  selected={isSelected}
                  selectionOnParent
                  icon={<TestCaseIcon />}
                  label={<CaseRowLabel title={c.title} caseId={c.case_id} />}
                  right={caseRowRight?.(c)}
                  onClick={(e) =>
                    multiSelectActive && onCaseRowClick ? onCaseRowClick(c, e) : onSelectCase?.(c)
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Root>
  );
}

export default CaseTreeCaseRow;
