/**
 * Sanitize a name for use in file/folder paths. Matches backend logic:
 * alphanumeric and underscores kept; spaces and hyphen runs collapse to a single `-`.
 * Used for project, suite/folder, and run names.
 *
 * @param {string} name - Raw name (may contain spaces, hyphens, etc.)
 * @param {string} [fallback=''] - Value to return when result is empty (e.g. 'run' for run name)
 * @returns {string} Sanitized name (e.g. "my folder" → "my-folder")
 */
export function sanitizeNameForPath(name, fallback = "") {
  if (name == null || typeof name !== "string") return fallback;
  const s = name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

/**
 * Display form of a sanitized path segment: `-` and `_` → spaces.
 * @param {string} sanitized
 * @returns {string}
 */
export function displayNameFromSanitized(sanitized) {
  return (sanitized || "").replace(/_/g, " ").replace(/-/g, " ");
}
