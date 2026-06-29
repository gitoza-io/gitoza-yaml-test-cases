import { useEffect, useRef } from "react";
import { BookOpen, Bug, ExternalLink, Mail, MessagesSquare } from "lucide-react";

import { SUPPORT_URLS } from "../constants/supportLinks";
import { openExternalUrl } from "../utils/openExternalUrl";

const SUPPORT_ITEMS = [
  {
    id: "documentation",
    label: "Documentation",
    description: "Guides and reference for using Gitoza.",
    icon: BookOpen,
    url: SUPPORT_URLS.documentation,
  },
  {
    id: "discussions",
    label: "Community Forum",
    description: "Ask questions and share ideas with other users.",
    icon: MessagesSquare,
    url: SUPPORT_URLS.discussions,
  },
  {
    id: "bug-report",
    label: "Report a Bug",
    description: "File an issue on GitHub with steps to reproduce.",
    icon: Bug,
    url: SUPPORT_URLS.bugReport,
  },
  {
    id: "contact",
    label: "Contact Support",
    description: "Billing, privacy, and account questions.",
    icon: Mail,
    url: SUPPORT_URLS.contactSupport,
  },
];

/**
 * Help & support overlay — external links open in the system browser or mail app.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(message: string, opts?: { title?: string }) => void} [props.onOpenError]
 */
export default function HelpModal({ open, onClose, onOpenError }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => closeRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleOpenLink = (url) => {
    openExternalUrl(url).catch(() => {
      onOpenError?.("Could not open link.", { title: "Open link failed" });
    });
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md animate-dropdown-enter rounded-ui border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2
            id="help-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Help &amp; support
          </h2>
        </div>

        <div className="space-y-2 px-4 py-4">
          {SUPPORT_ITEMS.map(({ id, label, description, icon: Icon, url }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleOpenLink(url)}
              className="flex w-full items-start gap-3 rounded-ui border border-transparent px-3 py-3 text-left transition hover:border-slate-200 hover:bg-list-hover dark:hover:border-slate-700 dark:hover:bg-slate-800/80"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-ui bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink dark:text-slate-100">
                  {label}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted dark:text-slate-500" aria-hidden />
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-muted dark:text-slate-400">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            className="w-full rounded-ui bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
