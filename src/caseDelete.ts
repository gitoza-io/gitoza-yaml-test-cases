import { CASES_ROOT } from "./messageTypes";

const ARCHIVE_SEGMENT = ".archive";

export function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function isUnderArchive(relPath: string): boolean {
  const norm = normalizeRepoPath(relPath);
  return (
    norm.includes(`/${ARCHIVE_SEGMENT}/`) ||
    norm.endsWith(`/${ARCHIVE_SEGMENT}`) ||
    norm === `${CASES_ROOT}/${ARCHIVE_SEGMENT}`
  );
}

export function assertDeletableCasePath(relPath: string): string {
  const norm = normalizeRepoPath(relPath);
  if (!norm.startsWith(`${CASES_ROOT}/`)) {
    throw new Error(`Path must be under ${CASES_ROOT}`);
  }
  if (norm.includes("..")) {
    throw new Error("Invalid path");
  }
  if (!/\.ya?ml$/i.test(norm)) {
    throw new Error("Case path must be a YAML file");
  }
  if (isUnderArchive(norm)) {
    throw new Error("Cannot delete archived cases in this extension");
  }
  return norm;
}

export function assertDeletableFolderPath(relPath: string): string {
  const norm = normalizeRepoPath(relPath);
  if (norm === CASES_ROOT) {
    throw new Error("Cannot delete the cases root folder");
  }
  if (!norm.startsWith(`${CASES_ROOT}/`)) {
    throw new Error(`Path must be under ${CASES_ROOT}`);
  }
  if (norm.includes("..")) {
    throw new Error("Invalid path");
  }
  if (isUnderArchive(norm)) {
    throw new Error("Cannot delete archived folders in this extension");
  }
  return norm;
}

export function assertDeletableProjectPath(relPath: string): string {
  const norm = assertDeletableFolderPath(relPath);
  const parent = norm.slice(0, norm.lastIndexOf("/"));
  if (parent !== CASES_ROOT) {
    throw new Error("Project path must be a direct child of the cases root");
  }
  return norm;
}
