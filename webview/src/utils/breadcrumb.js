import { CASES_ROOT } from "../constants/casePaths";

/** Prefix to strip so breadcrumb starts from project name (e.g. auth > securechange > testnewnew). */
const CASES_PREFIX = `${CASES_ROOT}/`;

/**
 * Converts a case file path into breadcrumb segments from the project name onward.
 * E.g. ".gitoza-lite/test/cases/auth/securechange/testnewnew.yaml" -> ["auth", "securechange", "testnewnew"].
 * @param {string} [filePath]
 * @returns {string[]}
 */
export function filePath2Breadcrumb(filePath) {
  if (!filePath) return [];
  const normalized = filePath.replace(/\\/g, "/").replace(/\.ya?ml$/i, "");
  const withoutPrefix = normalized.startsWith(CASES_PREFIX)
    ? normalized.slice(CASES_PREFIX.length)
    : normalized;
  return withoutPrefix.split("/").filter(Boolean);
}
