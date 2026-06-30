import { describe, expect, it } from "vitest";
import {
  assertDeletableCasePath,
  assertDeletableFolderPath,
  assertDeletableProjectPath,
} from "./caseDelete";
import { CASES_ROOT } from "./messageTypes";

const PROJECT = `${CASES_ROOT}/my_project`;
const SUITE = `${PROJECT}/auth`;
const CASE = `${SUITE}/login.yaml`;

describe("assertDeletableCasePath", () => {
  it("accepts yaml under cases root", () => {
    expect(assertDeletableCasePath(CASE)).toBe(CASE);
  });

  it("rejects paths outside cases root", () => {
    expect(() => assertDeletableCasePath("other/login.yaml")).toThrow(/under/);
  });

  it("rejects non-yaml files", () => {
    expect(() => assertDeletableCasePath(`${SUITE}/readme.txt`)).toThrow(/YAML/);
  });

  it("rejects archive paths", () => {
    expect(() =>
      assertDeletableCasePath(`${CASES_ROOT}/.archive/p/c.yaml`),
    ).toThrow(/archived/);
  });

  it("rejects path traversal", () => {
    expect(() => assertDeletableCasePath(`${CASES_ROOT}/../secret.yaml`)).toThrow();
  });
});

describe("assertDeletableFolderPath", () => {
  it("accepts suite paths", () => {
    expect(assertDeletableFolderPath(SUITE)).toBe(SUITE);
  });

  it("rejects cases root", () => {
    expect(() => assertDeletableFolderPath(CASES_ROOT)).toThrow(/cases root/);
  });

  it("rejects archive folders", () => {
    expect(() => assertDeletableFolderPath(`${CASES_ROOT}/.archive/p`)).toThrow(
      /archived/,
    );
  });
});

describe("assertDeletableProjectPath", () => {
  it("accepts direct child of cases root", () => {
    expect(assertDeletableProjectPath(PROJECT)).toBe(PROJECT);
  });

  it("rejects nested suite as project", () => {
    expect(() => assertDeletableProjectPath(SUITE)).toThrow(/direct child/);
  });
});
