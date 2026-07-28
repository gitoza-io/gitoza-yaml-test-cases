# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-07-28

### Added

- **Rename** projects and suites from the Test Repository tree
- Project, suite, and run names can include spaces (shown with spaces; stored safely on disk)

### Fixed

- Creating a project, suite, or run with spaces no longer leaves the sidebar stuck on loading
- Project case-count badges no longer show double the real number
- **Add cases** to a run hides cases already in the run, and hides suites/projects that have nothing left to add

## [0.2.0] - 2026-07-01

### Added

- **Delete** test cases, suites (folders), and projects — with confirmation and warnings when test runs still reference deleted cases
- Test Run **context menu** — rename and delete runs from the folder tree
- README **demo video** — `<video>` walkthrough on the Marketplace listing

### Fixed

- **Test Run case list** — cases under `.gitoza-lite/test/cases/` now appear in the run browser (previously only Desktop `.gitoza/test/cases/` paths were recognized)
- **Run title** — YAML `title` in run front matter displays correctly instead of "Unnamed run"

### Changed

- Test Run UI — unified three-column browse (runs, cases, detail) aligned with Test Repository layout; removed separate run sidebar list
- Activity Bar icon opens or focuses the Gitoza Test Repository editor tab instead of showing a sidebar launcher button
- Export hierarchy reuses shared case-path parsing for `.gitoza-lite` runs

## [0.1.1] - 2026-06-30

### Changed

- Marketplace listing — keyword-focused title and description for test case / QA search
- README — AI-friendly workflow moved up; screenshots stacked full-width for readability

## [0.1.0] - 2026-06-30

### Added

- Test Repository UI — browse projects, suites, and cases in a three-column editor tab
- YAML case create, edit, and manual save under `.gitoza-lite/test/cases/`
- Test Run workflow — create runs, add cases, mark Pass / Fail / Skip
- YAML run files under `.gitoza-lite/test/run/`
- Activity Bar launcher and **Gitoza: Open Test Repository** command
- Pending run-result updates with unsaved-changes prompt before save

[0.2.1]: https://github.com/gitoza-io/gitoza-yaml-test-cases/releases/tag/v0.2.1
[0.2.0]: https://github.com/gitoza-io/gitoza-yaml-test-cases/releases/tag/v0.2.0
[0.1.1]: https://github.com/gitoza-io/gitoza-yaml-test-cases/releases/tag/v0.1.1
[0.1.0]: https://github.com/gitoza-io/gitoza-yaml-test-cases/releases/tag/v0.1.0
