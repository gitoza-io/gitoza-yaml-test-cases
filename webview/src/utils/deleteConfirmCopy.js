/**
 * Build confirmation description for run-reference warnings before delete.
 *
 * @param {{ runs?: Array<{ run_id: string, title?: string }> }} result
 * @returns {string}
 */
export function formatRunReferenceWarning(result) {
  const runs = result?.runs ?? [];
  if (!runs.length) return "";

  const labels = runs.map((r) => r.title?.trim() || r.run_id);
  const runWord = runs.length === 1 ? "test run" : "test runs";
  const labelText = labels.join(", ");
  return `${runs.length} ${runWord} still reference these cases: ${labelText}. Those entries will point to missing files.`;
}

/**
 * @param {object} payload — from buildCaseActionPayload
 * @returns {string[]}
 */
export function pathsFromCaseDeletePayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.file_paths) && payload.file_paths.length) {
    return payload.file_paths;
  }
  if (payload.file_path) return [payload.file_path];
  return [];
}

/**
 * @param {string | null | undefined} path
 * @param {string} deletedPrefix
 */
export function pathUnderPrefix(path, deletedPrefix) {
  if (!path || !deletedPrefix) return false;
  const norm = path.replace(/\\/g, "/");
  const prefix = deletedPrefix.replace(/\\/g, "/").replace(/\/+$/, "");
  return norm === prefix || norm.startsWith(`${prefix}/`);
}
