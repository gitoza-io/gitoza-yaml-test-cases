# Gitoza — YAML Test Case Manager for VS Code

Manage manual test cases and test runs as YAML in your workspace — create suites, edit cases, and execute manual runs from a three-column Test Repository UI inside [VS Code](https://code.visualstudio.com/).

Cases and runs live under `.gitoza-lite/test/cases/` and `.gitoza-lite/test/run/` as plain files in your repo.

## Screenshots

### Test cases — YAML on disk and UI

Cases are plain YAML files in your repo. Open the Test Repository tab to browse suites and read or edit case details.

| YAML case file | Test Repository UI |
| --- | --- |
| ![Case YAML file](https://raw.githubusercontent.com/gitoza-io/gitoza-yaml-test-cases/main/media/screenshots/case-yaml.png) | ![Test Repository UI](https://raw.githubusercontent.com/gitoza-io/gitoza-yaml-test-cases/main/media/screenshots/test-repository-ui.png) |

### Test runs — YAML on disk and UI

Runs are a single YAML file listing case paths and results. Use the Test Run view to execute a run and mark Pass / Fail / Skip.

| YAML run file | Test Run UI |
| --- | --- |
| ![Run YAML file](https://raw.githubusercontent.com/gitoza-io/gitoza-yaml-test-cases/main/media/screenshots/run-yaml.png) | ![Test Run UI](https://raw.githubusercontent.com/gitoza-io/gitoza-yaml-test-cases/main/media/screenshots/test-run-ui.png) |

## Getting started

**Requirements:** VS Code 1.85+ and an open workspace folder.

1. Open a repository in VS Code.
2. The **Gitoza Test Repository** tab opens in the editor area when the extension activates (when `.gitoza-lite/test/cases/` exists, or after you run the open command below).
3. If the tab was closed, click the **Gitoza** icon in the Activity Bar and choose **Open Test Repository**, or run **Gitoza: Open Test Repository** from the Command Palette.
4. If `.gitoza-lite/test/cases/` does not exist, use **Create first project** to initialize it.
5. Switch to **Test Run** in the sidebar to create runs, add cases from the repository, and mark Pass / Fail / Skip.

VS Code Explorer stays available alongside the editor tab.

**Workspace paths:** This extension uses **`.gitoza-lite/test/cases/`** and **`.gitoza-lite/test/run/`** only. It does not read or modify the Gitoza Desktop paths **`.gitoza/test/cases/`** or **`.gitoza/test/runs/`**. If you already have data under the Desktop paths, copy or move them into the lite paths manually — there is no automatic migration.

## Features

- **Three-column Test Repository UI** — folder tree, case list, and case detail (same layout as the [Gitoza](https://gitoza.com) desktop app)
- **Local-first** — reads and writes YAML on disk in your workspace; no SQLite or shadow clone
- **Git-based** — every case and run is a file you can `git add`, `git diff`, and merge
- **Tests as code** — each case is a `.yaml` file with a Markdown body
- **Create** projects, suites (folders), and test cases
- **Manual save** — click Edit, then Save to write YAML (no auto-save)
- **Editor-tab UI** — Test Repository opens in an editor tab (not the VS Code sidebar)
- **Test Run** — YAML-backed manual runs with Pass / Fail / Skip

## AI & automation-friendly workflow

Because cases are plain YAML in your repo, they work naturally with AI assistants (Cursor, Copilot, ChatGPT, etc.) and automation tooling — no built-in AI or test-runner integration required.

- **Generate cases with AI** — describe a requirement in your editor or chat, generate a `.yaml` case, then open and review it in Gitoza before you commit.
- **Link manual cases to automation** — use `tags` and `params` to reference a Playwright, Selenium, or other test file path or ID (the case filename is the case id).
- **Track automation coverage** — scripts or AI can scan your automation suite and set `automated: true` (and tags) on matching cases.

Example linking a manual case to a Playwright spec:

```yaml
---
title: Login with valid credentials
tags: [smoke, auth, playwright]
automated: true
params:
  playwright: tests/auth/login.spec.ts
---

## Steps
1. Open the login page
2. Enter valid credentials

## Expected result
User is redirected to the dashboard.
```

For full automation pipelines, CI upload, and sync, see the [Gitoza desktop app](https://gitoza.com).

## File formats

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

## About Gitoza

Built by [Gitoza](https://gitoza.com) — a local-first, git-based test management platform where test cases and runs are stored as code in version control.

This extension is **Gitoza Lite** for VS Code: edit cases and run manual tests in the editor. For git sync, review workflows, automation, and the full desktop experience, visit **[gitoza.com](https://gitoza.com)**.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for build, test, and packaging instructions.

## License

MIT — see [LICENSE](LICENSE).
