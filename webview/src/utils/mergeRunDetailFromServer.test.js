import { describe, it, expect } from "vitest";
import {
  mergeRunResultsFromBatchResponse,
  mergeSearchCaseIntoRunDetail,
} from "./mergeRunDetailFromServer";

describe("mergeSearchCaseIntoRunDetail", () => {
  const detail = {
    run: { run_id: "run-a", updated_by: "Alice" },
    cases: [],
  };

  const searchRow = {
    run_id: "run-a",
    file_path: ".gitoza/test/cases/auth/login/a.yaml",
    case_id: "TC-1",
    title: "Login",
    result: "failed",
    priority: "high",
    tags: ["smoke"],
  };

  it("appends a normalized case when missing from cache", () => {
    const merged = mergeSearchCaseIntoRunDetail(detail, searchRow);
    expect(merged.cases).toHaveLength(1);
    expect(merged.cases[0]).toMatchObject({
      file_path: searchRow.file_path,
      case_id: "TC-1",
      title: "Login",
      result: "failed",
      priority: "high",
      tags: ["smoke"],
      directory: ".gitoza/test/cases/auth/login",
    });
  });

  it("does not duplicate an existing cached case", () => {
    const withCase = {
      ...detail,
      cases: [
        {
          file_path: searchRow.file_path,
          case_id: "TC-1",
          title: "Cached title",
          result: "pending",
        },
      ],
    };
    const merged = mergeSearchCaseIntoRunDetail(withCase, searchRow);
    expect(merged).toBe(withCase);
    expect(merged.cases).toHaveLength(1);
    expect(merged.cases[0].title).toBe("Cached title");
  });
});

describe("mergeRunResultsFromBatchResponse", () => {
  it("patches result and preserves title from cache", () => {
    const prev = {
      run: { passed: 0, failed: 0, skipped: 0, updated_at: "old" },
      cases: [
        {
          file_path: ".gitoza/test/cases/a/c1.yaml",
          case_id: "C1",
          title: "Real Title",
          result: "pending",
        },
      ],
    };
    const response = {
      status: "ok",
      updated: 1,
      run: {
        passed: 1,
        failed: 0,
        skipped: 0,
        updated_at: "2026-06-09T12:00:00Z",
        updated_by: "Alice",
      },
      cases: [
        {
          file_path: ".gitoza/test/cases/a/c1.yaml",
          result: "passed",
          executed_at: "2026-06-09T12:00:00Z",
          executed_by: "Alice",
        },
      ],
    };

    const merged = mergeRunResultsFromBatchResponse(prev, response);
    expect(merged.cases[0].title).toBe("Real Title");
    expect(merged.cases[0].result).toBe("passed");
    expect(merged.cases[0].executed_by).toBe("Alice");
    expect(merged.run.passed).toBe(1);
    expect(merged.run.updated_by).toBe("Alice");
  });
});
