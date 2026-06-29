import { useRef, useCallback, useEffect } from "react";

/**
 * Returns the current line (text and range) containing the given cursor position.
 */
function getLineAtCursor(value, pos) {
  const len = value.length;
  let lineStart = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (value[i] === "\n") {
      lineStart = i + 1;
      break;
    }
  }
  let lineEnd = len;
  for (let i = pos; i < len; i++) {
    if (value[i] === "\n") {
      lineEnd = i;
      break;
    }
  }
  const lineText = value.slice(lineStart, lineEnd);
  return { lineText, lineStart, lineEnd };
}

/**
 * Inserts or replaces text at selection. Returns { newValue, newCursor } (cursor after inserted text).
 */
function replaceSelection(value, start, end, inserted) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = before + inserted + after;
  const newCursor = start + inserted.length;
  return { newValue, newCursor };
}

/**
 * Shared Markdown editor logic: cursor/selection helpers, insert, wrap, Enter continuation.
 * Use with MarkdownToolbar and a controlled textarea or LiveMarkdownEditor.
 *
 * @param {string} value - Controlled value.
 * @param {(v: string) => void} onChange - Update handler.
 * @param {{
 *   onBlur?: () => void,
 *   disabled?: boolean,
 *   growWithContent?: boolean,
 *   initialHeight?: number,
 *   livePreview?: boolean,
 *   repoSlug?: string | null,
 * }} [options]
 * @returns {{
 *   toolbarProps,
 *   textareaRef,
 *   liveEditorRef,
 *   getTextareaProps,
 *   getLiveEditorProps,
 *   insertAtCursor,
 *   livePreview: boolean,
 *   repoSlug: string | null | undefined,
 * }}
 */
export function useMarkdownEditor(value, onChange, options = {}) {
  const {
    onBlur,
    disabled = false,
    growWithContent = false,
    initialHeight,
    livePreview = false,
    repoSlug = null,
  } = options;
  const textareaRef = useRef(null);
  const liveEditorRef = useRef(null);
  const useLive = Boolean(livePreview);

  useEffect(() => {
    if (!growWithContent || useLive) return;
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    const contentHeight = el.scrollHeight;
    const height = initialHeight != null ? Math.max(initialHeight, contentHeight) : contentHeight;
    el.style.height = `${height}px`;
  }, [value, growWithContent, initialHeight, useLive]);

  const insertAtCursorPlain = useCallback(
    (toInsert, cursorOffset = toInsert.length) => {
      const el = textareaRef.current;
      if (!el || typeof onChange !== "function") return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const { newValue, newCursor } = replaceSelection(value, start, end, toInsert);
      onChange(newValue);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const pos = newCursor + (typeof cursorOffset === "number" ? cursorOffset - toInsert.length : 0);
          textareaRef.current.setSelectionRange(pos, pos);
        }
      });
    },
    [value, onChange],
  );

  const insertAtCursor = useCallback(
    (toInsert, cursorOffset = toInsert.length) => {
      if (useLive && liveEditorRef.current?.insertAtCursor) {
        liveEditorRef.current.insertAtCursor(toInsert, cursorOffset);
        return;
      }
      insertAtCursorPlain(toInsert, cursorOffset);
    },
    [useLive, insertAtCursorPlain],
  );

  const wrapSelectionPlain = useCallback(
    (before, after) => {
      const el = textareaRef.current;
      if (!el || typeof onChange !== "function") return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);
      const inserted = selected ? before + selected + after : before + after;
      const { newValue, newCursor } = replaceSelection(value, start, end, inserted);
      onChange(newValue);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const p = start + before.length + (end - start);
          textareaRef.current.setSelectionRange(p, p);
        }
      });
    },
    [value, onChange],
  );

  const wrapSelection = useCallback(
    (before, after) => {
      if (useLive && liveEditorRef.current?.wrapSelection) {
        liveEditorRef.current.wrapSelection(before, after);
        return;
      }
      wrapSelectionPlain(before, after);
    },
    [useLive, wrapSelectionPlain],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key !== "Enter") return;
      const el = textareaRef.current;
      if (!el || typeof onChange !== "function") return;
      const pos = el.selectionStart;
      const { lineText } = getLineAtCursor(value, pos);
      const numberedMatch = /^(\d+)\.\s/.exec(lineText);
      const bulletMatch = /^[-*]\s/.exec(lineText);
      if (numberedMatch) {
        e.preventDefault();
        const num = parseInt(numberedMatch[1], 10);
        const prefix = `\n${num + 1}. `;
        const { newValue, newCursor } = replaceSelection(value, pos, pos, prefix);
        onChange(newValue);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursor, newCursor);
          }
        });
      } else if (bulletMatch) {
        e.preventDefault();
        const prefix = "\n- ";
        const { newValue, newCursor } = replaceSelection(value, pos, pos, prefix);
        onChange(newValue);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursor, newCursor);
          }
        });
      }
    },
    [value, onChange],
  );

  const toolbarProps = {
    onBold: () => wrapSelection("**", "**"),
    onHeading: () => insertAtCursor("## "),
    onBulletList: () => insertAtCursor("- "),
    onNumberedList: () => insertAtCursor("1. "),
    disabled,
  };

  const getTextareaProps = useCallback(
    (overrides = {}) => ({
      ref: textareaRef,
      value,
      onChange: (e) => onChange(e.target.value),
      onBlur,
      onKeyDown: handleKeyDown,
      disabled,
      ...overrides,
    }),
    [value, onChange, onBlur, handleKeyDown, disabled],
  );

  const getLiveEditorProps = useCallback(
    (overrides = {}) => ({
      ref: liveEditorRef,
      value,
      onChange,
      repoSlug,
      onBlur,
      disabled,
      growWithContent,
      initialHeight,
      ...overrides,
    }),
    [value, onChange, repoSlug, onBlur, disabled, growWithContent, initialHeight],
  );

  return {
    toolbarProps,
    textareaRef,
    liveEditorRef,
    getTextareaProps,
    getLiveEditorProps,
    insertAtCursor,
    livePreview: useLive,
    repoSlug,
  };
}
