import { describe, expect, it } from "vitest";
import {
  formatRunReferenceWarning,
  pathUnderPrefix,
  pathsFromCaseDeletePayload,
} from "./deleteConfirmCopy";

describe("pathsFromCaseDeletePayload", () => {
  it("reads single file_path", () => {
    expect(
      pathsFromCaseDeletePayload({
        file_path: ".gitoza-lite/test/cases/p/c.yaml",
      }),
    ).toEqual([".gitoza-lite/test/cases/p/c.yaml"]);
  });

  it("reads bulk file_paths", () => {
    const paths = [".gitoza-lite/test/cases/p/a.yaml", ".gitoza-lite/test/cases/p/b.yaml"];
    expect(pathsFromCaseDeletePayload({ file_paths: paths })).toEqual(paths);
  });
});

describe("pathUnderPrefix", () => {
  it("matches exact path and descendants", () => {
    const prefix = ".gitoza-lite/test/cases/p";
    expect(pathUnderPrefix(prefix, prefix)).toBe(true);
    expect(pathUnderPrefix(`${prefix}/s/c.yaml`, prefix)).toBe(true);
    expect(pathUnderPrefix(".gitoza-lite/test/cases/other", prefix)).toBe(false);
  });
});

describe("formatRunReferenceWarning", () => {
  it("formats single run warning", () => {
    const text = formatRunReferenceWarning({
      runs: [{ run_id: "smoke", title: "Smoke run" }],
    });
    expect(text).toContain("1 test run");
    expect(text).toContain("Smoke run");
    expect(text).toContain("missing files");
  });

  it("returns empty string when no runs", () => {
    expect(formatRunReferenceWarning({ runs: [] })).toBe("");
  });
});
