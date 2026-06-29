import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import ResizableImage from "./ResizableImage";
import {
  parseMarkdownBodyBlocks,
  removeBodyBlockAt,
  serializeMarkdownBodyBlocks,
  updateImageBlockWidth,
} from "../utils/parseMarkdownBodyBlocks";
import { setImageLineWidth } from "../utils/markdownImageLine";
import { isTauri } from "../license/tauriEnv";
import { deleteLocalAsset } from "../services/api";

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
  return { lineText: value.slice(lineStart, lineEnd), lineStart, lineEnd };
}

function replaceSelection(value, start, end, inserted) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = before + inserted + after;
  const newCursor = start + inserted.length;
  return { newValue, newCursor };
}

/**
 * @param {import("../utils/parseMarkdownBodyBlocks").BodyBlock[]} blocks
 * @param {number} fromIndex
 * @returns {{ blockIndex: number } | null}
 */
function findNextTextBlock(blocks, fromIndex) {
  for (let i = fromIndex + 1; i < blocks.length; i++) {
    if (blocks[i].type === "text") return { blockIndex: i };
  }
  return null;
}

/**
 * @param {import("../utils/parseMarkdownBodyBlocks").BodyBlock[]} blocks
 * @param {number} fromIndex
 * @returns {{ blockIndex: number } | null}
 */
function findPrevTextBlock(blocks, fromIndex) {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (blocks[i].type === "text") return { blockIndex: i };
  }
  return null;
}

/**
 * @param {import("../utils/parseMarkdownBodyBlocks").BodyBlock[]} blocks
 * @param {number} fromBlockIndex
 * @returns {number | null}
 */
function findTextBlockBeforeImage(blocks, fromBlockIndex) {
  for (let i = fromBlockIndex - 1; i >= 0; i--) {
    if (blocks[i].type === "text") return i;
  }
  return null;
}

/**
 * @param {import("../utils/parseMarkdownBodyBlocks").BodyBlock[]} blocks
 * @param {number} blockIndex
 */
function isTextBlockBeforeImage(blocks, blockIndex) {
  return (
    blocks[blockIndex]?.type === "text" &&
    blocks[blockIndex + 1]?.type === "image"
  );
}

/**
 * @typedef {{
 *   insertAtCursor: (text: string, cursorOffset?: number) => void,
 *   wrapSelection: (before: string, after: string) => void,
 *   focus: () => void,
 *   getTextareaRef: () => HTMLTextAreaElement | null,
 * }} LiveMarkdownEditorHandle
 */

const LiveMarkdownEditor = forwardRef(function LiveMarkdownEditor(
  {
    value = "",
    onChange,
    repoSlug = null,
    disabled = false,
    placeholder = "Markdown…",
    className = "",
    growWithContent = false,
    initialHeight,
    onBlur,
    "aria-label": ariaLabel,
    measureRef: externalMeasureRef,
  },
  ref,
) {
  const blocks = useMemo(() => parseMarkdownBodyBlocks(value), [value]);
  const showLivePreview = Boolean(repoSlug) && isTauri();
  const activeTextRef = useRef(null);
  const blockTextRefs = useRef(/** @type {Record<number, HTMLTextAreaElement | null>} */ ({}));
  const internalMeasureRef = useRef(null);
  const containerRef = useRef(null);

  const setMeasureRef = useCallback(
    (el) => {
      internalMeasureRef.current = el;
      if (typeof externalMeasureRef === "function") {
        externalMeasureRef(el);
      } else if (externalMeasureRef && "current" in externalMeasureRef) {
        externalMeasureRef.current = el;
      }
    },
    [externalMeasureRef],
  );

  const emitChange = useCallback(
    (nextBlocks) => {
      if (typeof onChange === "function") {
        onChange(serializeMarkdownBodyBlocks(nextBlocks));
      }
    },
    [onChange],
  );

  const getActiveTextarea = useCallback(() => {
    if (activeTextRef.current) return activeTextRef.current;
    const refs = blockTextRefs.current;
    const keys = Object.keys(refs)
      .map(Number)
      .sort((a, b) => b - a);
    for (const k of keys) {
      if (refs[k]) return refs[k];
    }
    return null;
  }, []);

  const focusActive = useCallback(() => {
    const el = getActiveTextarea();
    el?.focus();
  }, [getActiveTextarea]);

  const focusTextBlock = useCallback((blockIndex, cursorPos) => {
    const el = blockTextRefs.current[blockIndex];
    if (!el) return;
    const pos = Math.max(0, Math.min(cursorPos, el.value.length));
    el.focus();
    el.setSelectionRange(pos, pos);
    activeTextRef.current = el;
  }, []);

  const handleBlockNavigation = useCallback(
    (e, blockIndex) => {
      const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!navKeys.includes(e.key)) return;

      const el = blockTextRefs.current[blockIndex];
      if (!el || el.selectionStart !== el.selectionEnd) return;

      const pos = el.selectionStart;
      const len = el.value.length;
      if (e.key === "ArrowDown" && pos === len) {
        const next = findNextTextBlock(blocks, blockIndex);
        if (next) {
          e.preventDefault();
          focusTextBlock(next.blockIndex, 0);
        }
        return;
      }

      if (e.key === "ArrowUp" && pos === 0) {
        const prev = findPrevTextBlock(blocks, blockIndex);
        if (prev) {
          e.preventDefault();
          const prevEl = blockTextRefs.current[prev.blockIndex];
          focusTextBlock(prev.blockIndex, prevEl?.value.length ?? 0);
        }
        return;
      }

      if (e.key === "ArrowRight" && pos === len) {
        const next = findNextTextBlock(blocks, blockIndex);
        if (next) {
          e.preventDefault();
          focusTextBlock(next.blockIndex, 0);
        }
        return;
      }

      if (e.key === "ArrowLeft" && pos === 0) {
        const prev = findPrevTextBlock(blocks, blockIndex);
        if (prev) {
          e.preventDefault();
          const prevEl = blockTextRefs.current[prev.blockIndex];
          focusTextBlock(prev.blockIndex, prevEl?.value.length ?? 0);
        }
      }
    },
    [blocks, focusTextBlock],
  );

  const insertAtCursor = useCallback(
    (toInsert, cursorOffset = toInsert.length) => {
      const el = getActiveTextarea();
      if (!el || typeof onChange !== "function") {
        onChange((value || "") + toInsert);
        return;
      }

      const blockIndex = Number(el.dataset.blockIndex);
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const segment = el.value;
      const { newValue: newSegment, newCursor } = replaceSelection(
        segment,
        start,
        end,
        toInsert,
      );

      const nextBlocks = blocks.map((b, i) =>
        i === blockIndex && b.type === "text"
          ? { ...b, content: newSegment }
          : b,
      );
      const serialized = serializeMarkdownBodyBlocks(nextBlocks);
      onChange(serialized);

      requestAnimationFrame(() => {
        const nextEl = blockTextRefs.current[blockIndex];
        if (nextEl) {
          nextEl.focus();
          const pos =
            newCursor +
            (typeof cursorOffset === "number" ? cursorOffset - toInsert.length : 0);
          nextEl.setSelectionRange(pos, pos);
          activeTextRef.current = nextEl;
        }
      });
    },
    [blocks, getActiveTextarea, onChange, value],
  );

  const wrapSelection = useCallback(
    (before, after) => {
      const el = getActiveTextarea();
      if (!el || typeof onChange !== "function") return;

      const blockIndex = Number(el.dataset.blockIndex);
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const segment = el.value;
      const selected = segment.slice(start, end);
      const inserted = selected ? before + selected + after : before + after;
      const { newValue: newSegment, newCursor } = replaceSelection(
        segment,
        start,
        end,
        inserted,
      );

      const nextBlocks = blocks.map((b, i) =>
        i === blockIndex && b.type === "text"
          ? { ...b, content: newSegment }
          : b,
      );
      onChange(serializeMarkdownBodyBlocks(nextBlocks));

      requestAnimationFrame(() => {
        const nextEl = blockTextRefs.current[blockIndex];
        if (nextEl) {
          nextEl.focus();
          const p = start + before.length + (end - start);
          nextEl.setSelectionRange(p, p);
          activeTextRef.current = nextEl;
        }
      });
    },
    [blocks, getActiveTextarea, onChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor,
      wrapSelection,
      focus: focusActive,
      getTextareaRef: getActiveTextarea,
    }),
    [insertAtCursor, wrapSelection, focusActive, getActiveTextarea],
  );

  const handleTextChange = useCallback(
    (blockIndex, nextContent) => {
      const nextBlocks = blocks.map((b, i) =>
        i === blockIndex && b.type === "text" ? { ...b, content: nextContent } : b,
      );
      emitChange(nextBlocks);
    },
    [blocks, emitChange],
  );

  const handleRemoveImageBlock = useCallback(
    (blockIndex) => {
      const block = blocks[blockIndex];
      const fileName = block?.type === "image" ? block.fileName : null;

      const nextBlocks = removeBodyBlockAt(blocks, blockIndex);
      emitChange(nextBlocks);

      if (showLivePreview && fileName) {
        void deleteLocalAsset(repoSlug, fileName).catch((err) => {
          console.warn("[LiveMarkdownEditor] delete_local_asset failed:", err);
        });
      }

      /** @type {{ blockIndex: number, pos: number } | null} */
      let focusTarget = null;
      for (let i = blockIndex - 1; i >= 0; i--) {
        const b = nextBlocks[i];
        if (b.type === "text") {
          focusTarget = { blockIndex: i, pos: b.content.length };
          break;
        }
      }
      if (!focusTarget) {
        for (let i = 0; i < nextBlocks.length; i++) {
          const b = nextBlocks[i];
          if (b.type === "text") {
            focusTarget = { blockIndex: i, pos: 0 };
            break;
          }
        }
      }

      requestAnimationFrame(() => {
        if (focusTarget) focusTextBlock(focusTarget.blockIndex, focusTarget.pos);
      });
    },
    [blocks, emitChange, focusTextBlock, showLivePreview, repoSlug],
  );

  const handleImageWidthChange = useCallback(
    (blockIndex, widthPx) => {
      const nextBlocks = updateImageBlockWidth(
        blocks,
        blockIndex,
        widthPx,
        setImageLineWidth,
      );
      emitChange(nextBlocks);
    },
    [blocks, emitChange],
  );

  const handleKeyDown = useCallback(
    (e, blockIndex) => {
      handleBlockNavigation(e, blockIndex);
      if (e.defaultPrevented) return;

      if (e.key !== "Enter" || typeof onChange !== "function") return;
      const el = blockTextRefs.current[blockIndex];
      if (!el) return;
      const pos = el.selectionStart;
      if (pos !== el.selectionEnd) return;

      if (
        pos === 0 &&
        blocks[blockIndex - 1]?.type === "image"
      ) {
        const leadingIndex = findTextBlockBeforeImage(blocks, blockIndex);
        if (leadingIndex != null) {
          const leading = blocks[leadingIndex];
          if (leading.type === "text") {
            e.preventDefault();
            const newContent = leading.content + "\n";
            const nextBlocks = blocks.map((b, i) =>
              i === leadingIndex && b.type === "text"
                ? { ...b, content: newContent }
                : b,
            );
            onChange(serializeMarkdownBodyBlocks(nextBlocks));
            requestAnimationFrame(() => {
              focusTextBlock(leadingIndex, newContent.length);
            });
          }
        }
        return;
      }

      const segment = el.value;
      const { lineText } = getLineAtCursor(segment, pos);
      const numberedMatch = /^(\d+)\.\s/.exec(lineText);
      const bulletMatch = /^[-*]\s/.exec(lineText);
      if (numberedMatch) {
        e.preventDefault();
        const num = parseInt(numberedMatch[1], 10);
        const prefix = `\n${num + 1}. `;
        const { newValue: newSegment, newCursor } = replaceSelection(
          segment,
          pos,
          pos,
          prefix,
        );
        const nextBlocks = blocks.map((b, i) =>
          i === blockIndex && b.type === "text"
            ? { ...b, content: newSegment }
            : b,
        );
        onChange(serializeMarkdownBodyBlocks(nextBlocks));
        requestAnimationFrame(() => {
          const nextEl = blockTextRefs.current[blockIndex];
          if (nextEl) {
            nextEl.focus();
            nextEl.setSelectionRange(newCursor, newCursor);
          }
        });
      } else if (bulletMatch) {
        e.preventDefault();
        const prefix = "\n- ";
        const { newValue: newSegment, newCursor } = replaceSelection(
          segment,
          pos,
          pos,
          prefix,
        );
        const nextBlocks = blocks.map((b, i) =>
          i === blockIndex && b.type === "text"
            ? { ...b, content: newSegment }
            : b,
        );
        onChange(serializeMarkdownBodyBlocks(nextBlocks));
        requestAnimationFrame(() => {
          const nextEl = blockTextRefs.current[blockIndex];
          if (nextEl) {
            nextEl.focus();
            nextEl.setSelectionRange(newCursor, newCursor);
          }
        });
      }
    },
    [blocks, onChange, handleBlockNavigation, focusTextBlock],
  );

  useEffect(() => {
    if (!growWithContent) return;
    const textareas = Object.values(blockTextRefs.current).filter(Boolean);

    const syncHeights = () => {
      textareas.forEach((ta) => {
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      });
    };

    syncHeights();
  }, [value, blocks, growWithContent]);

  const firstTextBlockIndex = blocks.findIndex((b) => b.type === "text");

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={
        initialHeight != null && growWithContent
          ? { minHeight: `${initialHeight}px` }
          : undefined
      }
    >
      <textarea
        ref={setMeasureRef}
        value={value}
        readOnly
        aria-hidden
        tabIndex={-1}
        className={`${className} pointer-events-none absolute left-0 top-0 w-full invisible`}
      />
      <div className="relative w-full">
        {blocks.map((block, blockIndex) => {
          if (block.type === "text") {
            const isFirstText = blockIndex === firstTextBlockIndex;
            const beforeImage = isTextBlockBeforeImage(blocks, blockIndex);
            const heightClass = isFirstText
              ? ""
              : beforeImage
                ? "min-h-6"
                : "!min-h-0";
            return (
              <textarea
                key={`text-${blockIndex}`}
                ref={(el) => {
                  blockTextRefs.current[blockIndex] = el;
                }}
                data-block-index={blockIndex}
                value={block.content}
                onChange={(e) => handleTextChange(blockIndex, e.target.value)}
                onFocus={(e) => {
                  activeTextRef.current = e.currentTarget;
                }}
                onBlur={onBlur}
                onKeyDown={(e) => handleKeyDown(e, blockIndex)}
                disabled={disabled}
                placeholder={isFirstText ? placeholder : undefined}
                aria-label={isFirstText ? ariaLabel : undefined}
                rows={1}
                className={`${className} block w-full resize-none overflow-hidden border-0 bg-transparent outline-none ${heightClass}`}
              />
            );
          }

          return (
            <div
              key={`image-${blockIndex}`}
              className="my-1"
              role="group"
              aria-label="Embedded image"
            >
              <ResizableImage
                repoSlug={repoSlug}
                fileName={block.fileName}
                alt={block.alt}
                resizable={showLivePreview && !disabled}
                disabled={disabled}
                onWidthChange={
                  showLivePreview
                    ? (px) => handleImageWidthChange(blockIndex, px)
                    : undefined
                }
                onRemove={
                  disabled ? undefined : () => handleRemoveImageBlock(blockIndex)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default LiveMarkdownEditor;
