import { describe, expect, it } from "vitest";
import {
  applyPendingRunResults,
  countResultsFromCases,
  persistedResultForPath,
} from "./applyPendingRunResults";

describe("applyPendingRunResults", () => {
  const detail = {
    run_id: "sprint-1",
    cases: [
      { file_path: "a.yaml", result: "pending", case_id: "a" },
      { file_path: "b.yaml", result: "passed", case_id: "b" },
    ],
  };

  it("returns detail unchanged when pending map is empty", () => {
    expect(applyPendingRunResults(detail, new Map())).toBe(detail);
  });

  it("applies pending results to matching cases", () => {
    const pending = new Map([["a.yaml", "failed"]]);
    const merged = applyPendingRunResults(detail, pending);
    expect(merged.cases[0].result).toBe("failed");
    expect(merged.cases[0].executed_at).toBeTruthy();
    expect(merged.cases[1].result).toBe("passed");
  });

  it("returns null when detail is null", () => {
    expect(applyPendingRunResults(null, new Map([["a.yaml", "passed"]]))).toBeNull();
  });
});

describe("countResultsFromCases", () => {
  it("counts passed, failed, skipped, and pending", () => {
    expect(
      countResultsFromCases([
        { result: "passed" },
        { result: "failed" },
        { result: "skipped" },
        { result: "pending" },
        {},
      ]),
    ).toEqual({ passed: 1, failed: 1, skipped: 1, pending: 2 });
  });
});

describe("persistedResultForPath", () => {
  it("returns persisted result for a case path", () => {
    const detail = { cases: [{ file_path: "x.yaml", result: "skipped" }] };
    expect(persistedResultForPath(detail, "x.yaml")).toBe("skipped");
    expect(persistedResultForPath(detail, "missing.yaml")).toBe("pending");
  });
});
