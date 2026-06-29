# Gitoza — YAML Test Case Manager for VS Code

Manage manual test cases and test runs stored as YAML in your repo (`.gitoza-lite/test/cases/`). This [VS Code](https://code.visualstudio.com/) extension brings [Gitoza](https://gitoza.io) test management into your editor — create suites, edit cases, and run manual tests without leaving the workspace.

## Features

- **Three-column Test Repository UI** — same layout as Gitoza desktop (folder tree, case list, case detail)
- **Workspace-native** — reads and writes `.gitoza-lite/test/cases/**/*.yaml` and `.gitoza-lite/test/run/*.yaml` with no SQLite or shadow clone
- **Create** projects, suites (folders), and test cases
- **Manual save** — click Edit, then Save to write YAML (no auto-save)
- **Editor-tab UI** — Test Repository opens in an editor tab on activation (not the VS Code sidebar)
- **In-app navigation** — Test Repository and Test Run (YAML-backed runs)

## Requirements

- VS Code 1.85+
- A workspace folder (optionally with an existing `.gitoza-lite/test/cases/` tree)

## Getting started

1. Open a repository in VS Code.
2. The **Gitoza Test Repository** tab opens in the editor area automatically when the extension activates.
3. If the tab was closed, click the **Gitoza** icon in the Activity Bar and choose **Open Test Repository**, or run **Gitoza: Open Test Repository** from the Command Palette.
4. If `.gitoza-lite/test/cases/` does not exist, use **Create first project** to initialize it.
5. Switch to **Test Run** in the sidebar to create runs, add cases from the repository, and mark Pass / Fail / Skip.

VS Code Explorer stays available alongside the editor tab.

The extension uses **`.gitoza-lite/test/cases/`** and **`.gitoza-lite/test/run/`** only. It does not read or modify the Gitoza Desktop paths **`.gitoza/test/cases/`** or **`.gitoza/test/runs/`**. If you already have data under the Desktop paths, copy or move them into the lite paths manually — there is no automatic migration.

### Case file format

Each test case is a YAML file with front matter and a Markdown body. The extension **writes only editable fields** on create/save (`title`, `priority`, `tags`, `status`, `requirement_id`, `assigned_to`, `automated`, `params`, and the Markdown body). Audit and review fields (`updated_at`, `updated_by`, `approve_status`, comments, etc.) are not written; if present in an existing file they are still parsed but not shown in the UI and are removed on the next save.

```yaml
---
title: Login with valid credentials
priority: high
tags: [smoke, auth]
status: active
---

## Steps
1. Open the login page
2. Enter valid credentials

## Expected result
User is redirected to the dashboard.
```

### Test run file format

Each test run is a single YAML file under `.gitoza-lite/test/run/{run-name}.yaml`. The filename is the run id; a human-readable title lives in front matter. Cases reference repository paths; results are stored inline.

```yaml
---
title: Sprint 42 smoke
---
cases:
  - path: .gitoza-lite/test/cases/my_project/suite/login.yaml
    result: pending
  - path: .gitoza-lite/test/cases/my_project/suite/logout.yaml
    result: passed
```

Supported `result` values: `pending`, `passed`, `failed`, `skipped`.

## Development

```bash
# Install dependencies
npm install
cd webview && npm install && cd ..

# Build extension host + webview
npm run build

# Run extension host tests
npm run test:ext

# Launch Extension Development Host (F5 in VS Code)
```

### Project layout

| Path | Purpose |
|------|---------|
| `src/` | Extension host (TypeScript) — YAML I/O, file scan, message bridge |
| `webview/` | React UI vendored from Gitoza desktop app + VS Code adapter |
| `dist/` | Built extension and webview bundle |

## Full Gitoza app

This extension covers the Gitoza Lite workflow in VS Code. For git sync, automation, review workflows, and the full desktop experience, see [gitoza.io](https://gitoza.io).

## License

MIT — see [LICENSE](LICENSE).
