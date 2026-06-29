import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import ContextMenu from "./ContextMenu";
import InlineRenameInput from "./InlineRenameInput";
import SidebarRow from "./SidebarRow";
import {
  sidebarTreePlaceholderClass,
  treeRowHoverFullWidthClass,
  treeRowSelectedFullWidthClass,
  TREE_ROW_CONTENT_GAP,
} from "./SidebarSection";
import { TestRunIcon } from "./TestEntityIcons";
import { flexFillScroll } from "../utils/layoutClasses";

/**
 * Flat run list for Test Run column 1 (no nested cases).
 */
export default function RunSidebarList({
  runs = [],
  selectedRunId = null,
  onSelectRun,
  creatingRun = false,
  onStartCreateRun,
  onCommitCreateRun,
  onDeleteRun,
  emptyMessage = "No test runs yet.",
}) {
  const [contextMenu, setContextMenu] = useState(null);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 py-2 dark:border-slate-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Runs
        </span>
        {onStartCreateRun ? (
          <button
            type="button"
            onClick={onStartCreateRun}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="New run"
            aria-label="New run"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${flexFillScroll}`}>
        <ul className="space-y-0 py-1">
          {creatingRun && onCommitCreateRun ? (
            <li>
              <div
                className="flex min-w-0 w-full items-center gap-2 py-1"
                style={{ paddingLeft: `${TREE_ROW_CONTENT_GAP}px` }}
              >
                <TestRunIcon className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                <InlineRenameInput
                  initialValue=""
                  placeholder="Run name…"
                  onCommit={onCommitCreateRun}
                />
              </div>
            </li>
          ) : null}
          {!runs.length && !creatingRun ? (
            <li className={sidebarTreePlaceholderClass}>
              <div className="px-2 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {emptyMessage}
              </div>
            </li>
          ) : null}
          {runs.map((run) => {
            const isSelected = selectedRunId === run.run_id;
            const label = run.title?.trim() || run.run_id;
            return (
              <li key={run.run_id}>
                <div
                  className={`flex min-w-0 w-full select-none ${
                    isSelected ? treeRowSelectedFullWidthClass : treeRowHoverFullWidthClass
                  }`}
                  onContextMenu={
                    onDeleteRun
                      ? (e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, run });
                        }
                      : undefined
                  }
                >
                  <SidebarRow
                    selected={isSelected}
                    icon={
                      <TestRunIcon className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                    }
                    label={label}
                    right={
                      run.case_count > 0 ? (
                        <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {run.case_count}
                        </span>
                      ) : null
                    }
                    onClick={() => onSelectRun?.(run)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {contextMenu && onDeleteRun ? (
        <ContextMenu
          open
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Delete run",
              icon: Trash2,
              danger: true,
              onClick: () => {
                onDeleteRun(contextMenu.run.run_id);
                setContextMenu(null);
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
