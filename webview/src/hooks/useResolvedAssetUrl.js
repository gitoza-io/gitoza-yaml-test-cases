import { useMemo } from "react";

/** VS Code webview: no Tauri asset protocol; return path as-is or null. */
export function useResolvedAssetUrl(src, _repoSlug) {
  return useMemo(() => {
    if (!src || typeof src !== "string") return null;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return src;
    }
    return null;
  }, [src]);
}
