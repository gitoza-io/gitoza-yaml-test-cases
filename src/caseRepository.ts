import * as vscode from "vscode";
import type {
  CreateTestCasePayload,
  RepositoryTreeNode,
  UpdateCasePayload,
  YamlCaseDetail,
  YamlCaseListItem,
  YamlCaseListResponse,
} from "./messageTypes";
import { CASES_ROOT } from "./messageTypes";
import {
  assertUnderCasesRoot,
  displayNameFromSanitized,
  isValidCaseId,
  isValidName,
  joinRepoPath,
  resolveCasesRootUri,
  sanitizeNameForPath,
  toRepoRelativePath,
} from "./workspace";
import {
  assertDeletableCasePath,
  assertDeletableFolderPath,
  assertDeletableProjectPath,
} from "./caseDelete";
import {
  parseCaseYaml,
  parseCaseYamlFrontMatterOnly,
  serializeCaseYaml,
} from "./yamlCaseIO";

const ARCHIVE_SEGMENT = ".archive";

export class CaseRepository {
  async initializeCasesRoot(): Promise<string> {
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    await vscode.workspace.fs.createDirectory(resolved.casesRootUri);
    return CASES_ROOT;
  }

  async getRepositoryTree(): Promise<RepositoryTreeNode[]> {
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      return [];
    }
    try {
      await vscode.workspace.fs.stat(resolved.casesRootUri);
    } catch {
      return [];
    }
    return this.buildTree(resolved.folder, resolved.casesRootUri, CASES_ROOT, true);
  }

  private async buildTree(
    workspaceFolder: vscode.WorkspaceFolder,
    dirUri: vscode.Uri,
    relPath: string,
    isRoot: boolean,
  ): Promise<RepositoryTreeNode[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return [];
    }

    const nodes: RepositoryTreeNode[] = [];

    const dirs = entries
      .filter(([name, type]) => type === vscode.FileType.Directory && name !== ARCHIVE_SEGMENT)
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [name, _type] of dirs) {
      const childRel = joinRepoPath(relPath, name);
      const childUri = vscode.Uri.joinPath(dirUri, name);
      const isProject = isRoot;
      const children = await this.buildTree(
        workspaceFolder,
        childUri,
        childRel,
        false,
      );
      const caseCount = await this.countYamlFiles(childUri);
      const displayName = isProject
        ? displayNameFromSanitized(name.replace(/\.gitoza\.test$/i, ""))
        : displayNameFromSanitized(name);

      nodes.push({
        type: "folder",
        name,
        display_name: displayName,
        directory_path: childRel,
        is_project: isProject,
        case_count: caseCount + children.reduce((s, c) => s + c.case_count, 0),
        children: children.length > 0 ? children : undefined,
      });
    }

    return nodes;
  }

  private async countYamlFiles(dirUri: vscode.Uri): Promise<number> {
    let count = 0;
    const walk = async (uri: vscode.Uri): Promise<void> => {
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(uri);
      } catch {
        return;
      }
      for (const [name, type] of entries) {
        if (name === ARCHIVE_SEGMENT) continue;
        const child = vscode.Uri.joinPath(uri, name);
        if (type === vscode.FileType.File && /\.ya?ml$/i.test(name)) {
          count += 1;
        } else if (type === vscode.FileType.Directory) {
          await walk(child);
        }
      }
    };
    await walk(dirUri);
    return count;
  }

  async listCases(options: {
    directory?: string | null;
    path_prefix?: string | null;
  }): Promise<YamlCaseListResponse> {
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      return { total: 0, items: [] };
    }

    const prefix =
      options.path_prefix?.trim() ||
      options.directory?.trim() ||
      CASES_ROOT;

    assertUnderCasesRoot(prefix);

    const globPattern = joinRepoPath(prefix, "**/*.{yaml,yml}");
    const pattern = new vscode.RelativePattern(resolved.folder, globPattern);
    const files = await vscode.workspace.findFiles(
      pattern,
      `**/${ARCHIVE_SEGMENT}/**`,
      10000,
    );

    const items: YamlCaseListItem[] = [];

    for (const fileUri of files.sort((a, b) =>
      a.fsPath.localeCompare(b.fsPath),
    )) {
      const rel = toRepoRelativePath(resolved.folder, fileUri);
      if (rel.includes(`/${ARCHIVE_SEGMENT}/`)) {
        continue;
      }
      try {
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const content = Buffer.from(bytes).toString("utf8");
        const parsed = parseCaseYamlFrontMatterOnly(content, rel);
        if (!parsed) {
          continue;
        }
        const directory = rel.replace(/\/[^/]+\.ya?ml$/i, "");
        items.push({
          case_id: parsed.case_id,
          title: parsed.title,
          tags: parsed.tags,
          status: parsed.status,
          priority: parsed.priority,
          file_path: rel,
          directory,
          approve_status: parsed.approve_status,
          updated_at: parsed.updated_at,
          updated_by: parsed.updated_by,
          approved_by: parsed.approved_by,
          approved_at: parsed.approved_at,
          requirement_id: parsed.requirement_id,
          assigned_to: parsed.assigned_to,
          automated: parsed.automated,
        });
      } catch {
        // skip unreadable files
      }
    }

    items.sort((a, b) => a.case_id.localeCompare(b.case_id));
    return { total: items.length, items };
  }

  async getCaseDetail(filePath: string): Promise<YamlCaseDetail | null> {
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      return null;
    }
    const norm = filePath.replace(/\\/g, "/");
    assertUnderCasesRoot(norm);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, norm);
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = Buffer.from(bytes).toString("utf8");
    const detail = parseCaseYaml(content, norm);
    if (!detail) {
      return null;
    }
    detail.file_path = norm;
    return detail;
  }

  async createProject(projectName: string): Promise<{ project_path: string }> {
    const name = sanitizeNameForPath(projectName);
    if (!isValidName(name)) {
      throw new Error(
        "Invalid project name. Use only letters, numbers, underscores, and hyphens.",
      );
    }
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    await vscode.workspace.fs.createDirectory(resolved.casesRootUri);
    const projectRel = joinRepoPath(CASES_ROOT, name);
    const projectUri = vscode.Uri.joinPath(resolved.folder.uri, projectRel);
    try {
      await vscode.workspace.fs.stat(projectUri);
      throw new Error(`Project '${name}' already exists.`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already exists")) {
        throw e;
      }
    }
    await vscode.workspace.fs.createDirectory(projectUri);
    return { project_path: projectRel };
  }

  async createFolder(
    parentPath: string,
    folderName: string,
  ): Promise<{ directory_path: string }> {
    const parent = parentPath.trim().replace(/\\/g, "/");
    const name = sanitizeNameForPath(folderName);
    if (!isValidName(name)) {
      throw new Error("Invalid folder name.");
    }
    assertUnderCasesRoot(parent);
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    const parentUri = vscode.Uri.joinPath(resolved.folder.uri, parent);
    try {
      const stat = await vscode.workspace.fs.stat(parentUri);
      if (stat.type !== vscode.FileType.Directory) {
        throw new Error(`Parent folder not found: ${parent}`);
      }
    } catch {
      throw new Error(`Parent folder not found: ${parent}`);
    }
    const childRel = joinRepoPath(parent, name);
    const childUri = vscode.Uri.joinPath(resolved.folder.uri, childRel);
    await vscode.workspace.fs.createDirectory(childUri);
    return { directory_path: childRel };
  }

  async renameFolder(
    folderPath: string,
    newName: string,
  ): Promise<{ old_path: string; new_path: string; name: string }> {
    const oldPath = assertDeletableFolderPath(folderPath);
    const name = sanitizeNameForPath(newName);
    if (!isValidName(name)) {
      throw new Error(
        "Invalid folder name. Use only letters, numbers, underscores, and hyphens.",
      );
    }

    const slash = oldPath.lastIndexOf("/");
    const parent = slash >= 0 ? oldPath.slice(0, slash) : "";
    if (!parent) {
      throw new Error("Cannot rename folder without a parent path");
    }
    const newPath = joinRepoPath(parent, name);
    if (newPath === oldPath) {
      return { old_path: oldPath, new_path: newPath, name };
    }

    assertUnderCasesRoot(newPath);

    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }

    const oldUri = vscode.Uri.joinPath(resolved.folder.uri, oldPath);
    const newUri = vscode.Uri.joinPath(resolved.folder.uri, newPath);

    try {
      const stat = await vscode.workspace.fs.stat(oldUri);
      if (stat.type !== vscode.FileType.Directory) {
        throw new Error(`Folder not found: ${oldPath}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Folder not found")) {
        throw e;
      }
      throw new Error(`Folder not found: ${oldPath}`);
    }

    try {
      await vscode.workspace.fs.stat(newUri);
      throw new Error(`Folder '${name}' already exists.`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already exists")) {
        throw e;
      }
    }

    await vscode.workspace.fs.rename(oldUri, newUri);
    return { old_path: oldPath, new_path: newPath, name };
  }

  async createCase(
    payload: CreateTestCasePayload,
  ): Promise<{ file_path: string; case_id: string }> {
    const caseId = payload.case_id.trim();
    if (!isValidCaseId(caseId)) {
      throw new Error(
        "Invalid case_id. Use letters, numbers, underscores, and hyphens.",
      );
    }
    const directory = payload.directory.trim().replace(/\\/g, "/");
    assertUnderCasesRoot(directory);

    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }

    let targetDir = directory;
    if (payload.target_folder?.trim()) {
      const tf = payload.target_folder.trim().replace(/\\/g, "/");
      if (!tf.startsWith(directory)) {
        throw new Error("Target folder must be inside the provided directory.");
      }
      targetDir = tf;
    }

    const targetUri = vscode.Uri.joinPath(resolved.folder.uri, targetDir);
    await vscode.workspace.fs.createDirectory(targetUri);

    const fileRel = joinRepoPath(targetDir, `${caseId}.yaml`);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, fileRel);

    try {
      await vscode.workspace.fs.stat(fileUri);
      throw new Error(`Case '${caseId}' already exists in this location.`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already exists")) {
        throw e;
      }
    }

    const detail: YamlCaseDetail = {
      case_id: caseId,
      title: payload.title?.trim() || caseId,
      tags: payload.tags ?? [],
      status: "active",
      priority: payload.priority?.trim().toLowerCase() || "medium",
      file_path: fileRel,
      body: payload.body?.trim() || "",
      automated: Boolean(payload.automated),
      params: payload.params ?? {},
      requirement_id: payload.requirement_id?.trim() || undefined,
      assigned_to: payload.assigned_to?.trim() || undefined,
    };

    const content = serializeCaseYaml(detail);
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from(content, "utf8"),
    );

    return { file_path: fileRel, case_id: caseId };
  }

  async updateCase(
    filePath: string,
    payload: UpdateCasePayload,
  ): Promise<{ file_path: string }> {
    const norm = filePath.replace(/\\/g, "/");
    assertUnderCasesRoot(norm);
    const existing = await this.getCaseDetail(norm);
    if (!existing) {
      throw new Error(`Case not found: ${norm}`);
    }

    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }

    const merged: YamlCaseDetail = {
      case_id: existing.case_id,
      file_path: existing.file_path,
      title: payload.title !== undefined ? payload.title : existing.title,
      priority:
        payload.priority !== undefined ? payload.priority : existing.priority,
      tags: payload.tags !== undefined ? payload.tags : existing.tags,
      body: payload.body !== undefined ? payload.body : existing.body,
      status: payload.status !== undefined ? payload.status : existing.status,
      requirement_id:
        payload.requirement_id !== undefined
          ? payload.requirement_id
          : existing.requirement_id,
      assigned_to:
        payload.assigned_to !== undefined
          ? payload.assigned_to
          : existing.assigned_to,
      automated:
        payload.automated !== undefined
          ? payload.automated
          : existing.automated,
      params:
        payload.params !== undefined ? payload.params : existing.params,
    };

    const content = serializeCaseYaml(merged);
    const fileUri = vscode.Uri.joinPath(resolved.folder.uri, norm);
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from(content, "utf8"),
    );

    return { file_path: norm };
  }

  async deleteCase(filePaths: string[]): Promise<{ deleted: string[] }> {
    if (!filePaths.length) {
      throw new Error("No case paths provided");
    }
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }

    const deleted: string[] = [];
    for (const raw of filePaths) {
      const norm = assertDeletableCasePath(raw);
      const fileUri = vscode.Uri.joinPath(resolved.folder.uri, norm);
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        throw new Error(`Case not found: ${norm}`);
      }
      await vscode.workspace.fs.delete(fileUri);
      deleted.push(norm);
    }
    return { deleted };
  }

  async deleteFolder(folderPath: string): Promise<{ folder_path: string }> {
    const norm = assertDeletableFolderPath(folderPath);
    const resolved = await resolveCasesRootUri();
    if (!resolved) {
      throw new Error("No workspace folder open");
    }
    const folderUri = vscode.Uri.joinPath(resolved.folder.uri, norm);
    try {
      const stat = await vscode.workspace.fs.stat(folderUri);
      if (stat.type !== vscode.FileType.Directory) {
        throw new Error(`Folder not found: ${norm}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Folder not found")) {
        throw e;
      }
      throw new Error(`Folder not found: ${norm}`);
    }
    await vscode.workspace.fs.delete(folderUri, { recursive: true });
    return { folder_path: norm };
  }

  async deleteProject(projectPath: string): Promise<{ project_path: string }> {
    const norm = assertDeletableProjectPath(projectPath);
    await this.deleteFolder(norm);
    return { project_path: norm };
  }
}
