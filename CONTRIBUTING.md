# Contributing

Thanks for your interest in Gitoza — YAML Test Case Manager for VS Code.

## Development setup

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

## Project layout

| Path | Purpose |
|------|---------|
| `src/` | Extension host (TypeScript) — YAML I/O, file scan, message bridge |
| `webview/` | React UI vendored from Gitoza desktop app + VS Code adapter |
| `dist/` | Built extension and webview bundle |

## Packaging

```bash
npm run package
```

This produces a `.vsix` in the project root via `@vscode/vsce`.
