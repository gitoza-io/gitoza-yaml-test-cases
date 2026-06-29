import { useEffect, useRef } from "react";
import { Tag, X } from "lucide-react";
import UpdatedByLine from "./UpdatedByLine";
import { getTagColorClass } from "../utils/tagColor";
import ApproveStatusBadge from "./ApproveStatusBadge";
import MarkdownInlineImage from "./MarkdownInlineImage";
import { consumeFencedCodeBlock } from "../utils/markdownFencedCode";
import { highlightCodeBlock } from "../utils/highlightCodeBlock";

// ---------------------------------------------------------------------------
// Lightweight Markdown → React renderer (no external dependency)
// Supports: h1-h3, blockquotes, fenced code blocks, inline code, task lists,
// ordered/unordered lists, GFM pipe tables, paragraphs, bold, italic, horizontal rules.
// ---------------------------------------------------------------------------

function parsePipeTableRow(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  const inner = t.endsWith("|") ? t.slice(1, -1) : t.slice(1);
  return inner.split("|").map((c) => c.trim());
}

/** GFM alignment row: | --- | :--- | ---: | */
function isTableSeparatorRow(line) {
  const cells = parsePipeTableRow(line);
  if (!cells || cells.length === 0) return false;
  return cells.every((c) => /^:?-{1,}:?$/.test(c.trim()));
}

export function renderMarkdown(text, options = {}) {
  const { repoSlug = null } = options;
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  let key = 0;

  const k = () => `md-${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") { i++; continue; }

    // Fenced code block (must run before horizontal rules so --- inside fences is preserved)
    const fence = consumeFencedCodeBlock(lines, i);
    if (fence) {
      const html = highlightCodeBlock(fence.code, fence.lang);
      elements.push(
        <pre
          key={k()}
          className="my-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/50"
        >
          <code
            className={`hljs block font-mono text-xs leading-relaxed${fence.lang ? ` language-${fence.lang}` : ""}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>,
      );
      i = fence.nextIndex;
      continue;
    }

    // Standalone image (asset id in parens, not a URL path)
    const imageLine = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imageLine) {
      elements.push(
        <MarkdownInlineImage
          key={k()}
          alt={imageLine[1]}
          fileName={imageLine[2]}
          repoSlug={repoSlug}
        />,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      elements.push(<hr key={k()} className="my-5 border-slate-200 dark:border-slate-700/60" />);
      i++; continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const cls = level === 1
        ? "mb-3 mt-6 text-lg font-bold text-slate-900 dark:text-slate-100"
        : level === 2
          ? "mb-2 mt-5 text-base font-semibold text-slate-800 dark:text-slate-200"
          : "mb-1.5 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300";
      elements.push(<div key={k()} className={cls}>{inlineFormat(content)}</div>);
      i++; continue;
    }

    // Blockquote block (collect consecutive > lines)
    if (line.trimStart().startsWith(">")) {
      const bqLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        bqLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote key={k()} className="my-3 rounded-r-lg border-l-4 border-indigo-400 bg-indigo-50/60 py-2.5 pl-4 pr-3 text-sm text-slate-700 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-slate-300">
          {bqLines.map((l, j) => <p key={j} className="leading-relaxed">{inlineFormat(l)}</p>)}
        </blockquote>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s/, ""));
        i++;
      }
      elements.push(
        <ol key={k()} className="my-2 list-decimal space-y-1 pl-6 text-sm text-slate-800 marker:text-slate-400 dark:text-slate-200 dark:marker:text-slate-500">
          {items.map((item, j) => <li key={j} className="leading-relaxed">{inlineFormat(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Unordered / task list
    if (/^\s*[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      const hasTasks = items.some((it) => /^\[[ xX]\]\s/.test(it));
      if (hasTasks) {
        elements.push(
          <ul key={k()} className="my-2 space-y-1.5 pl-1 text-sm">
            {items.map((item, j) => {
              const checked = /^\[[xX]\]\s/.test(item);
              const label = item.replace(/^\[[ xX]\]\s/, "");
              return (
                <li key={j} className="flex items-start gap-2.5 leading-relaxed text-slate-800 dark:text-slate-200">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${checked ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-500" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"}`}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className={checked ? "text-slate-500 line-through dark:text-slate-400" : ""}>{inlineFormat(label)}</span>
                </li>
              );
            })}
          </ul>
        );
      } else {
        elements.push(
          <ul key={k()} className="my-2 list-disc space-y-1 pl-6 text-sm text-slate-800 marker:text-slate-400 dark:text-slate-200 dark:marker:text-slate-500">
            {items.map((item, j) => <li key={j} className="leading-relaxed">{inlineFormat(item)}</li>)}
          </ul>
        );
      }
      continue;
    }

    // GFM pipe table
    if (line.trim().startsWith("|")) {
      const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
      const headerCells = parsePipeTableRow(line);
      if (headerCells && headerCells.length > 0 && isTableSeparatorRow(nextLine)) {
        i += 2;
        const bodyRows = [];
        while (i < lines.length) {
          const rowLine = lines[i];
          if (rowLine.trim() === "") break;
          if (!rowLine.trim().startsWith("|")) break;
          const rowCells = parsePipeTableRow(rowLine);
          if (rowCells) bodyRows.push(rowCells);
          i++;
        }
        elements.push(
          <div key={k()} className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600/80">
            <table className="min-w-full border-collapse text-sm text-slate-800 dark:text-slate-200">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80">
                  {headerCells.map((h, hi) => (
                    <th
                      key={hi}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                    >
                      {inlineFormat(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-700/80"
                  >
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 align-top text-sm">
                        {inlineFormat(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    // Paragraph (default)
    elements.push(
      <p key={k()} className="my-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">{inlineFormat(line)}</p>
    );
    i++;
  }

  return elements;
}

/** Format inline Markdown: bold, italic, inline code, links. */
function inlineFormat(text) {
  if (!text) return text;
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(inlineFormat(codeMatch[1]));
      parts.push(
        <code key={`ic-${key++}`} className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-700/60 dark:text-slate-300">
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
      continue;
    }
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1]);
      parts.push(<strong key={`b-${key++}`} className="font-semibold">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }
    // Italic
    const italicMatch = remaining.match(/^(.*?)(?<!\*)\*([^*]+)\*(?!\*)(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(italicMatch[1]);
      parts.push(<em key={`i-${key++}`}>{italicMatch[2]}</em>);
      remaining = italicMatch[3];
      continue;
    }
    // No match — push remainder
    parts.push(remaining);
    break;
  }
  return parts.length === 1 ? parts[0] : parts;
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

export const priorityColors = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-blue-600 dark:text-blue-400",
};

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function TestCaseDetailModal({ testCase, onClose, reviewEnabled = true }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

  // Close on overlay click (not panel click)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  // Close on Escape
  useEffect(() => {
    if (!testCase) return;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [testCase, onClose]);

  if (!testCase) return null;

  const tags = testCase.tags ?? [];
  const priorityKey = (testCase.priority || "").toLowerCase();

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex justify-end animate-overlay-fadein"
    >
      {/* Panel — slides in from right */}
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-2xl flex-col rounded-l-ui border-l border-slate-200 bg-white shadow-2xl animate-drawer-slidein dark:border-slate-800 dark:bg-slate-950"
      >
        {/* ── Sticky Header ── */}
        <header className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 font-mono text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  {testCase.case_id || "—"}
                </span>
                <ApproveStatusBadge status={testCase.approve_status} reviewEnabled={reviewEnabled} />
              </div>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {testCase.title || "Untitled Test Case"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Close detail panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ── Scrollable Content ── */}
        <div className="main-content-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">

          {/* ─ Metadata Strip ─ */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {/* Priority */}
            {testCase.priority && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Priority</span>
                <span className={`font-semibold ${priorityColors[priorityKey] || "text-slate-600 dark:text-slate-300"}`}>
                  {capitalize(testCase.priority)}
                </span>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getTagColorClass(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─ Divider ─ */}
          <hr className="my-5 border-slate-100 dark:border-slate-800/60" />

          {/* ─ Markdown Body ─ */}
          {testCase.body ? (
            <article className="prose-rex">
              {renderMarkdown(testCase.body)}
            </article>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No body content for this test case.
            </p>
          )}
        </div>

        {/* ── Footer — Updated by · relative time ── */}
        {(testCase.updated_at || testCase.updated_by) && (
          <footer className="shrink-0 border-t border-slate-100 px-6 py-3 dark:border-slate-800/80">
            <UpdatedByLine updatedAt={testCase.updated_at} updatedBy={testCase.updated_by} />
          </footer>
        )}
      </div>
    </div>
  );
}

export default TestCaseDetailModal;
