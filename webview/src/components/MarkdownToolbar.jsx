import { Bold, Heading, Image, List, ListOrdered } from "lucide-react";
import Tooltip from "./Tooltip";

const btnCls =
  "rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-300";

/**
 * Reusable Markdown format toolbar (Bold, Heading, Bullet list, Numbered list).
 * Use with useMarkdownEditor; place in sticky area so it stays visible while body scrolls.
 */
export default function MarkdownToolbar({
  onBold,
  onHeading,
  onBulletList,
  onNumberedList,
  onInsertImage,
  disabled = false,
  imageDisabled = false,
  imageSyncBlocked = false,
  imageTooltip = null,
  onImageConfigureClick = null,
  imageActionLabel = "Configure",
  className = "",
  rightContent = null,
}) {
  const handleImageClick = imageSyncBlocked
    ? onImageConfigureClick || undefined
    : onInsertImage;

  const imageBtn = onInsertImage ? (
    <button
      type="button"
      onClick={handleImageClick}
      disabled={!imageSyncBlocked && (disabled || imageDisabled)}
      className={`${btnCls} ${imageSyncBlocked ? "cursor-default opacity-40" : ""}`}
      title={imageSyncBlocked ? undefined : "Insert image"}
      aria-label={imageSyncBlocked ? "Insert image (desktop app only)" : "Insert image"}
      aria-disabled={imageSyncBlocked || disabled || imageDisabled}
    >
      <Image className="h-3.5 w-3.5" />
    </button>
  ) : null;

  const showImageAction =
    imageSyncBlocked && onImageConfigureClick && imageActionLabel;

  return (
    <div
      className={`flex items-center gap-0.5 border-b border-slate-200 bg-white pb-1 dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <button
        type="button"
        onClick={onBold}
        disabled={disabled}
        className={btnCls}
        title="Bold"
        aria-label="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onHeading}
        disabled={disabled}
        className={btnCls}
        title="Heading"
        aria-label="Heading"
      >
        <Heading className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onBulletList}
        disabled={disabled}
        className={btnCls}
        title="Bullet list"
        aria-label="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onNumberedList}
        disabled={disabled}
        className={btnCls}
        title="Numbered list"
        aria-label="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      {imageBtn ? (
        <div className="inline-flex items-center gap-1">
          {imageSyncBlocked && imageTooltip ? (
            <Tooltip label={imageTooltip} placement="bottom" interactive>
              <span className="inline-flex">{imageBtn}</span>
            </Tooltip>
          ) : (
            imageBtn
          )}
          {showImageAction ? (
            <button
              type="button"
              onClick={onImageConfigureClick}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {imageActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {rightContent ? <div className="ml-2 flex min-w-0 flex-1 items-center gap-2">{rightContent}</div> : null}
    </div>
  );
}
