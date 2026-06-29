import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useConfirm } from "./ConfirmProvider";
import { SETTINGS_PRIMARY_BUTTON_CLASS, SETTINGS_SECONDARY_BUTTON_CLASS } from "../constants/uiRadius";
import { openExternalUrl } from "../utils/openExternalUrl";
import { getInvokeErrorMessage } from "../license/invokeError.js";
import { useLicense } from "../license/LicenseProvider.jsx";

function formatSubscriptionEnd(expiresAt) {
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    return null;
  }
  return expiresAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Compact license & compliance block for Settings → General.
 *
 * @param {object} props
 * @param {number} [props.focusKey] - Increment to focus the activation key input.
 */
export function LicenseComplianceSection({ focusKey = 0 }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const appliedFocusKeyRef = useRef(0);
  const confirm = useConfirm();
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [activateMessage, setActivateMessage] = useState(null);
  const [showActivationForm, setShowActivationForm] = useState(false);
  const license = useLicense();

  const isCommercialActive = license.isCommercialActive;
  const subscriptionEndLabel = formatSubscriptionEnd(license.expiresAt);

  useEffect(() => {
    if (focusKey > appliedFocusKeyRef.current) {
      appliedFocusKeyRef.current = focusKey;
      setShowActivationForm(true);
    }
  }, [focusKey]);

  useEffect(() => {
    if (!showActivationForm) return;
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showActivationForm]);

  const onUnbindFromDevice = useCallback(async () => {
    const ok = await confirm({
      title: "Remove license from this device?",
      description:
        "This frees this computer on our license server so you can activate again on another device with the same activation key. The local license file will be deleted and this installation will show Personal Edition.",
      confirmLabel: "Remove from this device",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    setActivateMessage(null);
    try {
      await license.unbindOnDevice();
      setActivateMessage({
        type: "ok",
        text: "License removed from this device. Activate on your other computer with the same key.",
      });
    } catch (e) {
      setActivateMessage({
        type: "err",
        text: getInvokeErrorMessage(e, "Could not remove license from this device."),
      });
    }
  }, [confirm, license]);

  const onActivate = useCallback(async () => {
    setActivateMessage(null);
    try {
      await license.activate(licenseKeyInput);
      setActivateMessage({ type: "ok", text: "Commercial license activated." });
      setLicenseKeyInput("");
    } catch (e) {
      setActivateMessage({
        type: "err",
        text: getInvokeErrorMessage(e, "Activation failed."),
      });
    }
  }, [license, licenseKeyInput]);

  const onPurchase = useCallback(() => {
    openExternalUrl("https://gitoza.com").catch(() => {
      setActivateMessage({
        type: "err",
        text: "Could not open purchase page.",
      });
    });
  }, []);

  const organizationName = license.organizationName?.trim() || null;

  return (
    <div className="space-y-3 rounded-ui border border-slate-200 p-4 dark:border-slate-700">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            License &amp; Compliance
          </h3>
          {isCommercialActive ? (
            <button
              type="button"
              disabled={license.activateSubmitting}
              onClick={onUnbindFromDevice}
              className="shrink-0 text-sm font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Remove from this device
            </button>
          ) : null}
        </div>
      </div>

      {isCommercialActive ? (
        <div
          className="rounded-ui border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/80 dark:bg-emerald-950/40"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Commercial License — Active
          </p>

          {organizationName ? (
            <div className="mt-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Licensed to
              </p>
              <p className="mt-0.5 text-base font-semibold leading-snug text-emerald-950 dark:text-emerald-50">
                {organizationName}
              </p>
            </div>
          ) : null}

          {subscriptionEndLabel ? (
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400">
              Subscription active until {subscriptionEndLabel}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-ui border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Personal Edition
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowActivationForm(true);
                  setActivateMessage(null);
                }}
                className={SETTINGS_PRIMARY_BUTTON_CLASS}
              >
                Activate commercial license
              </button>
              <button type="button" onClick={onPurchase} className={SETTINGS_SECONDARY_BUTTON_CLASS}>
                Purchase
              </button>
            </div>
          </div>
          {showActivationForm ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enter your activation key to activate a commercial license on this device.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={inputRef}
                  id={inputId}
                  type="text"
                  autoComplete="off"
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="XXXX-XXXX-…"
                  className="h-8 min-w-0 flex-1 rounded-ui border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={license.activateSubmitting || !licenseKeyInput.trim()}
                  onClick={onActivate}
                  className={SETTINGS_PRIMARY_BUTTON_CLASS}
                >
                  {license.activateSubmitting ? "Activating…" : "Activate"}
                </button>
              </div>
            </div>
          ) : null}
          {license.error && !isCommercialActive ? (
            <p className="rounded-ui border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {license.error}
            </p>
          ) : null}
        </>
      )}

      {activateMessage ? (
        <p
          className={`rounded-ui border px-3 py-2 text-sm ${
            activateMessage.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
          }`}
        >
          {activateMessage.text}
        </p>
      ) : null}
    </div>
  );
}
