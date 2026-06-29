import { useCallback, useEffect, useState } from "react";
import { getRepositoryTree } from "../services/api";
import { onCasesUpdated } from "../api/vscodeApi";
import { CASES_ROOT } from "../constants/casePaths";

/**
 * Simplified repository tree for VS Code extension — loads full tree from workspace scan.
 */
export function useLazyRepositoryTree(activeRepoSlug, { archiveMode = false } = {}) {
  const [repositoryTree, setRepositoryTree] = useState([]);
  const [projectsReady, setProjectsReady] = useState(false);
  const [treeStructureLoadingPrefixes, setTreeStructureLoadingPrefixes] = useState(
    () => new Set(),
  );

  const loadData = useCallback(async () => {
    if (!activeRepoSlug || archiveMode) {
      setRepositoryTree([]);
      setProjectsReady(true);
      return;
    }
    setTreeStructureLoadingPrefixes(new Set([CASES_ROOT]));
    try {
      const tree = await getRepositoryTree();
      setRepositoryTree(Array.isArray(tree) ? tree : []);
      setProjectsReady(true);
    } catch {
      setRepositoryTree([]);
      setProjectsReady(true);
    } finally {
      setTreeStructureLoadingPrefixes(new Set());
    }
  }, [activeRepoSlug, archiveMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return onCasesUpdated(() => {
      void loadData();
    });
  }, [loadData]);

  const onFolderExpand = useCallback(() => {}, []);

  return {
    repositoryTree,
    projectsReady,
    treeStructureLoadingPrefixes,
    loadData,
    onFolderExpand,
    loadingPrefixes: null,
    loadedPrefixes: null,
  };
}

export function scheduleIdleTask(fn) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fn);
  } else {
    setTimeout(fn, 0);
  }
}
