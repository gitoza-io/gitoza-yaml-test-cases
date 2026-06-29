/** Normalize CRLF and lone CR to LF so marker regexes work on Windows conflict files. */
export function normalizeLineEndings(content) {
  return (content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Parse Git conflict markers and return per-block content pairs.
 * Remote side = content between <<<<<<< and =======.
 * My side = content between ======= and >>>>>>>.
 */
export function parseConflictBlocks(content) {
  const blocks = [];
  const markerStart = /<<<<<<< [^\n]*\n/;
  const markerMid = /\n=======\n/;
  const markerEnd = /\n>>>>>>> [^\n]*/;
  let rest = normalizeLineEndings(content);

  while (rest.length > 0) {
    const startIdx = rest.search(markerStart);
    if (startIdx === -1) break;
    const startMatch = rest.match(markerStart);
    const startLen = startMatch ? startMatch[0].length : 0;
    const afterStart = rest.slice(startIdx + startLen);
    const midIdx = afterStart.search(markerMid);
    if (midIdx === -1) break;
    const midMatch = afterStart.match(markerMid);
    const midLen = midMatch ? midMatch[0].length : 0;
    const remoteContent = afterStart.slice(0, midIdx);
    const afterMid = afterStart.slice(midIdx + midLen);
    const endMatch = afterMid.match(markerEnd);
    if (!endMatch) break;
    const myContent = afterMid.slice(0, endMatch.index);
    rest = afterMid.slice(endMatch.index + endMatch[0].length);
    blocks.push({ remoteContent, myContent });
  }

  return blocks;
}

/**
 * Build resolved file content by replacing each conflict block with selected side.
 * choices: array of "remote" | "my".
 */
export function buildResolvedContent(content, choices) {
  const normalized = normalizeLineEndings(content);
  const blocks = parseConflictBlocks(normalized);
  if (blocks.length === 0) return content || "";

  let result = "";
  let rest = normalized;
  const markerStart = /<<<<<<< [^\n]*\n/;
  const markerMid = /\n=======\n/;
  const markerEnd = /\n>>>>>>> [^\n]*/;

  for (let i = 0; i < blocks.length; i++) {
    const startIdx = rest.search(markerStart);
    if (startIdx === -1) break;
    result += rest.slice(0, startIdx);

    const startMatch = rest.match(markerStart);
    const startLen = startMatch ? startMatch[0].length : 0;
    let afterStart = rest.slice(startIdx + startLen);

    const midIdx = afterStart.search(markerMid);
    const midMatch = afterStart.match(markerMid);
    const midLen = midMatch ? midMatch[0].length : 0;
    afterStart = afterStart.slice(midIdx + midLen);

    const endMatch = afterStart.match(markerEnd);
    if (!endMatch) break;

    const restAfterBlock = afterStart.slice(endMatch.index + endMatch[0].length);
    const chosen = choices[i] === "remote" ? blocks[i].remoteContent : blocks[i].myContent;
    result += chosen;

    if (restAfterBlock.length > 0 && !chosen.endsWith("\n") && !restAfterBlock.startsWith("\n")) {
      result += "\n";
    }
    rest = restAfterBlock;
  }

  result += rest;
  return result;
}

/** @returns {"content"|"modify_delete"|"rename"|"unknown"} */
export function getConflictKind(file) {
  if (file?.conflict_kind) return file.conflict_kind;
  if (parseConflictBlocks(file?.content || "").length > 0) return "content";
  return "unknown";
}

export function contentBlocksForFile(file) {
  return parseConflictBlocks(file?.content || "");
}

const MODIFY_DELETE_ACTIONS = new Set(["keep_mine", "keep_both", "keep_theirs"]);

export function countRenameConflicts(files) {
  return files.filter((f) => getConflictKind(f) === "rename").length;
}

export function countModifyDeleteConflicts(files) {
  return files.filter((f) => getConflictKind(f) === "modify_delete").length;
}

/** @returns {Record<string, object>} */
export function createInitialResolverState(files) {
  const state = {};
  for (const file of files) {
    const path = file.file_path;
    const kind = getConflictKind(file);
    if (kind === "modify_delete") {
      state[path] = { kind: "modify_delete", action: "keep_mine" };
    } else if (kind === "rename") {
      state[path] = {
        kind: "rename",
        chosenPath: file.your_path ?? null,
      };
    } else if (kind === "content") {
      const blocks = contentBlocksForFile(file);
      state[path] = { kind: "content", sectionChoices: blocks.map(() => "my") };
    } else {
      state[path] = { kind: "unknown" };
    }
  }
  return state;
}

export function isFileFullyResolved(file, state) {
  const path = file.file_path;
  const entry = state[path];
  const kind = entry?.kind ?? getConflictKind(file);
  if (kind === "unknown") return false;
  if (kind === "modify_delete") {
    return MODIFY_DELETE_ACTIONS.has(entry?.action);
  }
  if (kind === "rename") {
    return Boolean(entry?.chosenPath);
  }
  if (kind === "content") {
    const blocks = contentBlocksForFile(file);
    const choices = entry?.sectionChoices || [];
    return blocks.length > 0 && blocks.every((_, i) => choices[i] === "my" || choices[i] === "remote");
  }
  return false;
}

export function countResolvedFiles(files, state) {
  return files.filter((f) => isFileFullyResolved(f, state)).length;
}

export function findFirstUnresolvedPath(files, state) {
  const hit = files.find((f) => !isFileFullyResolved(f, state));
  return hit?.file_path ?? null;
}

/** @returns {"all_theirs"|"all_mine"|"has_both"|"mixed"|"default"} */
export function summarizeResolutionChoices(files, state) {
  let mineCount = 0;
  let theirsCount = 0;
  let bothCount = 0;
  for (const file of files) {
    const entry = state[file.file_path];
    if (entry?.kind === "modify_delete") {
      if (entry.action === "keep_mine") mineCount += 1;
      if (entry.action === "keep_theirs") theirsCount += 1;
      if (entry.action === "keep_both") bothCount += 1;
    }
  }
  const total = mineCount + theirsCount + bothCount;
  if (total === 0) return "default";
  if (theirsCount > 0 && mineCount === 0 && bothCount === 0) return "all_theirs";
  if (mineCount > 0 && theirsCount === 0 && bothCount === 0) return "all_mine";
  if (bothCount > 0 && mineCount === 0 && theirsCount === 0) return "has_both";
  if (mineCount > 0 || theirsCount > 0 || bothCount > 0) return "mixed";
  return "default";
}

export function buildResolvedPayload(files, state) {
  return files.map((file) => {
    const path = file.file_path;
    const entry = state[path] || {};
    const kind = entry.kind ?? getConflictKind(file);

    if (kind === "modify_delete") {
      return {
        file_path: path,
        conflict_kind: "modify_delete",
        action: entry.action,
        shared_deleted: Boolean(file.shared_deleted),
        new_path: file.shared_path ?? null,
      };
    }

    if (kind === "rename") {
      const chosenPath = entry.chosenPath;
      const content =
        chosenPath === file.shared_path
          ? file.shared_content ?? file.content ?? ""
          : file.your_content ?? file.content ?? "";
      return {
        file_path: path,
        conflict_kind: "rename",
        action: "pick_path",
        chosen_path: chosenPath,
        content,
        related_paths: file.related_paths || [],
      };
    }

    const blocks = contentBlocksForFile(file);
    const choices = (entry.sectionChoices || []).slice(0, blocks.length);
    const normalized = blocks.map((_, idx) => choices[idx] || "my");
    return {
      file_path: path,
      conflict_kind: "content",
      content: buildResolvedContent(file.content || "", normalized),
    };
  });
}

export function allFilesResolvable(files, state) {
  return files.length > 0 && files.every((f) => {
    const kind = state[f.file_path]?.kind ?? getConflictKind(f);
    return kind !== "unknown" && isFileFullyResolved(f, state);
  });
}

/**
 * Apply a path choice to every rename conflict in state.
 * @param {"your"|"shared"} side
 */
export function applyRenamePathToAll(files, state, side) {
  const next = { ...state };
  for (const file of files) {
    if (getConflictKind(file) !== "rename") continue;
    const path = file.file_path;
    const chosenPath = side === "shared" ? file.shared_path : file.your_path;
    if (!chosenPath) continue;
    next[path] = { kind: "rename", chosenPath };
  }
  return next;
}

/** Apply a modify_delete action to every modify_delete conflict in state. */
export function applyModifyDeleteActionToAll(files, state, action) {
  if (!MODIFY_DELETE_ACTIONS.has(action)) return state;
  const next = { ...state };
  for (const file of files) {
    if (getConflictKind(file) !== "modify_delete") continue;
    next[file.file_path] = { kind: "modify_delete", action };
  }
  return next;
}
