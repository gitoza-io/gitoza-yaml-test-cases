import { describe, expect, it } from "vitest";
import {
  allFilesResolvable,
  applyModifyDeleteActionToAll,
  applyRenamePathToAll,
  buildResolvedContent,
  buildResolvedPayload,
  createInitialResolverState,
  getConflictKind,
  isFileFullyResolved,
  normalizeLineEndings,
  parseConflictBlocks,
  summarizeResolutionChoices,
} from "./conflictResolution";

const LF_CONFLICT = [
  "prefix\n",
  "<<<<<<< HEAD\n",
  "remote line\n",
  "=======\n",
  "my line\n",
  ">>>>>>> branch\n",
  "suffix\n",
].join("");

const CRLF_CONFLICT = [
  "prefix\r\n",
  "<<<<<<< HEAD\r\n",
  "remote line\r\n",
  "=======\r\n",
  "my line\r\n",
  ">>>>>>> branch\r\n",
  "suffix\r\n",
].join("");

const CRLF_MULTI_CONFLICT = [
  "a\r\n",
  "<<<<<<< HEAD\r\n",
  "r1\r\n",
  "=======\r\n",
  "m1\r\n",
  ">>>>>>> b1\r\n",
  "mid\r\n",
  "<<<<<<< HEAD\r\n",
  "r2\r\n",
  "=======\r\n",
  "m2\r\n",
  ">>>>>>> b2\r\n",
  "z\r\n",
].join("");

describe("normalizeLineEndings", () => {
  it("converts CRLF and lone CR to LF", () => {
    expect(normalizeLineEndings("a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("parseConflictBlocks", () => {
  it("parses LF markers (macOS-style)", () => {
    const blocks = parseConflictBlocks(LF_CONFLICT);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].remoteContent).toBe("remote line");
    expect(blocks[0].myContent).toBe("my line");
  });

  it("parses CRLF markers (Windows-style)", () => {
    const blocks = parseConflictBlocks(CRLF_CONFLICT);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].remoteContent).toBe("remote line");
    expect(blocks[0].myContent).toBe("my line");
  });

  it("parses multiple CRLF conflict blocks", () => {
    const blocks = parseConflictBlocks(CRLF_MULTI_CONFLICT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].remoteContent).toBe("r1");
    expect(blocks[0].myContent).toBe("m1");
    expect(blocks[1].remoteContent).toBe("r2");
    expect(blocks[1].myContent).toBe("m2");
  });
});

describe("buildResolvedContent", () => {
  it("removes markers and keeps chosen side for CRLF input", () => {
    const resolved = buildResolvedContent(CRLF_CONFLICT, ["my"]);
    expect(resolved).toBe("prefix\nmy line\nsuffix\n");
    expect(resolved).not.toContain("<<<<<<<");
    expect(resolved).not.toContain("=======");
    expect(resolved).not.toContain(">>>>>>>");
  });

  it("keeps remote side when requested", () => {
    const resolved = buildResolvedContent(CRLF_CONFLICT, ["remote"]);
    expect(resolved).toBe("prefix\nremote line\nsuffix\n");
  });

  it("resolves multiple CRLF blocks", () => {
    const resolved = buildResolvedContent(CRLF_MULTI_CONFLICT, ["remote", "my"]);
    expect(resolved).toBe("a\nr1\nmid\nm2\nz\n");
  });
});

describe("getConflictKind", () => {
  it("prefers API conflict_kind", () => {
    expect(getConflictKind({ conflict_kind: "modify_delete", content: "" })).toBe("modify_delete");
  });

  it("falls back to marker detection", () => {
    expect(getConflictKind({ content: LF_CONFLICT })).toBe("content");
  });

  it("returns unknown when no signal", () => {
    expect(getConflictKind({ content: "plain" })).toBe("unknown");
  });
});

describe("resolver state helpers", () => {
  const contentFile = {
    file_path: "a.yaml",
    conflict_kind: "content",
    content: LF_CONFLICT,
  };

  const deleteFile = {
    file_path: "b.yaml",
    conflict_kind: "modify_delete",
    shared_deleted: true,
    your_content: "mine",
    content: "",
  };

  const moveDeleteFile = {
    file_path: "old/b.yaml",
    conflict_kind: "modify_delete",
    shared_deleted: true,
    shared_path: "new/b.yaml",
    content: "",
  };

  it("createInitialResolverState defaults modify_delete to keep_mine", () => {
    const state = createInitialResolverState([contentFile, deleteFile]);
    expect(state["a.yaml"].kind).toBe("content");
    expect(state["b.yaml"]).toEqual({ kind: "modify_delete", action: "keep_mine" });
  });

  it("isFileFullyResolved accepts tri-state modify_delete actions", () => {
    const state = createInitialResolverState([deleteFile]);
    expect(isFileFullyResolved(deleteFile, state)).toBe(true);
    state["b.yaml"].action = "keep_both";
    expect(isFileFullyResolved(deleteFile, state)).toBe(true);
    state["b.yaml"].action = "keep_theirs";
    expect(isFileFullyResolved(deleteFile, state)).toBe(true);
    state["b.yaml"].action = "bogus";
    expect(isFileFullyResolved(deleteFile, state)).toBe(false);
  });

  it("buildResolvedPayload emits modify_delete tri-state without content", () => {
    const state = createInitialResolverState([deleteFile]);
    state["b.yaml"].action = "keep_theirs";
    const payload = buildResolvedPayload([deleteFile], state);
    expect(payload[0]).toMatchObject({
      file_path: "b.yaml",
      conflict_kind: "modify_delete",
      action: "keep_theirs",
      shared_deleted: true,
      new_path: null,
    });
    expect(payload[0].content).toBeUndefined();
  });

  it("buildResolvedPayload includes companion new_path from shared_path", () => {
    const state = createInitialResolverState([moveDeleteFile]);
    const payload = buildResolvedPayload([moveDeleteFile], state);
    expect(payload[0]).toMatchObject({
      file_path: "old/b.yaml",
      action: "keep_mine",
      new_path: "new/b.yaml",
    });
  });

  it("summarizeResolutionChoices detects mixed tri-state choices", () => {
    const f1 = { ...deleteFile, file_path: "b.yaml" };
    const f2 = { ...deleteFile, file_path: "c.yaml" };
    const state = createInitialResolverState([f1, f2]);
    state["b.yaml"].action = "keep_mine";
    state["c.yaml"].action = "keep_theirs";
    expect(summarizeResolutionChoices([f1, f2], state)).toBe("mixed");
  });

  it("summarizeResolutionChoices detects all_mine", () => {
    const state = createInitialResolverState([deleteFile]);
    expect(summarizeResolutionChoices([deleteFile], state)).toBe("all_mine");
  });

  it("allFilesResolvable requires every file resolved", () => {
    const state = createInitialResolverState([contentFile, deleteFile]);
    expect(allFilesResolvable([contentFile, deleteFile], state)).toBe(true);
  });

  const renameFile = {
    file_path: "your/case.yaml",
    conflict_kind: "rename",
    your_path: "your/case.yaml",
    shared_path: "shared/case.yaml",
    your_content: "same body",
    content: "same body",
  };

  it("createInitialResolverState defaults rename to your_path", () => {
    const state = createInitialResolverState([renameFile]);
    expect(state["your/case.yaml"]).toEqual({
      kind: "rename",
      chosenPath: "your/case.yaml",
    });
    expect(isFileFullyResolved(renameFile, state)).toBe(true);
    expect(allFilesResolvable([renameFile], state)).toBe(true);
  });

  it("buildResolvedPayload uses default your_path for rename", () => {
    const state = createInitialResolverState([renameFile]);
    const payload = buildResolvedPayload([renameFile], state);
    expect(payload[0]).toMatchObject({
      conflict_kind: "rename",
      chosen_path: "your/case.yaml",
      content: "same body",
    });
  });

  it("applyRenamePathToAll sets shared path on all rename files", () => {
    const f2 = { ...renameFile, file_path: "your/b.yaml", your_path: "your/b.yaml", shared_path: "shared/b.yaml" };
    const state = createInitialResolverState([renameFile, f2]);
    const next = applyRenamePathToAll([renameFile, f2], state, "shared");
    expect(next["your/case.yaml"].chosenPath).toBe("shared/case.yaml");
    expect(next["your/b.yaml"].chosenPath).toBe("shared/b.yaml");
  });

  it("applyModifyDeleteActionToAll sets action on all modify_delete files", () => {
    const f1 = { ...deleteFile, file_path: "b.yaml" };
    const f2 = { ...deleteFile, file_path: "c.yaml" };
    const state = createInitialResolverState([f1, f2]);
    const next = applyModifyDeleteActionToAll([f1, f2], state, "keep_both");
    expect(next["b.yaml"].action).toBe("keep_both");
    expect(next["c.yaml"].action).toBe("keep_both");
  });
});
