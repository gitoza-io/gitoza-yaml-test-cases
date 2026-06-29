export const LAST_ACTIVE_REPO_KEY = "gitoza-last-active-repo";

/**
 * Last workspace the user selected (sidebar switcher). Restored on cold start when still installed.
 */
export function readLastActiveRepoSlug() {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_REPO_KEY);
    const trimmed = raw?.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function writeLastActiveRepoSlug(slug) {
  try {
    if (slug) {
      localStorage.setItem(LAST_ACTIVE_REPO_KEY, slug);
    } else {
      localStorage.removeItem(LAST_ACTIVE_REPO_KEY);
    }
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * Prefer last session workspace if it still exists; else config default or first repo.
 * @param {{ repos?: { slug: string }[], default_slug?: string | null } | null | undefined} reposData
 */
export function resolveInitialRepoSlug(reposData) {
  const repos = Array.isArray(reposData?.repos) ? reposData.repos : [];
  const slugs = new Set(repos.map((r) => r.slug));
  const last = readLastActiveRepoSlug();
  if (last && slugs.has(last)) {
    return last;
  }
  return reposData?.default_slug ?? repos[0]?.slug ?? null;
}
