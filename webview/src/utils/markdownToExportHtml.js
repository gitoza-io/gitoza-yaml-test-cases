/**
 * Markdown → static HTML for print/PDF export.
 * Mirrors TestCaseDetailModal.renderMarkdown + inline rules (headings, lists, tasks,
 * blockquote, fenced code blocks, hr, bold/italic/code).
 *
 * @module utils/markdownToExportHtml
 */

import { consumeFencedCodeBlock } from "./markdownFencedCode";
import { highlightCodeBlock } from "./highlightCodeBlock";
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parsePipeTableRow(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  const inner = t.endsWith("|") ? t.slice(1, -1) : t.slice(1);
  return inner.split("|").map((c) => c.trim());
}

function isTableSeparatorRow(line) {
  const cells = parsePipeTableRow(line);
  if (!cells || cells.length === 0) return false;
  return cells.every((c) => /^:?-{1,}:?$/.test(c.trim()));
}

/**
 * @param {string} text
 * @returns {string}
 */
function inlineFormatToHtml(text) {
  if (text == null || text === "") return "";
  const codeMatch = text.match(/^(.*?)`([^`]+)`(.*)/s);
  if (codeMatch) {
    return (
      inlineFormatToHtml(codeMatch[1]) +
      `<code class="export-md-code">${escapeHtml(codeMatch[2])}</code>` +
      inlineFormatToHtml(codeMatch[3])
    );
  }
  const boldMatch = text.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
  if (boldMatch) {
    return (
      inlineFormatToHtml(boldMatch[1]) +
      `<strong class="export-md-strong">${escapeHtml(boldMatch[2])}</strong>` +
      inlineFormatToHtml(boldMatch[3])
    );
  }
  const italicMatch = text.match(/^(.*?)(?<!\*)\*([^*]+)\*(?!\*)(.*)/s);
  if (italicMatch) {
    return (
      inlineFormatToHtml(italicMatch[1]) +
      `<em class="export-md-em">${escapeHtml(italicMatch[2])}</em>` +
      inlineFormatToHtml(italicMatch[3])
    );
  }
  return escapeHtml(text);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function markdownToExportHtml(text) {
  if (!text || !String(text).trim()) {
    return '<p class="export-md-p export-md-muted">No body content for this test case.</p>';
  }
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = consumeFencedCodeBlock(lines, i);
    if (fence) {
      const langAttr = fence.lang ? ` data-language="${escapeHtml(fence.lang)}"` : "";
      const highlighted = highlightCodeBlock(fence.code, fence.lang);
      blocks.push(
        `<pre class="export-md-pre"><code class="export-md-pre-code hljs"${langAttr}>${highlighted}</code></pre>`,
      );
      i = fence.nextIndex;
      continue;
    }
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      blocks.push('<hr class="export-md-hr" />');
      i++;
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const cls = level === 1 ? "export-md-h1" : level === 2 ? "export-md-h2" : "export-md-h3";
      blocks.push(`<div class="${cls}">${inlineFormatToHtml(content)}</div>`);
      i++;
      continue;
    }
    if (line.trimStart().startsWith(">")) {
      const bqLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        bqLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const inner = bqLines
        .map((l) => `<p class="export-md-bq-p">${inlineFormatToHtml(l)}</p>`)
        .join("");
      blocks.push(`<blockquote class="export-md-bq">${inner}</blockquote>`);
      continue;
    }
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s/, ""));
        i++;
      }
      const lis = items.map((item) => `<li class="export-md-li">${inlineFormatToHtml(item)}</li>`).join("");
      blocks.push(`<ol class="export-md-ol">${lis}</ol>`);
      continue;
    }
    if (/^\s*[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      const hasTasks = items.some((it) => /^\[[ xX]\]\s/.test(it));
      if (hasTasks) {
        const lis = items
          .map((item) => {
            const checked = /^\[[xX]\]\s/.test(item);
            const label = item.replace(/^\[[ xX]\]\s/, "");
            const box = checked
              ? '<span class="export-md-taskbox export-md-taskbox-checked">✓</span>'
              : '<span class="export-md-taskbox"></span>';
            const textCls = checked ? " export-md-task-done" : "";
            return `<li class="export-md-task-li">${box}<span class="export-md-task-text${textCls}">${inlineFormatToHtml(label)}</span></li>`;
          })
          .join("");
        blocks.push(`<ul class="export-md-ul export-md-task-ul">${lis}</ul>`);
      } else {
        const lis = items.map((item) => `<li class="export-md-li">${inlineFormatToHtml(item)}</li>`).join("");
        blocks.push(`<ul class="export-md-ul-disc">${lis}</ul>`);
      }
      continue;
    }
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
        const ths = headerCells
          .map((h) => `<th class="export-md-th">${inlineFormatToHtml(h)}</th>`)
          .join("");
        const trs = bodyRows
          .map(
            (row) =>
              `<tr class="export-md-tr">${row.map((c) => `<td class="export-md-td">${inlineFormatToHtml(c)}</td>`).join("")}</tr>`,
          )
          .join("");
        blocks.push(
          `<div class="export-md-table-wrap"><table class="export-md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`,
        );
        continue;
      }
    }
    blocks.push(`<p class="export-md-p">${inlineFormatToHtml(line)}</p>`);
    i++;
  }

  return blocks.join("\n");
}
