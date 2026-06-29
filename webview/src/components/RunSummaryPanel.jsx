import { useState, useEffect, useRef, useCallback } from "react";
import CommentStream from "./CommentStream";
import { useGitUserName } from "../hooks/useGitUserName";
import { Pencil, Eye } from "lucide-react";
import UpdatedByLine from "./UpdatedByLine";
import MarkdownToolbar from "./MarkdownToolbar";
import { useMarkdownEditor } from "../hooks/useMarkdownEditor";
import LiveMarkdownEditor from "./LiveMarkdownEditor";
import { renderMarkdown } from "./TestCaseDetailModal";
import DetailPanel from "./DetailPanel";
import Tooltip from "./Tooltip";
import ApproveStatusBadge from "./ApproveStatusBadge";
import { useDebouncedAutoSave } from "../hooks/useDebouncedAutoSave";
import { DEBOUNCE_MS } from "../constants/autoSave";
import { registerAutoSaveFlush } from "../utils/autoSaveFlushRegistry";
import AssigneeInput from "./AssigneeInput";

const normalizeRunDraft = (d) => ({
  description: (d.description || "").trim(),
  assigned_to: (d.assignedTo || "").trim(),
});

/** Prominent result summary: passed / failed / skipped / pending with color. */
function RunResultSummary({ run }) {
  const total = run?.total_cases ?? 0;
  const passed = run?.passed ?? 0;
  const failed = run?.failed ?? 0;
  const skipped = run?.skipped ?? 0;
  const pending = Math.max(0, total - passed - failed - skipped);
  if (total === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="rounded-ui bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
        {passed} passed
      </span>
      <span className="rounded-ui bg-red-100 px-2.5 py-1 text-sm font-semibold text-red-800 dark:bg-red-500/20 dark:text-red-300">
        {failed} failed
      </span>
      {skipped > 0 && (
        <span className="rounded-ui bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
          {skipped} skipped
        </span>
      )}
      {pending > 0 && (
        <span className="rounded-ui bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
          {pending} pending
        </span>
      )}
    </div>
  );
}

function RunSummaryDashboardHint() {
  return (
    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
      Suite-level breakdown is available on the Dashboard.
    </p>
  );
}

/**
 * Shared run summary panel with View / Edit mode (matching CaseEditorPanel pattern).
 * View: run name, description, comments.
 * Edit: editable description and assignee with debounced auto-save. Eye flushes pending draft before view mode.
 */
function RunSummaryPanel({
  run,
  runCases: _runCases = [],
  loading: _loading = false,
  statusBadge = null,
  reviewEnabled = true,
  footer = null,
  readOnly = false,
  isEditing = false,
  onToggleEdit,
  onSaveRun,
  onPostRunComment,
  onDeleteRunComment,
  repoSlug = null,
  gitProfileVersion = 0,
  allUsernames = null,
}) {
  const [localDesc, setLocalDesc] = useState("");
  const [localAssignedTo, setLocalAssignedTo] = useState("");
  const [error, setError] = useState("");
  const [measuredDescHeight, setMeasuredDescHeight] = useState(null);
  const [commentPosting, setCommentPosting] = useState(false);
  const gitUserName = useGitUserName(repoSlug, gitProfileVersion);

  const prevRunKeyRef = useRef(null);
  const prevDescRef = useRef(null);
  const prevAssignedRef = useRef(null);
  const descriptionEditRef = useRef(null);
  const descMeasureRef = useRef(null);

  useEffect(() => {
    if (isEditing && descriptionEditRef.current) {
      descriptionEditRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isEditing]);

  useEffect(() => {
    if (!run) return;
    const initKey = run.run_id;
    if (initKey !== prevRunKeyRef.current) {
      prevRunKeyRef.current = initKey;
      prevDescRef.current = run.description;
      prevAssignedRef.current = run.assigned_to;
      setLocalDesc(run.description || "");
      setLocalAssignedTo(run.assigned_to || "");
      setError("");
      return;
    }
    if (isEditing && run.description !== prevDescRef.current && localDesc === (prevDescRef.current ?? "")) {
      prevDescRef.current = run.description;
      setLocalDesc(run.description || "");
    }
    if (isEditing && run.assigned_to !== prevAssignedRef.current && localAssignedTo === (prevAssignedRef.current ?? "")) {
      prevAssignedRef.current = run.assigned_to;
      setLocalAssignedTo(run.assigned_to || "");
    }
  }, [isEditing, run, localDesc, localAssignedTo]);

  useEffect(() => {
    if (!isEditing) {
      prevRunKeyRef.current = null;
      prevDescRef.current = null;
      prevAssignedRef.current = null;
      setMeasuredDescHeight(null);
    }
  }, [isEditing]);

  // When switching to edit mode, measure description text height with a hidden textarea then set editor height (same fix as CaseEditorPanel).
  useEffect(() => {
    if (!isEditing || !descMeasureRef.current) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled && descMeasureRef.current) {
          setMeasuredDescHeight(descMeasureRef.current.scrollHeight);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isEditing, localDesc]);

  const runDraft = { description: localDesc, assignedTo: localAssignedTo };
  const persistedRunDraft = {
    description: run?.description || "",
    assignedTo: run?.assigned_to || "",
  };

  const handleAutoSaveRun = useCallback(
    async (draft, runIdFromHook) => {
      setError("");
      const runId = runIdFromHook ?? run?.run_id;
      if (!runId) return;
      try {
        await onSaveRun?.({
          description: (draft.description || "").trim(),
          assigned_to: (draft.assignedTo || "").trim(),
          run_id: runId,
        });
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || "Failed to save");
      }
    },
    [onSaveRun, run],
  );

  const { flush } = useDebouncedAutoSave({
    enabled: isEditing && !!run && !readOnly,
    key: run?.run_id,
    draft: runDraft,
    persisted: persistedRunDraft,
    normalize: normalizeRunDraft,
    save: handleAutoSaveRun,
    delayMs: DEBOUNCE_MS,
    silent: true,
  });

  useEffect(() => {
    return registerAutoSaveFlush(flush);
  }, [flush]);

  const handlePostComment = useCallback(
    async (text) => {
      if (!run?.run_id || !onPostRunComment) return;
      setCommentPosting(true);
      try {
        await onPostRunComment(run.run_id, text);
      } finally {
        setCommentPosting(false);
      }
    },
    [run?.run_id, onPostRunComment],
  );

  const handleDeleteComment = useCallback(
    async (index) => {
      if (!run?.run_id || !onDeleteRunComment) return;
      await onDeleteRunComment(run.run_id, index);
    },
    [run?.run_id, onDeleteRunComment],
  );

  const commentBlock = run ? (
    <CommentStream
      comments={run.comments ?? []}
      currentAuthor={gitUserName}
      onPost={onPostRunComment && !readOnly ? handlePostComment : undefined}
      onDelete={onDeleteRunComment && !readOnly ? handleDeleteComment : undefined}
      disabled={readOnly}
      posting={commentPosting}
    />
  ) : null;

  const { toolbarProps, getLiveEditorProps } = useMarkdownEditor(localDesc, setLocalDesc, {
    onBlur: () => flush(),
    growWithContent: true,
    initialHeight: measuredDescHeight ?? undefined,
    livePreview: true,
    repoSlug,
  });

  if (!run) return null;

  const subtitle = (run.updated_at || run.updated_by) ? (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      <UpdatedByLine updatedAt={run.updated_at} updatedBy={run.updated_by} />
    </p>
  ) : null;

  // ─── Edit mode: sticky toolbar, only description body scrolls (same pattern as Case) ───
  if (isEditing && !readOnly) {
    const descEditorProps = getLiveEditorProps({
      placeholder: "Add a description… (Markdown supported)",
      "aria-label": "Run description (Markdown)",
      className:
        "min-h-[7.5rem] w-full overflow-y-hidden resize-none border-0 bg-transparent font-mono text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500",
      measureRef: descMeasureRef,
    });

    return (
      <DetailPanel
        title={run.name}
        statusBadge={
          statusBadge ?? (
            <ApproveStatusBadge status={run.approve_status} entityType="run" reviewEnabled={reviewEnabled} />
          )
        }
        subtitle={subtitle}
        headerExtra={
          <div className="flex items-center gap-2">
            <Tooltip label="View" placement="bottom-end">
              <button
                type="button"
                onClick={async () => {
                  await flush();
                  onToggleEdit?.(false);
                }}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="View"
              >
                <Eye className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        }
        footer={footer}
        bodyScroll={false}
      >
        <div ref={descriptionEditRef} className="flex h-full min-h-0 flex-col overflow-hidden">
          <RunResultSummary run={run} />
          <RunSummaryDashboardHint />
          <div className="mb-3 px-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Assigned to</span>
            <div className="mt-1">
              <AssigneeInput
                value={localAssignedTo}
                onChange={setLocalAssignedTo}
                onBlur={() => flush()}
                suggestions={allUsernames ?? []}
                placeholder="Default for cases in this run"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <MarkdownToolbar {...toolbarProps} />
            </div>
            <div className="relative px-2 py-2">
              <LiveMarkdownEditor {...descEditorProps} />
            </div>
            {error && (
              <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}
            {commentBlock ? <div className="mt-6 px-2 pb-4">{commentBlock}</div> : null}
          </div>
        </div>
      </DetailPanel>
    );
  }

  // ─── View mode (description rendered as Markdown in body area) ───
  return (
    <DetailPanel
      title={run.name}
      statusBadge={
        statusBadge ?? (
          <ApproveStatusBadge status={run.approve_status} entityType="run" reviewEnabled={reviewEnabled} />
        )
      }
      subtitle={subtitle}
      headerExtra={
        onToggleEdit && !readOnly ? (
          <Tooltip label="Edit" placement="bottom-end">
            <button
              type="button"
              onClick={() => onToggleEdit?.(true)}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : null
      }
      footer={footer}
    >
      <RunResultSummary run={run} />
      <RunSummaryDashboardHint />

      {run.assigned_to ? (
        <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned to </span>
          <span className="font-semibold">{run.assigned_to}</span>
        </p>
      ) : null}

      {run.description ? (
        <article className="prose-rex mb-3">{renderMarkdown(run.description)}</article>
      ) : (
        <p className="mb-3 text-sm text-slate-400 dark:text-slate-500">No description.</p>
      )}

      {commentBlock ? <div className="mt-6 pb-4">{commentBlock}</div> : null}
    </DetailPanel>
  );
}

export default RunSummaryPanel;
