import { describe, expect, it } from "vitest";
import { applyResultUpdates } from "./runResultUpdates";

describe("applyResultUpdates", () => {
  const cases = [
    { path: "cases/a.yaml", result: "pending" as const },
    { path: "cases/b.yaml", result: "passed" as const },
  ];

  it("applies batch updates by normalized path", () => {
    const updated = applyResultUpdates(cases, [
      { path: "cases/a.yaml", result: "failed" },
      { path: "cases/b.yaml", result: "skipped" },
    ]);
    expect(updated[0].result).toBe("failed");
    expect(updated[1].result).toBe("skipped");
  });

  it("ignores unknown paths", () => {
    const updated = applyResultUpdates(cases, [
      { path: "cases/missing.yaml", result: "passed" },
    ]);
    expect(updated).toEqual(cases);
  });

  it("returns cases unchanged when updates is empty", () => {
    expect(applyResultUpdates(cases, [])).toBe(cases);
  });

  it("normalizes backslashes in paths", () => {
    const updated = applyResultUpdates(cases, [
      { path: "cases\\a.yaml", result: "passed" },
    ]);
    expect(updated[0].result).toBe("passed");
  });
});
