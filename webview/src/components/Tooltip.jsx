import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 600;
const HIDE_DELAY_MS = 100;
const INTERACTIVE_HIDE_DELAY_MS = 300;
const GAP_PX = 8;

// Softer, less prominent: light gray in light mode, medium gray in dark
const TOOLTIP_BASE_CLASS =
  "z-[1000] rounded-ui px-2 py-1 text-xs font-medium shadow-md max-w-xs " +
  "bg-slate-200/95 text-slate-800 dark:bg-slate-600/95 dark:text-slate-100";

// Arrow: softer triangle (wider base, shorter tip) for a friendlier look; color matches tooltip
const ARROW_LENGTH = 5; // distance from tooltip edge to tip
const ARROW_HALF_BASE = 4; // half of base width (full base = 8px), gives ~64° tip angle
const ARROW_COLOR_LIGHT = "rgb(226 232 240)"; // slate-200
const ARROW_COLOR_DARK = "rgb(71 85 105)"; // slate-600

/**
 * Reusable tooltip: shows after hover delay, has a small arrow pointing at the trigger.
 * Rendered in a portal so it is not clipped by overflow. Closes on click (trigger or document).
 * Accessible (focus triggers tooltip).
 *
 * @param {{
 *   label: React.ReactNode;
 *   children: React.ReactNode;
 *   placement?: 'right' | 'top' | 'bottom' | 'bottom-end';
 *   delayMs?: number;
 *   interactive?: boolean;
 * }} props
 * - bottom-end: tooltip below trigger, right edge aligned with trigger's right; arrow on the right.
 * - interactive: allow pointer events on the tooltip so links inside can be clicked; keeps open while hovering tooltip.
 */
function Tooltip({
  label,
  children,
  placement = "right",
  delayMs = SHOW_DELAY_MS,
  interactive = false,
}) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [positionReady, setPositionReady] = useState(false);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const suppressShowUntilRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideImmediate = useCallback(() => {
    clearTimers();
    setVisible(false);
    setPositionReady(false);
  }, [clearTimers]);

  const show = useCallback(() => {
    if (Date.now() < suppressShowUntilRef.current) return;
    clearTimers();
    showTimerRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [clearTimers, delayMs]);

  const hide = useCallback(() => {
    clearTimers();
    const hideDelay = interactive ? INTERACTIVE_HIDE_DELAY_MS : HIDE_DELAY_MS;
    hideTimerRef.current = setTimeout(hideImmediate, hideDelay);
  }, [clearTimers, hideImmediate, interactive]);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Position tooltip when it becomes visible
  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    let left;
    let top;

    if (placement === "top") {
      left = rect.left + rect.width / 2;
      top = rect.top - GAP_PX;
    } else if (placement === "bottom") {
      left = rect.left + rect.width / 2;
      top = rect.bottom + GAP_PX;
    } else if (placement === "bottom-end") {
      left = rect.right;
      top = rect.bottom + GAP_PX;
    } else {
      left = rect.right + GAP_PX;
      top = rect.top + rect.height / 2;
    }

    // Clamp horizontally to avoid being cut off at viewport edges.
    // Approximate max width should roughly match max-w-xs (~20rem ≈ 320px).
    const margin = 8;
    const viewportWidth =
      typeof window !== "undefined"
        ? window.innerWidth || document.documentElement.clientWidth || 0
        : 0;
    const approxMaxWidth = 320;

    if (viewportWidth > 0) {
      const half = approxMaxWidth / 2;
      const minCenter = margin + half;
      const maxCenter = viewportWidth - margin - half;
      if (placement === "top" || placement === "bottom") {
        if (left < minCenter) left = minCenter;
        if (left > maxCenter) left = maxCenter;
      } else if (placement === "bottom-end") {
        if (left - approxMaxWidth < margin) left = margin + approxMaxWidth;
        if (left > viewportWidth - margin) left = viewportWidth - margin;
      } else {
        // For side placement, keep tooltip fully inside viewport as best-effort.
        if (left + approxMaxWidth > viewportWidth - margin) {
          left = Math.max(margin, viewportWidth - margin - approxMaxWidth);
        }
      }
    }

    setPosition({ left, top });
    setPositionReady(true);
  }, [visible, placement]);

  // Close on any document click (including trigger click); suppress re-show on focus for a short time.
  // For interactive tooltips, ignore clicks inside the tooltip so links remain usable.
  const hideFromClick = useCallback(() => {
    hideImmediate();
    suppressShowUntilRef.current = Date.now() + 400;
  }, [hideImmediate]);

  useEffect(() => {
    if (!visible) return;
    const onDocClick = (e) => {
      if (interactive && tooltipRef.current?.contains(e.target)) return;
      hideFromClick();
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [visible, hideFromClick, interactive]);

  // Arrow color matches tooltip; detect dark mode for inline style (no dark: in style)
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const arrowColor = isDark ? ARROW_COLOR_DARK : ARROW_COLOR_LIGHT;

  const arrowStyleRight = {
    position: "absolute",
    left: -ARROW_LENGTH,
    top: "50%",
    transform: "translateY(-50%)",
    width: 0,
    height: 0,
    borderTop: `${ARROW_HALF_BASE}px solid transparent`,
    borderBottom: `${ARROW_HALF_BASE}px solid transparent`,
    borderRight: `${ARROW_LENGTH}px solid ${arrowColor}`,
  };
  const arrowStyleTop = {
    position: "absolute",
    bottom: -ARROW_LENGTH,
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: `${ARROW_HALF_BASE}px solid transparent`,
    borderRight: `${ARROW_HALF_BASE}px solid transparent`,
    borderTop: `${ARROW_LENGTH}px solid ${arrowColor}`,
  };
  const arrowStyleBottom = {
    position: "absolute",
    top: -ARROW_LENGTH,
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: `${ARROW_HALF_BASE}px solid transparent`,
    borderRight: `${ARROW_HALF_BASE}px solid transparent`,
    borderBottom: `${ARROW_LENGTH}px solid ${arrowColor}`,
  };
  const arrowStyleBottomEnd = {
    position: "absolute",
    top: -ARROW_LENGTH,
    right: 8,
    left: "auto",
    width: 0,
    height: 0,
    borderLeft: `${ARROW_HALF_BASE}px solid transparent`,
    borderRight: `${ARROW_HALF_BASE}px solid transparent`,
    borderBottom: `${ARROW_LENGTH}px solid ${arrowColor}`,
  };
  const arrowStyle =
    placement === "top"
      ? arrowStyleTop
      : placement === "bottom"
        ? arrowStyleBottom
        : placement === "bottom-end"
          ? arrowStyleBottomEnd
          : arrowStyleRight;

  const tooltipClassName = `${TOOLTIP_BASE_CLASS} relative overflow-visible ${
    interactive ? "pointer-events-auto" : "pointer-events-none"
  }`;

  const tooltipContent =
    visible && positionReady && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            className={tooltipClassName}
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              transform:
                placement === "top"
                  ? "translate(-50%, -100%)"
                  : placement === "bottom"
                    ? "translate(-50%, 0)"
                    : placement === "bottom-end"
                      ? "translate(-100%, 0)"
                      : "translateY(-50%)",
            }}
            onMouseEnter={interactive ? cancelHide : undefined}
            onMouseLeave={interactive ? hide : undefined}
          >
            <span style={arrowStyle} aria-hidden="true" role="presentation" />
            {label}
          </span>,
          document.body
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={(e) => {
          if (interactive && tooltipRef.current?.contains(e.relatedTarget)) return;
          hide();
        }}
        onClick={hideFromClick}
      >
        {children}
      </span>
      {tooltipContent}
    </>
  );
}

export default Tooltip;
