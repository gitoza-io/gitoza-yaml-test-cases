#!/usr/bin/env node
/**
 * Copy UI sources from the Gitoza desktop app frontend into webview/src.
 * Usage: node scripts/vendor-ui.mjs [/path/to/Gitoza/frontend/src]
 *
 * Default source: $GITOZA_FRONTEND_SRC or ~/Gitoza/frontend/src
 */
import { cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const sourceRoot =
  process.argv[2] ??
  process.env.GITOZA_FRONTEND_SRC ??
  resolve(process.env.HOME ?? "", "Gitoza/frontend/src");
const targetRoot = resolve("webview/src");

const dirs = ["components", "utils", "constants", "hooks", "contexts", "copy"];
const files = ["index.css"];

if (!existsSync(sourceRoot)) {
  console.error(`Source not found: ${sourceRoot}`);
  console.error("Pass the Gitoza frontend src path or set GITOZA_FRONTEND_SRC.");
  process.exit(1);
}

for (const dir of dirs) {
  const src = join(sourceRoot, dir);
  if (existsSync(src)) {
    cpSync(src, join(targetRoot, dir), { recursive: true });
    console.log(`Copied ${dir}/`);
  }
}

for (const file of files) {
  const src = join(sourceRoot, file);
  if (existsSync(src)) {
    cpSync(src, join(targetRoot, file));
    console.log(`Copied ${file}`);
  }
}

console.log(
  "Done. Re-apply VS Code-specific patches (api, tauri stubs, CaseEditorPanel manual save).",
);
