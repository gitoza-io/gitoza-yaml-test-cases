import * as vscode from "vscode";
import type { CaseRepository } from "./caseRepository";
import type {
  RunCaseResult,
  RunCaseRow,
  RunDetail,
  RunListItem,
} from "./messageTypes";
import { RUNS_ROOT } from "./messageTypes";
import {
  assertUnderCasesRoot,
  assertUnderRunsRoot,
  isValidName,
  joinRepoPath,
  resolveRunsRootUri,
} from "./workspace";
import {
  parseRunYaml,
  serializeRunYaml,
} from "./runYamlIO";
import { applyResultUpdates } from "./runResultUpdates";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function caseIdFromPath(filePath: string): string {
  return (
    filePath
      .split("/")
      .pop()
      ?.replace(/\.ya?ml$/i, "") ?? ""
  );
}

function runFileRel(runId: string): string {
  return joinRepoPath(RUNS_ROOT, `${runId}.yaml`);
}

function countByResult(cases: { result: RunCaseResult }[]): Pick<
  RunListItem,
  "passed" | "failed" | "skipped" | "pending"
> {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  for (const c of cases) {
    switch (c.result) {
      case "passed":
        passed += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      default:
        pending += 1;
    }
  }
  return { passed, failed, skipped, pending };
}

export class RunRepository {
  constructor(private readonly caseRepo: CaseRepository) {}

  async initializeRunsRoot(): Promise<string> {
    const resolved = await resolveRunsRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    await vscode.workspace.fs.createDirectory(resolved.runsRootUri);
    return RUNS_ROOT;
  }

  async listRuns(): Promise<RunListItem[]> {
    const resolved = await resolveRunsRootUri();
    if (!resolved) {
      return [];
    }
    try {
      await vscode.workspace.fs.stat(resolved.runsRootUri);
    } catch {
      return [];
    }

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(resolved.runsRootUri);
    } catch {
      return [];
    }

    const items: RunListItem[] = [];
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !/\.ya?ml$/i.test(name)) {
        continue;
      }
      const runId = name.replace(/\.ya?ml$/i, "");
      const fileRel = joinRepoPath(RUNS_ROOT, name);
      try {
        const fileUri = vscode.Uri.joinPath(resolved.folder.uri, fileRel);
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const content = Buffer.from(bytes).toString("utf8");
        const parsed = parseRunYaml(content);
        if (!parsed) {
          continue;
        }
        const counts = countByResult(parsed.cases);
        items.push({
          run_id: runId,
          title: parsed.title,
          file_path: fileRel,
          case_count: parsed.cases.length,
          ...counts,
        });
      } catch {
        // skip unreadable
      }
    }

    items.sort((a, b) => a.run_id.localeCompare(b.run_id));
    return items;
  }

  private async readRunFile(runId: string): Promise<{
    resolved: NonNullable<Awaited<ReturnType<typeof resolveRunsRootUri>>>;
    fileRel: string;
    parsed: NonNullable<ReturnType<typeof parseRunYaml>>;
  }> {
    const id = runId.trim();
    if (!isValidName(id)) {
      throw new Error("Invalid run id.");
    }
    const resolved = await resolveRunsRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    const fileRel = runFileRel(id);
    assertUnderRunsRoot(fileRel);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, fileRel);
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = Buffer.from(bytes).toString("utf8");
    const parsed = parseRunYaml(content);
    if (!parsed) {
      throw new Error(`Invalid run file: ${fileRel}`);
    }
    return { resolved, fileRel, parsed };
  }

  private async writeRunFile(
    resolved: NonNullable<Awaited<ReturnType<typeof resolveRunsRootUri>>>,
    fileRel: string,
    detail: { title?: string; cases: { path: string; result: RunCaseResult }[] },
  ): Promise<void> {
    const content = serializeRunYaml(detail);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, fileRel);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
  }

  async getRunDetail(runId: string): Promise<RunDetail> {
    const { fileRel, parsed } = await this.readRunFile(runId);
    const cases: RunCaseRow[] = [];

    for (const entry of parsed.cases) {
      const path = normalizePath(entry.path);
      let caseId = caseIdFromPath(path);
      let title: string | undefined;
      try {
        assertUnderCasesRoot(path);
        const detail = await this.caseRepo.getCaseDetail(path);
        if (detail) {
          caseId = detail.case_id;
          title = detail.title;
        }
      } catch {
        // missing or invalid case — keep path-derived id
      }
      cases.push({
        path,
        result: entry.result,
        case_id: caseId,
        title,
        file_path: path,
      });
    }

    return {
      run_id: runId.trim(),
      file_path: fileRel,
      title: parsed.title,
      cases,
    };
  }

  async createRun(runId: string, title?: string): Promise<RunDetail> {
    const id = runId.trim();
    if (!isValidName(id)) {
      throw new Error(
        "Invalid run name. Use only letters, numbers, underscores, and hyphens.",
      );
    }
    const resolved = await resolveRunsRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    await vscode.workspace.fs.createDirectory(resolved.runsRootUri);
    const fileRel = runFileRel(id);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, fileRel);
    try {
      await vscode.workspace.fs.stat(fileUri);
      throw new Error(`Run '${id}' already exists.`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already exists")) {
        throw e;
      }
    }
    await this.writeRunFile(resolved, fileRel, {
      title: title?.trim() || id,
      cases: [],
    });
    return this.getRunDetail(id);
  }

  async updateRunTitle(runId: string, title: string): Promise<RunDetail> {
    const { resolved, fileRel, parsed } = await this.readRunFile(runId);
    await this.writeRunFile(resolved, fileRel, {
      title: title.trim() || undefined,
      cases: parsed.cases,
    });
    return this.getRunDetail(runId);
  }

  async addRunCases(runId: string, paths: string[]): Promise<RunDetail> {
    const { resolved, fileRel, parsed } = await this.readRunFile(runId);
    const existing = new Set(parsed.cases.map((c) => normalizePath(c.path)));
    const toAdd: { path: string; result: RunCaseResult }[] = [];

    for (const raw of paths) {
      const path = normalizePath(raw.trim());
      if (!path || existing.has(path)) {
        continue;
      }
      assertUnderCasesRoot(path);
      toAdd.push({ path, result: "pending" });
      existing.add(path);
    }

    await this.writeRunFile(resolved, fileRel, {
      title: parsed.title,
      cases: [...parsed.cases, ...toAdd],
    });
    return this.getRunDetail(runId);
  }

  async removeRunCase(runId: string, path: string): Promise<RunDetail> {
    const { resolved, fileRel, parsed } = await this.readRunFile(runId);
    const norm = normalizePath(path);
    const cases = parsed.cases.filter((c) => normalizePath(c.path) !== norm);
    await this.writeRunFile(resolved, fileRel, {
      title: parsed.title,
      cases,
    });
    return this.getRunDetail(runId);
  }

  async setRunCaseResult(
    runId: string,
    path: string,
    result: RunCaseResult,
  ): Promise<RunDetail> {
    return this.setRunCaseResults(runId, [{ path, result }]);
  }

  async setRunCaseResults(
    runId: string,
    updates: { path: string; result: RunCaseResult }[],
  ): Promise<RunDetail> {
    if (!updates.length) {
      return this.getRunDetail(runId);
    }
    const { resolved, fileRel, parsed } = await this.readRunFile(runId);
    const cases = applyResultUpdates(parsed.cases, updates);
    await this.writeRunFile(resolved, fileRel, {
      title: parsed.title,
      cases,
    });
    return this.getRunDetail(runId);
  }

  async deleteRun(runId: string): Promise<void> {
    const { resolved, fileRel } = await this.readRunFile(runId);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, fileRel);
    await vscode.workspace.fs.delete(fileUri);
  }
}
