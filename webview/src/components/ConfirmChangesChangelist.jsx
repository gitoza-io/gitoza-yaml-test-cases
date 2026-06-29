import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FolderCog, LayoutTemplate, Loader2 } from "lucide-react";
import SidebarRow from "./SidebarRow";
import ChangeStatusBadge from "./ChangeStatusBadge";
import CaseRowLabel from "./CaseRowLabel";
import { TestCaseIcon, TestRunIcon } from "./TestEntityIcons";
import {
  VIRTUAL_CASE_LIST_OVERSCAN,
  VIRTUAL_CASE_LIST_THRESHOLD,
} from "../constants/virtualCaseList";
import { estimateChangelistRowHeight } from "../utils/confirmChangesChangelist";
import { flexFillScroll } from "../utils/layoutClasses";

const PROJECT_CONFIG_PATH = ".gitoza/config.json";
const TEMPLATES_PREFIX = ".gitoza/test/templates/";

function templateDisplayName(filePath) {
  const normalized = (filePath || "").replace(/\\/g, "/");
  if (normalized.includes(TEMPLATES_PREFIX)) {
    const base = normalized.split("/").pop() || normalized;
    return base.replace(/\.md$/i, "") || filePath;
  }
  return filePath;
}

function SectionHeaderRow({ title, count }) {
  return (
    <div className="shrink-0 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {title} ({count})
    </div>
  );
}

function ChangelistRow({
  entry,
  selectionKind,
  selectedCasePath,
  selectedRunDir,
  selectedOtherPath,
  onSelectCase,
  onSelectRunGroup,
  onSelectOther,
}) {
  if (entry.kind === "sectionHeader") {
    return <SectionHeaderRow title={entry.title} count={entry.count} />;
  }

  if (entry.kind === "case") {
    const isDeleted = entry.status === "D";
    const labelPath = isDeleted && entry.old_path ? entry.old_path : entry.file_path;
    return (
      <SidebarRow
        selected={selectionKind === "caseFolder" && selectedCasePath === entry.file_path}
        icon={<TestCaseIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        label={
          <CaseRowLabel
            title={entry.label || labelPath}
            caseId={entry.caseRow?.case_id}
            deleted={isDeleted}
          />
        }
        right={
          <ChangeStatusBadge
            status={entry.status}
            path={entry.file_path}
            oldPath={entry.old_path}
          />
        }
        onClick={() => onSelectCase(entry.file_path)}
      />
    );
  }

  if (entry.kind === "runGroup") {
    return (
      <SidebarRow
        selected={selectionKind === "runGroup" && selectedRunDir === entry.runDir}
        icon={<TestRunIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />}
        label={
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm">{entry.title}</span>
            {entry.subtitle ? (
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                {entry.subtitle}
              </span>
            ) : null}
          </span>
        }
        onClick={() => onSelectRunGroup(entry.runDir)}
      />
    );
  }

  if (entry.kind === "template") {
    return (
      <SidebarRow
        selected={selectionKind === "other" && selectedOtherPath === entry.path}
        icon={<LayoutTemplate className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        label={<span className="truncate text-sm">{templateDisplayName(entry.path)}</span>}
        onClick={() => onSelectOther(entry.path)}
      />
    );
  }

  if (entry.kind === "config") {
    return (
      <SidebarRow
        selected={selectionKind === "other" && selectedOtherPath === entry.path}
        icon={<FolderCog className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
        label={<span className="truncate text-sm">Project config</span>}
        onClick={() => onSelectOther(entry.path)}
      />
    );
  }

  return null;
}

function VirtualChangelistRows({
  entries,
  selectionKind,
  selectedCasePath,
  selectedRunDir,
  selectedOtherPath,
  onSelectCase,
  onSelectRunGroup,
  onSelectOther,
}) {
  const scrollRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimateChangelistRowHeight(entries[index]),
    overscan: VIRTUAL_CASE_LIST_OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${flexFillScroll}`}>
      <div className="relative w-full" style={{ height: totalSize }}>
        {virtualItems.map((virtualRow) => {
          const entry = entries[virtualRow.index];
          const measureRef = (el) => {
            if (el) virtualizer.measureElement(el);
          };
          return (
            <div
              key={entry.id}
              data-index={virtualRow.index}
              ref={measureRef}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <ChangelistRow
                entry={entry}
                selectionKind={selectionKind}
                selectedCasePath={selectedCasePath}
                selectedRunDir={selectedRunDir}
                selectedOtherPath={selectedOtherPath}
                onSelectCase={onSelectCase}
                onSelectRunGroup={onSelectRunGroup}
                onSelectOther={onSelectOther}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaticChangelistRows(props) {
  const { entries } = props;
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${flexFillScroll}`}>
      {entries.map((entry) => (
        <ChangelistRow key={entry.id} entry={entry} {...props} />
      ))}
    </div>
  );
}

/**
 * VS Code-style flat changelist for Confirm Changes.
 */
function ConfirmChangesChangelist({
  entries = [],
  selectionKind,
  selectedCasePath,
  selectedRunDir,
  selectedOtherPath,
  onSelectCase,
  onSelectRunGroup,
  onSelectOther,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-4 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">
        No changes to review.
      </p>
    );
  }

  const rowProps = {
    selectionKind,
    selectedCasePath,
    selectedRunDir,
    selectedOtherPath,
    onSelectCase,
    onSelectRunGroup,
    onSelectOther,
  };

  const useVirtual = entries.length >= VIRTUAL_CASE_LIST_THRESHOLD;

  return useVirtual ? (
    <VirtualChangelistRows entries={entries} {...rowProps} />
  ) : (
    <StaticChangelistRows entries={entries} {...rowProps} />
  );
}

export default ConfirmChangesChangelist;
