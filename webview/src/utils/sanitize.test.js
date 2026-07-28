import { describe, expect, it } from "vitest";
import { displayNameFromSanitized, sanitizeNameForPath } from "./sanitize";

describe("sanitizeNameForPath", () => {
  it("collapses spaces to a single hyphen", () => {
    expect(sanitizeNameForPath("system test")).toBe("system-test");
    expect(sanitizeNameForPath("  system   test  ")).toBe("system-test");
  });

  it("collapses mixed spaces and hyphens", () => {
    expect(sanitizeNameForPath("system - test")).toBe("system-test");
    expect(sanitizeNameForPath("system--test")).toBe("system-test");
  });

  it("strips punctuation and preserves underscores", () => {
    expect(sanitizeNameForPath("my.project!")).toBe("myproject");
    expect(sanitizeNameForPath("legacy_name")).toBe("legacy_name");
  });

  it("returns fallback when empty or invalid", () => {
    expect(sanitizeNameForPath("")).toBe("");
    expect(sanitizeNameForPath("   ")).toBe("");
    expect(sanitizeNameForPath("!!!")).toBe("");
    expect(sanitizeNameForPath("!!!", "run")).toBe("run");
    expect(sanitizeNameForPath(null, "run")).toBe("run");
  });

  it("sanitizes rename-style spaced names to hyphenated folder segments", () => {
    expect(sanitizeNameForPath("login suite")).toBe("login-suite");
    expect(sanitizeNameForPath("  Auth Flow  ")).toBe("Auth-Flow");
  });
});

describe("displayNameFromSanitized", () => {
  it("maps hyphens and underscores to spaces", () => {
    expect(displayNameFromSanitized("system-test")).toBe("system test");
    expect(displayNameFromSanitized("login_suite")).toBe("login suite");
    expect(displayNameFromSanitized("a-b_c")).toBe("a b c");
  });
});
