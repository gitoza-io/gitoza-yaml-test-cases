import { sidebarRowSecondaryLineClass } from "./SidebarSection";

/**
 * Unified case row label: title on top, case_id below.
 * Use in Test Repository (CaseTree), Test Run (RunCaseTree), RunSummaryPanel, and Review
 * so all case rows share the same format and styling.
 *
 * @param {{ title?: string; caseId?: string; line1Extra?: React.ReactNode; deleted?: boolean }} props
 *   - line1Extra: optional node after title on first line (e.g. ApproveStatusBadge in Review).
 *   - deleted: strikethrough + muted styling (Confirm Changes deleted cases).
 */
function CaseRowLabel({ title, caseId, line1Extra, deleted = false }) {
  const deletedClass = deleted
    ? "line-through text-slate-400 dark:text-slate-500"
    : "";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`truncate font-medium ${deletedClass}`}>
          {title || caseId || "Untitled"}
        </span>
        {line1Extra}
      </div>
      <p className={`${sidebarRowSecondaryLineClass} ${deletedClass}`}>{caseId ?? ""}</p>
    </div>
  );
}

export default CaseRowLabel;
