/** Active case repository root (relative to repo root). */
export const CASES_ROOT = ".gitoza-lite/test/cases";

/** Archived cases live under this prefix, mirroring active project/suite structure. */
export const CASES_ARCHIVE_ROOT = ".gitoza-lite/test/cases/.archive";

const CASES_ROOT_PARTS = CASES_ROOT.split("/");

function normalizeRepoPath(path) {
  return (path || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

/** @returns {number} */
export function casesRootPartCount() {
  return CASES_ROOT_PARTS.length;
}

/** @returns {string} */
export function casesRootPrefix() {
  return `${CASES_ROOT}/`;
}

/**
 * Strip the cases root prefix from a path, if present.
 * @param {string} path
 * @returns {string}
 */
export function stripCasesRootPrefix(path) {
  const norm = normalizeRepoPath(path);
  const prefix = casesRootPrefix();
  return norm.startsWith(prefix) ? norm.slice(prefix.length) : path;
}

/** @param {string[]} parts */
export function startsWithCasesRootParts(parts) {
  return CASES_ROOT_PARTS.every((segment, index) => parts[index] === segment);
}

/** @param {string} filePath */
export function isArchivedCasePath(filePath) {
  const fp = normalizeRepoPath(filePath);
  return fp.startsWith(`${CASES_ARCHIVE_ROOT}/`) || fp === CASES_ARCHIVE_ROOT;
}

/** @param {string} directoryPath */
export function isArchivedDirectoryPath(directoryPath) {
  const norm = normalizeRepoPath(directoryPath);
  return norm.startsWith(`${CASES_ARCHIVE_ROOT}/`) || norm === CASES_ARCHIVE_ROOT;
}

/** @param {string} directoryPath */
export function isArchivedProjectDirectoryPath(directoryPath) {
  const norm = normalizeRepoPath(directoryPath);
  const parts = norm.split("/");
  return (
    parts.length === casesRootPartCount() + 2 &&
    startsWithCasesRootParts(parts) &&
    parts[casesRootPartCount()] === ".archive"
  );
}

/** @param {string} directoryPath */
export function isArchivedSuiteDirectoryPath(directoryPath) {
  const norm = normalizeRepoPath(directoryPath);
  const parts = norm.split("/");
  return (
    parts.length >= casesRootPartCount() + 3 &&
    startsWithCasesRootParts(parts) &&
    parts[casesRootPartCount()] === ".archive"
  );
}
