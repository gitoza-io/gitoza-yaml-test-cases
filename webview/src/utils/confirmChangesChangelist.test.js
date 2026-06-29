import { describe, expect, it } from "vitest";
import {
  breadcrumbLabelForCasePath,
  buildConfirmChangelistEntries,
  findFirstSelectableEntry,
} from "./confirmChangesChangelist.js";

describe("breadcrumbLabelForCasePath", () => {
  it("formats project suite case breadcrumb", () => {
    expect(
      breadcrumbLabelForCasePath(".gitoza/test/cases/auth/login/login.yaml"),
    ).toBe("auth › login › login");
  });
});

describe("buildConfirmChangelistEntries", () => {
  it("sorts case rows by path and adds section header", () => {
    const entries = buildConfirmChangelistEntries({
      caseChanges: [
        { path: ".gitoza/test/cases/p/b.yaml", status: "M" },
        { path: ".gitoza/test/cases/p/a.yaml", status: "A" },
      ],
    });
    expect(entries[0]).toMatchObject({ kind: "sectionHeader", title: "Cases", count: 2 });
    expect(entries[1].kind).toBe("case");
    expect(entries[1].file_path).toBe(".gitoza/test/cases/p/a.yaml");
    expect(entries[2].file_path).toBe(".gitoza/test/cases/p/b.yaml");
  });

  it("includes runs templates and config sections when present", () => {
    const entries = buildConfirmChangelistEntries({
      runGroups: [
        {
          runDir: ".gitoza/test/runs/sprint_1",
          runId: "sprint_1",
          paths: [".gitoza/test/runs/sprint_1/head.yaml"],
        },
      ],
      templateFiles: [".gitoza/test/templates/t.md"],
      configFiles: [".gitoza/config.json"],
    });
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("sectionHeader");
    expect(kinds).toContain("runGroup");
    expect(kinds).toContain("template");
    expect(kinds).toContain("config");
  });

  it("returns empty for no changes", () => {
    expect(buildConfirmChangelistEntries({})).toEqual([]);
  });
});

describe("findFirstSelectableEntry", () => {
  it("prefers first case row", () => {
    const entries = buildConfirmChangelistEntries({
      caseChanges: [{ path: ".gitoza/test/cases/p/a.yaml", status: "M" }],
      runGroups: [
        {
          runDir: ".gitoza/test/runs/r1",
          runId: "r1",
          paths: [".gitoza/test/runs/r1/head.yaml"],
        },
      ],
    });
    expect(findFirstSelectableEntry(entries)).toEqual({
      selectionKind: "caseFolder",
      selectedFilePath: ".gitoza/test/cases/p/a.yaml",
      selectedRunDir: null,
    });
  });

  it("selects run when no cases", () => {
    const entries = buildConfirmChangelistEntries({
      runGroups: [
        {
          runDir: ".gitoza/test/runs/r1",
          runId: "r1",
          paths: [".gitoza/test/runs/r1/head.yaml"],
        },
      ],
    });
    expect(findFirstSelectableEntry(entries)?.selectionKind).toBe("runGroup");
  });
});
