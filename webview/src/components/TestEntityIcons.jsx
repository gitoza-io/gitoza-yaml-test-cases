import { FlaskConical, File, Workflow } from "lucide-react";

/** Round wrapper: soft tint so circle stays visible on selected row without looking harsh. */
const ROUND_WRAPPER_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50";

const PIPELINE_WRAPPER_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50";

/** Icon size and color inside the round wrapper (Test Run). */
const TEST_RUN_ICON_CLASS =
  "h-4 w-4 text-indigo-500 dark:text-indigo-400";

/** Icon size and color inside the round wrapper (CI pipeline). */
const PIPELINE_ICON_CLASS =
  "h-4 w-4 text-sky-600 dark:text-sky-400";

/** Icon size and color inside the round wrapper (Test Case). */
const TEST_CASE_ICON_CLASS =
  "h-4 w-4 text-emerald-600 dark:text-emerald-400";

/**
 * When className is passed, use it on the inner icon so parent can control color/size (e.g. nav active state).
 */
function iconClass(defaultClass, className) {
  if (className) return `h-4 w-4 ${className}`;
  return defaultClass;
}

/**
 * Icon for "Test Run" (batch of cases). Flask/reagent bottle, common in QA for test runs.
 * Use in Sidebar nav, RunListTree run row, Dashboard/Review empty states, etc.
 */
export function TestRunIcon({ className, ...props }) {
  return (
    <span className={ROUND_WRAPPER_CLASS} aria-hidden>
      <FlaskConical
        className={iconClass(TEST_RUN_ICON_CLASS, className)}
        {...props}
      />
    </span>
  );
}

/**
 * Icon for CI / test automation pipeline (folder of runs).
 */
export function PipelineIcon({ className, ...props }) {
  return (
    <span className={PIPELINE_WRAPPER_CLASS} aria-hidden>
      <Workflow
        className={iconClass(PIPELINE_ICON_CLASS, className)}
        {...props}
      />
    </span>
  );
}

/**
 * Icon for "Test Case" (single case). Simple doc icon in a round circle.
 * Use in RunListTree case row, CaseTree, RunCaseTree, Review case tab, etc.
 */
export function TestCaseIcon({ className, ...props }) {
  return (
    <span className={ROUND_WRAPPER_CLASS} aria-hidden>
      <File
        className={iconClass(TEST_CASE_ICON_CLASS, className)}
        {...props}
      />
    </span>
  );
}

export { TEST_RUN_ICON_CLASS, TEST_CASE_ICON_CLASS, PIPELINE_ICON_CLASS };
