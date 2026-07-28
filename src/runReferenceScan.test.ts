import { describe, expect, it } from "vitest";
import {
  casePathMatchesDeleteTargets,
  findMatchingRunReferences,
  remapPathUnderPrefix,
  remapRunCasePaths,
} from "./runReferenceScan";

const CASE_A = ".gitoza-lite/test/cases/p/s/login.yaml";
const CASE_B = ".gitoza-lite/test/cases/p/s/logout.yaml";
const SUITE = ".gitoza-lite/test/cases/p/s";
const SUITE_RENAMED = ".gitoza-lite/test/cases/p/system-test";

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

describe("remapPathUnderPrefix", () => {
  it("remaps folder and descendant case paths", () => {
    expect(remapPathUnderPrefix(SUITE, SUITE, SUITE_RENAMED)).toBe(SUITE_RENAMED);
    expect(remapPathUnderPrefix(CASE_A, SUITE, SUITE_RENAMED)).toBe(
      `${SUITE_RENAMED}/login.yaml`,
    );
  });

  it("leaves unrelated paths unchanged", () => {
    expect(remapPathUnderPrefix(CASE_A, `${SUITE}/other`, SUITE_RENAMED)).toBe(CASE_A);
  });
});

describe("remapRunCasePaths", () => {
  it("rewrites matching cases and returns null when unchanged", () => {
    const cases = [
      { path: CASE_A, result: "pending" as const },
      { path: ".gitoza-lite/test/cases/p/other/x.yaml", result: "passed" as const },
    ];
    const remapped = remapRunCasePaths(cases, SUITE, SUITE_RENAMED);
    expect(remapped).not.toBeNull();
    expect(remapped?.[0].path).toBe(`${SUITE_RENAMED}/login.yaml`);
    expect(remapped?.[1].path).toBe(cases[1].path);
    expect(remapRunCasePaths(cases, `${SUITE}/missing`, SUITE_RENAMED)).toBeNull();
  });
});
