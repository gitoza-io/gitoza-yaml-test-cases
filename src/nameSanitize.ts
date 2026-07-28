/**
 * Sanitize a name for use in file/folder paths.
 * Spaces (and hyphen runs) collapse to a single `-`; other punctuation is stripped.
 * Underscores are preserved for backwards compatibility.
 */
export function sanitizeNameForPath(
  name: string | null | undefined,
  fallback = "",
): string {
  if (name == null || typeof name !== "string") {
    return fallback;
  }
  const s = name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

/** Display form of a sanitized path segment: `-` and `_` → spaces. */
export function displayNameFromSanitized(sanitized: string): string {
  return (sanitized || "").replace(/_/g, " ").replace(/-/g, " ");
}
