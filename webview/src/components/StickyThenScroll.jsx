/**
 * Layout: sticky content at top, scrollable content below (one scrollbar).
 * Use with bodyScroll={false} on DetailPanel so only this block scrolls; header + toolbar stay visible.
 */
export default function StickyThenScroll({ stickyContent, scrollContent, className = "" }) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div className="shrink-0">{stickyContent}</div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{scrollContent}</div>
    </div>
  );
}
