import { describe, expect, it } from "vitest";
import {
  casePathMatchesDeleteTargets,
  findMatchingRunReferences,
} from "./runReferenceScan";

const CASE_A = ".gitoza-lite/test/cases/p/s/login.yaml";
const CASE_B = ".gitoza-lite/test/cases/p/s/logout.yaml";
const SUITE = ".gitoza-lite/test/cases/p/s";

describe("casePathMatchesDeleteTargets", () => {
  it("matches exact case path", () => {
    expect(casePathMatchesDeleteTargets(CASE_A, [CASE_A])).toBe(true);
  });

  it("matches case under folder prefix", () => {
    expect(casePathMatchesDeleteTargets(CASE_A, [SUITE])).toBe(true);
  });

  it("does not match unrelated case", () => {
    expect(casePathMatchesDeleteTargets(CASE_B, [CASE_A])).toBe(false);
  });
});

describe("findMatchingRunReferences", () => {
  it("returns runs referencing deleted case paths", () => {
    const runs = [
      {
        run_id: "smoke",
        title: "Smoke",
        cases: [{ path: CASE_A, result: "pending" as const }],
      },
      {
        run_id: "other",
        title: "Other",
        cases: [{ path: CASE_B, result: "passed" as const }],
      },
    ];
    const matches = findMatchingRunReferences(runs, [CASE_A]);
    expect(matches).toHaveLength(1);
    expect(matches[0].run_id).toBe("smoke");
    expect(matches[0].matching_paths).toEqual([CASE_A]);
  });

  it("matches cases under deleted folder prefix", () => {
    const runs = [
      {
        run_id: "regression",
        cases: [
          { path: CASE_A, result: "pending" as const },
          { path: CASE_B, result: "pending" as const },
        ],
      },
    ];
    const matches = findMatchingRunReferences(runs, [SUITE]);
    expect(matches).toHaveLength(1);
    expect(matches[0].matching_paths).toHaveLength(2);
  });

  it("returns empty when no runs match", () => {
    expect(findMatchingRunReferences([], [CASE_A])).toEqual([]);
  });
});
