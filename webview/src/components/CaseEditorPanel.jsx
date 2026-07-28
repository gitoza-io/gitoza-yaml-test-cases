import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FilePlus2, Pencil, Eye, Save, Table2, X } from "lucide-react";
import CaseBreadcrumb from "./CaseBreadcrumb";
import CaseDetailView from "./CaseDetailView";
import { CustomFieldsEditStrip } from "./CaseCustomFields";
import { METADATA_EDIT_INPUT_CLS, METADATA_EDIT_INPUT_DEFAULT_CLS, MetadataFieldEdit } from "./MetadataField";
import DetailPanel from "./DetailPanel";
import Tooltip from "./Tooltip";
import DetailPanelEmpty from "./DetailPanelEmpty";
import MarkdownToolbar from "./MarkdownToolbar";
import StickyThenScroll from "./StickyThenScroll";
import { useMarkdownEditor } from "../hooks/useMarkdownEditor";
import LiveMarkdownEditor from "./LiveMarkdownEditor";
import { priorityColors } from "./TestCaseDetailModal";
import AssigneeInput from "./AssigneeInput";
import { getTagColorClass } from "../utils/tagColor";
import { TagOptionRow } from "./TagBadge";
import { isCaseArchived } from "../utils/caseArchived";
import { DEFAULT_CASE_BODY } from "../constants/defaultCaseBodyTemplates";
import { SUPPORT_URLS } from "../constants/supportLinks";
import { openExternalUrl } from "../utils/openExternalUrl";

const CASE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const inputCls =
  "w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-400 transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
const selectCls =
  "w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-400 transition focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

const inlineCls =
  "bg-transparent border-0 border-b border-transparent outline-none transition-colors focus:border-indigo-400 dark:focus:border-indigo-500";

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const normalizeParamsRecord = (params) => {
  const entries = Object.entries(params ?? {})
    .map(([k, v]) => [String(k).trim(), String(v).trim()])
    .filter(([k, v]) => k && v)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
};

const normalizeCaseDraft = (d) => ({
  title: (d.title || "").trim(),
  priority: (d.priority || "medium").trim().toLowerCase(),
  tags: (d.tagsStr || "").split(",").map((t) => t.trim()).filter(Boolean).join(","),
  requirement_id: (d.requirementId || "").trim(),
  assigned_to: (d.assignedTo || "").trim(),
  automated: Boolean(d.automated),
  body: (d.body || "").trim(),
  params: normalizeParamsRecord(d.params),
});

/**
 * Fixed right panel: empty state, read-only detail, or inline edit/create.
 * VS Code extension: manual save via Save button (no auto-save).
 */
function CaseEditorPanel({
  caseDetail,
  selectedCaseFilePath,
  caseDetailLoading = false,
  isEditing,
  onToggleEdit,
  onClearSelection,
  onSave,
  onPostCaseComment,
  onDeleteCaseComment,
  onArchive,
  showCreateForm,
  onStartCreate,
  onCancelCreate,
  onCreate,
  directory,
  targetFolder,
  editorLocked = false,
  allTags = null,
  paramKeys = null,
  paramValuesByKey = null,
  allUsernames = null,
  repoSlug = null,
  reviewEnabled = true,
  storageSyncConfigured = false,
  onOpenStorageSyncSettings,
  manualSave = false,
  gitProfileVersion = 0,
}) {
  const [caseId, setCaseId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("active");
  const [tagsStr, setTagsStr] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [automated, setAutomated] = useState(false);
  const [params, setParams] = useState({});
  const [body, setBody] = useState("");
  const [assetUploading, setAssetUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const imageInputRef = useRef(null);
  const [error, setError] = useState("");
  const [measuredBodyHeight, setMeasuredBodyHeight] = useState(null);
  const [caseTemplates, setCaseTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateError, setSaveTemplateError] = useState("");
  const [saveTemplateSubmitting, setSaveTemplateSubmitting] = useState(false);

  const prevInitKeyRef = useRef(null);
  const bodyMeasureRef = useRef(null);
  const templateMenuRef = useRef(null);
  /**
   * Form fields have been filled from the current `caseDetail` for this selection (after effect runs).
   * Without this, one render can have tree+API aligned on case B while React state still holds A's draft
   * — autosave would PUT A's body under B's path (wrong-file write).
   */
  const [formSyncedPath, setFormSyncedPath] = useState(null);

  /** Detail row matches tree selection, fetch finished, and form draft matches that case (avoids wrong-file PUT). */
  const caseDetailReady =
    !caseDetailLoading &&
    !!caseDetail &&
    !!selectedCaseFilePath &&
    caseDetail.file_path === selectedCaseFilePath &&
    formSyncedPath === selectedCaseFilePath &&
    formSyncedPath === caseDetail.file_path;

  // Sync form state when selected case changes (same as RunSummaryPanel: always re-init on entity change
  // so draft is never stale and debounce cannot write A's content to B when user switched case before timer fired).
  useEffect(() => {
    if (!caseDetail) {
      setFormSyncedPath(null);
      prevInitKeyRef.current = null;
      return;
    }
    if (caseDetail.file_path !== selectedCaseFilePath) {
      setFormSyncedPath(null);
      prevInitKeyRef.current = null;
      return;
    }
    const initKey = selectedCaseFilePath;
    if (initKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = initKey;
    setCaseId(caseDetail.case_id ?? "");
    setTitle(caseDetail.title ?? "");
    setPriority((caseDetail.priority ?? "medium").toLowerCase());
    setStatus((caseDetail.status ?? "active").toLowerCase());
    setTagsStr(Array.isArray(caseDetail.tags) ? caseDetail.tags.join(", ") : "");
    setRequirementId(caseDetail.requirement_id ?? "");
    setAssignedTo(caseDetail.assigned_to ?? "");
    setAutomated(Boolean(caseDetail.automated));
    setParams(caseDetail.params ?? {});
    setBody(caseDetail.body ?? "");
    setError("");
    setFormSyncedPath(selectedCaseFilePath);
  }, [caseDetail, selectedCaseFilePath]);

  useEffect(() => {
    if (!isEditing) {
      prevInitKeyRef.current = null;
      setMeasuredBodyHeight(null);
    }
  }, [isEditing]);

  // When switching to edit mode, measure text height with a hidden textarea then set editor height (avoids fixed small height on first paint).
  useEffect(() => {
    if (!isEditing || !bodyMeasureRef.current) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled && bodyMeasureRef.current) {
          setMeasuredBodyHeight(bodyMeasureRef.current.scrollHeight);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isEditing, body]);

  useEffect(() => {
    if (showCreateForm) {
      setCaseId("");
      setTitle("");
      setPriority("medium");
      setStatus("active");
      setTagsStr("");
      setRequirementId("");
      setAutomated(false);
      setParams({});
      setBody(DEFAULT_CASE_BODY);
      setError("");
    }
  }, [showCreateForm]);

  const isValidId = caseId.trim().length > 0 && CASE_ID_RE.test(caseId.trim());
  const isValidTitle = title.trim().length > 0;
  const canCreate = isValidId && isValidTitle && !loading;

  // --- Auto-save for edit mode ---
  const draft = useMemo(
    () => ({ title, priority, tagsStr, requirementId, assignedTo, automated, body, params }),
    [title, priority, tagsStr, requirementId, assignedTo, automated, body, params],
  );

  const persistedSnapshot = useMemo(
    () => ({
      title: caseDetail?.title ?? "",
      priority: (caseDetail?.priority ?? "medium").toLowerCase(),
      tagsStr: Array.isArray(caseDetail?.tags) ? caseDetail.tags.join(", ") : "",
      requirementId: caseDetail?.requirement_id ?? "",
      assignedTo: caseDetail?.assigned_to ?? "",
      automated: Boolean(caseDetail?.automated),
      body: caseDetail?.body ?? "",
      params: caseDetail?.params ?? {},
    }),
    [caseDetail],
  );

  const displayTags = useMemo(
    () =>
      (tagsStr || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsStr],
  );

  const persistedTags = useMemo(() => {
    if (Array.isArray(allTags) && allTags.length > 0) {
      return Array.from(
        new Set(
          allTags
            .map((t) => String(t).trim())
            .filter(Boolean),
        ),
      );
    }
    const raw = persistedSnapshot.tagsStr || "";
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }, [allTags, persistedSnapshot.tagsStr]);

  const handleAddTag = useCallback(
    (value) => {
      const tag = (value || "").trim();
      if (!tag) return;

      const exists = displayTags.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (exists) {
        setTagInput("");
        return;
      }

      const next = [...displayTags, tag];
      setTagsStr(next.join(", "));
      setTagInput("");
    },
    [displayTags],
  );

  const handleRemoveTag = useCallback(
    (tagToRemove) => {
      const next = displayTags.filter((t) => t !== tagToRemove);
      setTagsStr(next.join(", "));
    },
    [displayTags],
  );

  const suggestedTags = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];

    const selectedSet = new Set(displayTags.map((t) => t.toLowerCase()));

    return persistedTags
      .filter((t) => {
        const lower = t.toLowerCase();
        return lower.includes(q) && !selectedSet.has(lower);
      })
      .slice(0, 6);
  }, [tagInput, displayTags, persistedTags]);

  const buildSavePayload = useCallback(
    (d) => {
      const tags = (d.tagsStr || "").split(",").map((t) => t.trim()).filter(Boolean);
      return {
        file_path: caseDetail?.file_path ?? selectedCaseFilePath,
        case_id: (caseDetail?.case_id ?? caseId).trim(),
        title: d.title.trim(),
        priority: d.priority,
        status: caseDetail?.status ?? status,
        tags,
        requirement_id: (d.requirementId || "").trim(),
        assigned_to: (d.assignedTo || "").trim(),
        automated: Boolean(d.automated),
        body: (d.body || "").trim(),
        params: d.params ?? {},
      };
    },
    [caseDetail, selectedCaseFilePath, caseId, status],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!caseDetailReady || !selectedCaseFilePath) return;
    setError("");
    setLoading(true);
    try {
      await onSave(buildSavePayload(draft));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }, [buildSavePayload, caseDetailReady, draft, onSave, selectedCaseFilePath]);

  const noopFlush = useCallback(async () => {}, []);
  const flush = manualSave ? noopFlush : noopFlush;

  const { toolbarProps, liveEditorRef, getLiveEditorProps } = useMarkdownEditor(body, setBody, {
    onBlur: manualSave ? undefined : flush,
    disabled: editorLocked,
    growWithContent: true,
    initialHeight: measuredBodyHeight ?? undefined,
    livePreview: true,
    repoSlug,
  });

  const handleInsertImageClick = useCallback(() => {}, []);

  const handleOpenDesktopApp = useCallback((e) => {
    e.preventDefault();
    openExternalUrl(SUPPORT_URLS.desktopApp).catch(() => {});
  }, []);

  const imageDesktopTooltip = (
    <>
      Image insert is available in the{" "}
      <a
        href={SUPPORT_URLS.desktopApp}
        className="font-semibold text-indigo-700 underline hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200"
        onClick={handleOpenDesktopApp}
      >
        Gitoza
      </a>{" "}
      desktop app.
    </>
  );

  const handleOpenSaveTemplateModal = useCallback(async () => {}, []);
  const handleSaveTemplateForm = useCallback(async (e) => {
    e.preventDefault();
  }, []);
  const handleInsertTemplate = useCallback(async () => {}, []);

  const handleInsertActionExpectationTable = useCallback(() => {
    const el = liveEditorRef.current?.getTextareaRef?.() ?? null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const tableMd = [
      "| # | Action | Expected result |",
      "|---|--------|-----------------|",
      "| 1 | | |",
      "| 2 | | |",
      "| 3 | | |",
    ].join("\n");
    const next = body.slice(0, start) + tableMd + body.slice(end);
    const pos = start + tableMd.length;
    setBody(next);
    requestAnimationFrame(() => {
      const next = liveEditorRef.current?.getTextareaRef?.();
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    });
  }, [body, liveEditorRef]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canCreate || !directory) return;
    setLoading(true);
    setError("");
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await onCreate({
        case_id: caseId.trim(),
        title: title.trim(),
        priority,
        status,
        tags,
        requirement_id: requirementId.trim() || undefined,
        automated: automated || undefined,
        params: Object.keys(params ?? {}).length > 0 ? params : undefined,
        directory,
        target_folder: targetFolder || undefined,
      });
      onCancelCreate?.();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Failed to create");
    } finally {
      setLoading(false);
    }
  };

  // ─── Loading detail after tree selection (avoid empty vs wrong-content flash) ───
  if (selectedCaseFilePath && caseDetailLoading && !caseDetail && !showCreateForm) {
    return (
      <DetailPanel>
        <div className="flex min-h-[12rem] flex-1 items-center justify-center px-4 text-sm text-slate-500 dark:text-slate-400">
          Loading test case…
        </div>
      </DetailPanel>
    );
  }

  // ─── Empty state ───
  if (!caseDetail && !showCreateForm) {
    return (
      <DetailPanel>
        <DetailPanelEmpty
          iconComponent={FilePlus2}
          title="Select a test case from the list"
          description="or create a new one"
          action={
            !editorLocked && directory ? (
              <button
                type="button"
                onClick={onStartCreate}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                New test case
              </button>
            ) : undefined
          }
        />
      </DetailPanel>
    );
  }

  // ─── Create form (inline) ───
  if (showCreateForm) {
    return (
      <DetailPanel title="New test case" onClose={onCancelCreate}>
        <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="new-tc-id" className={labelCls}>Case ID *</label>
              <input id="new-tc-id" type="text" value={caseId} onChange={(e) => { setCaseId(e.target.value); setError(""); }} placeholder="TC-001" className={inputCls} />
              {caseId.trim() && !CASE_ID_RE.test(caseId.trim()) && <p className="mt-0.5 text-[11px] text-red-500">Invalid ID</p>}
            </div>
            <div className="col-span-2">
              <label htmlFor="new-tc-title" className={labelCls}>Title *</label>
              <input id="new-tc-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Login with valid credentials" className={inputCls} />
            </div>
          </div>
          <div className="mt-2">
            <label htmlFor="new-tc-priority" className={labelCls}>Priority</label>
            <select id="new-tc-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="mt-2">
            <label htmlFor="new-tc-requirement" className={labelCls}>Requirement / Ticket ID</label>
            <input id="new-tc-requirement" type="text" value={requirementId} onChange={(e) => setRequirementId(e.target.value)} placeholder="e.g. PROJ-123" className={inputCls} />
          </div>
          <div className="mt-2">
            <label className={`${labelCls} flex items-center gap-2`}>
              <input
                id="new-tc-automated"
                type="checkbox"
                checked={automated}
                onChange={(e) => setAutomated(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Automated test
            </label>
          </div>
          <div className="mt-2">
            <label htmlFor="new-tc-tags" className={labelCls}>Tags (comma-separated)</label>
            <input id="new-tc-tags" type="text" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="auth, login" className={inputCls} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <CustomFieldsEditStrip
              value={params}
              onChange={setParams}
              paramKeys={paramKeys ?? []}
              paramValuesByKey={paramValuesByKey ?? {}}
            />
          </div>
          {error && <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCancelCreate} disabled={loading} className="rounded px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={!canCreate} className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Create</button>
          </div>
        </form>
      </DetailPanel>
    );
  }

  // ─── Read-only detail + edit toggle ───
  if (!isEditing && caseDetail) {
    return (
      <DetailPanel title={<CaseBreadcrumb filePath={caseDetail.file_path} />} bodyScroll={false}>
        <CaseDetailView
          testCase={caseDetail}
          repoSlug={repoSlug}
          reviewEnabled={reviewEnabled}
          simpleMode={manualSave}
          caseIdRowExtra={
            !editorLocked ? (
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
        />
      </DetailPanel>
    );
  }

  // ─── Edit mode: sticky header + toolbar, only body scrolls (same pattern as Run) ───
  const priorityKey = priority.toLowerCase();
  const archivedByPath = isCaseArchived({
    file_path: caseDetail?.file_path ?? selectedCaseFilePath,
  });

  const caseHeader = (
    <header className="border-b border-slate-200 px-3 py-3 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Test Case"
          className={`${inlineCls} min-w-0 flex-1 rounded border border-indigo-200 bg-white text-lg font-bold leading-snug text-slate-900 outline-none ring-indigo-400 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600`}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-mono text-sm font-normal tracking-wide text-slate-800 dark:text-slate-100">
          {caseId || "—"}
        </span>
        {archivedByPath ? (
          <span
            className="shrink-0 rounded-ui bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
            aria-label="Archived"
          >
            Archived
          </span>
        ) : null}
        <Tooltip label="Editing mode" placement="bottom">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100">
            <Pencil className="h-3 w-3" />
            Editing
          </span>
        </Tooltip>
        <Tooltip label="View" placement="bottom-end">
          <button
            type="button"
            onClick={() => {
              const discardDraft = {
                title,
                priority,
                status,
                requirement_id: requirementId,
                assigned_to: assignedTo,
                automated,
                tagsStr,
                body,
                params,
                tags: (tagsStr || "").split(",").map((t) => t.trim()).filter(Boolean),
              };
              onToggleEdit?.(false, discardDraft);
            }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="View"
          >
            <Eye className="h-4 w-4" />
          </button>
        </Tooltip>
        {manualSave ? (
          <Tooltip label="Save" placement="bottom-end">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading || editorLocked}
              className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
              aria-label="Save"
            >
              <Save className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-stretch gap-2">
          <MetadataFieldEdit label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`${METADATA_EDIT_INPUT_CLS} ${priorityColors[priorityKey] || METADATA_EDIT_INPUT_DEFAULT_CLS} cursor-pointer appearance-none pr-7 shadow-sm`}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </MetadataFieldEdit>
          <MetadataFieldEdit label="Requirement">
            <input
              type="text"
              value={requirementId}
              onChange={(e) => setRequirementId(e.target.value)}
              placeholder="—"
              className={`${METADATA_EDIT_INPUT_CLS} text-indigo-800 placeholder:text-slate-400 dark:text-indigo-200 dark:placeholder:text-slate-500`}
            />
          </MetadataFieldEdit>
          <MetadataFieldEdit label="Automated">
            <label className="flex min-h-[1.75rem] cursor-pointer items-center gap-2 px-0.5">
              <input
                type="checkbox"
                checked={automated}
                onChange={(e) => setAutomated(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                aria-label="Automated test case"
              />
            </label>
          </MetadataFieldEdit>
          <MetadataFieldEdit label="Assigned to">
            <AssigneeInput
              value={assignedTo}
              onChange={setAssignedTo}
              suggestions={allUsernames ?? []}
              placeholder="—"
            />
          </MetadataFieldEdit>
          <MetadataFieldEdit label="Tags" className="min-w-[12rem]">
            <div className="relative min-w-[12rem]">
              <div className="flex min-h-[2rem] flex-wrap items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-500 dark:bg-slate-950">
                {displayTags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getTagColorClass(
                      tag,
                    )}`}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[10px] text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    } else if (e.key === "Backspace" && !tagInput) {
                      const last = displayTags[displayTags.length - 1];
                      if (last) {
                        handleRemoveTag(last);
                      }
                    }
                  }}
                  onBlur={() => {
                    handleAddTag(tagInput);
                  }}
                  placeholder={displayTags.length === 0 ? "Add tags…" : "Type and press Enter"}
                  className="min-w-[6rem] flex-1 border-0 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                />
              </div>
              {suggestedTags.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-ui border border-slate-200 bg-white text-xs shadow-lg dark:border-slate-600 dark:bg-slate-900">
                  {suggestedTags.map((tag) => (
                    <li key={tag}>
                      <TagOptionRow
                        tag={tag}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddTag(tag);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </MetadataFieldEdit>
          <CustomFieldsEditStrip
            value={params}
            onChange={setParams}
            paramKeys={paramKeys ?? []}
            paramValuesByKey={paramValuesByKey ?? {}}
            disabled={editorLocked}
          />
      </div>
    </header>
  );

  const bodyEditorProps = getLiveEditorProps({
    placeholder: "Write your test case body in Markdown…",
    "aria-label": "Case body (Markdown)",
    className:
      "min-h-[7.5rem] w-full overflow-y-hidden resize-none border-0 bg-transparent font-mono text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500",
    measureRef: bodyMeasureRef,
  });

  return (
    <DetailPanel title={<CaseBreadcrumb filePath={caseDetail?.file_path ?? selectedCaseFilePath} />} bodyScroll={false}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <StickyThenScroll
          stickyContent={
            <>
              {caseHeader}
              <div className="px-3 pt-1">
                <MarkdownToolbar
                  {...toolbarProps}
                  onInsertImage={handleInsertImageClick}
                  imageSyncBlocked
                  imageTooltip={imageDesktopTooltip}
                  imageActionLabel={null}
                  imageDisabled={editorLocked || manualSave}
                  rightContent={
                    manualSave ? (
                      <button
                        type="button"
                        onClick={handleInsertActionExpectationTable}
                        disabled={editorLocked}
                        title="Insert action-expectation table"
                        aria-label="Insert action-expectation table"
                        className="inline-flex shrink-0 items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      >
                        <Table2 className="h-4 w-4" />
                      </button>
                    ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleInsertActionExpectationTable}
                        disabled={editorLocked}
                        title="Insert action-expectation table"
                        aria-label="Insert action-expectation table"
                        className="inline-flex shrink-0 items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      >
                        <Table2 className="h-4 w-4" />
                      </button>
                    </>
                    )
                  }
                />
              </div>
            </>
          }
          scrollContent={
            <div className="px-3 py-3">
              <div className="relative">
                <LiveMarkdownEditor {...bodyEditorProps} />
              </div>
            </div>
          }
        />
        {error ? (
          <footer className="shrink-0 border-t border-slate-200 px-2 py-1.5 dark:border-slate-700">
            <div className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">{error}</div>
          </footer>
        ) : null}
      </div>
      {!manualSave && saveTemplateModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !saveTemplateSubmitting && setSaveTemplateModalOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="save-template-title"
            aria-modal="true"
            className="w-full max-w-md rounded-ui border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 id="save-template-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Save as template
              </h2>
              <button
                type="button"
                onClick={() => !saveTemplateSubmitting && setSaveTemplateModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTemplateForm} className="space-y-4 px-4 py-4">
              <div>
                <label htmlFor="save-template-name" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Template name
                </label>
                <input
                  id="save-template-name"
                  type="text"
                  autoFocus
                  value={saveTemplateName}
                  onChange={(e) => {
                    setSaveTemplateName(e.target.value);
                    setSaveTemplateError("");
                  }}
                  placeholder="e.g. smoke-test-body"
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-400 focus:border-indigo-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Saved as <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">.gitoza/test/templates/&lt;name&gt;.md</code>
                </p>
              </div>
              {saveTemplateError ? (
                <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                  {saveTemplateError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !saveTemplateSubmitting && setSaveTemplateModalOpen(false)}
                  className="rounded px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveTemplateSubmitting || !saveTemplateName.trim()}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saveTemplateSubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DetailPanel>
  );
}

export default CaseEditorPanel;
