import * as vscode from "vscode";
import type { CaseRepository } from "./caseRepository";
import type { RunRepository } from "./runRepository";
import type {
  CreateTestCasePayload,
  HostToWebviewMessage,
  RunCaseResult,
  UpdateCasePayload,
  WebviewRequest,
} from "./messageTypes";
import { CASES_ROOT, RUNS_ROOT } from "./messageTypes";
import { hasCasesRoot, hasRunsRoot, resolveCasesRootUri, resolveRunsRootUri } from "./workspace";

async function handleWebviewRequest(
  caseRepo: CaseRepository,
  runRepo: RunRepository,
  message: WebviewRequest,
): Promise<unknown> {
  switch (message.type) {
    case "ready":
      return buildInitPayload();
    case "getRepositoryTree":
      return caseRepo.getRepositoryTree();
    case "listCases":
      return caseRepo.listCases(
        (message.payload ?? {}) as {
          directory?: string;
          path_prefix?: string;
        },
      );
    case "getCaseDetail":
      return caseRepo.getCaseDetail(String(message.payload?.filePath ?? ""));
    case "createProject":
      return caseRepo.createProject(String(message.payload?.name ?? ""));
    case "createFolder":
      return caseRepo.createFolder(
        String(message.payload?.parentPath ?? ""),
        String(message.payload?.name ?? ""),
      );
    case "createCase":
      return caseRepo.createCase(
        message.payload as unknown as CreateTestCasePayload,
      );
    case "updateCase":
      return caseRepo.updateCase(
        String(message.payload?.filePath ?? ""),
        (message.payload?.payload ?? {}) as UpdateCasePayload,
      );
    case "initializeCasesRoot":
      return { casesRoot: await caseRepo.initializeCasesRoot() };
    case "listRuns":
      return runRepo.listRuns();
    case "getRunDetail":
      return runRepo.getRunDetail(String(message.payload?.runId ?? ""));
    case "createRun":
      return runRepo.createRun(
        String(message.payload?.runId ?? ""),
        message.payload?.title != null
          ? String(message.payload.title)
          : undefined,
      );
    case "updateRunTitle":
      return runRepo.updateRunTitle(
        String(message.payload?.runId ?? ""),
        String(message.payload?.title ?? ""),
      );
    case "addRunCases":
      return runRepo.addRunCases(
        String(message.payload?.runId ?? ""),
        (message.payload?.paths as string[]) ?? [],
      );
    case "removeRunCase":
      return runRepo.removeRunCase(
        String(message.payload?.runId ?? ""),
        String(message.payload?.path ?? ""),
      );
    case "setRunCaseResult":
      return runRepo.setRunCaseResult(
        String(message.payload?.runId ?? ""),
        String(message.payload?.path ?? ""),
        String(message.payload?.result ?? "pending") as RunCaseResult,
      );
    case "deleteRun":
      await runRepo.deleteRun(String(message.payload?.runId ?? ""));
      return { ok: true };
    case "initializeRunsRoot":
      return { runsRoot: await runRepo.initializeRunsRoot() };
    default:
      throw new Error(`Unknown request type: ${message.type}`);
  }
}

async function buildInitPayload() {
  const casesResolved = await resolveCasesRootUri();
  const runsResolved = await resolveRunsRootUri();
  const hasCases = await hasCasesRoot();
  const hasRuns = await hasRunsRoot();
  const theme =
    vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
      ? "dark"
      : "light";
  return {
    type: "init" as const,
    theme,
    casesRoot: casesResolved?.casesRootRel ?? null,
    workspaceName: casesResolved?.folder.name ?? runsResolved?.folder.name ?? null,
    hasCasesRoot: hasCases,
    runsRoot: runsResolved?.runsRootRel ?? null,
    hasRunsRoot: hasRuns,
  };
}

function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  title: string,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "assets", "index.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "assets", "index.css"),
  );
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data: blob:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    #root { height: 100%; }
  </style>
  <link rel="stylesheet" href="${styleUri}">
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

export class GitozaWebviewPanel {
  public static currentPanel: GitozaWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly caseRepo: CaseRepository;
  private readonly runRepo: RunRepository;
  private disposables: vscode.Disposable[] = [];
  private casesWatcher: vscode.FileSystemWatcher | undefined;
  private runsWatcher: vscode.FileSystemWatcher | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    caseRepo: CaseRepository,
    runRepo: RunRepository,
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.caseRepo = caseRepo;
    this.runRepo = runRepo;

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      this.extensionUri,
      "Gitoza Test Repository",
    );
    this.setupMessageHandler(this.panel.webview);
    this.setupWatcher();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    caseRepo: CaseRepository,
    runRepo: RunRepository,
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (GitozaWebviewPanel.currentPanel) {
      GitozaWebviewPanel.currentPanel.panel.reveal(column);
      void GitozaWebviewPanel.currentPanel.sendInit();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "gitozaTestRepository",
      "Gitoza Test Repository",
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    );

    GitozaWebviewPanel.currentPanel = new GitozaWebviewPanel(
      panel,
      extensionUri,
      caseRepo,
      runRepo,
    );
  }

  private setupMessageHandler(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message: WebviewRequest) => {
        if (!message?.requestId || !message?.type) {
          return;
        }
        try {
          const data = await handleWebviewRequest(
            this.caseRepo,
            this.runRepo,
            message,
          );
          this.postMessage({
            type: "response",
            requestId: message.requestId,
            ok: true,
            data,
          });
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
          this.postMessage({
            type: "response",
            requestId: message.requestId,
            ok: false,
            error: errorMsg,
          });
        }
      },
      null,
      this.disposables,
    );
  }

  public async sendInit(): Promise<void> {
    this.postMessage(await buildInitPayload());
  }

  private setupWatcher(): void {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return;
    }
    const casesPattern = new vscode.RelativePattern(
      folder,
      `${CASES_ROOT}/**`,
    );
    this.casesWatcher = vscode.workspace.createFileSystemWatcher(casesPattern);
    const notifyCases = () => {
      this.postMessage({ type: "casesUpdated" });
    };
    this.casesWatcher.onDidCreate(notifyCases, null, this.disposables);
    this.casesWatcher.onDidChange(notifyCases, null, this.disposables);
    this.casesWatcher.onDidDelete(notifyCases, null, this.disposables);

    const runsPattern = new vscode.RelativePattern(
      folder,
      `${RUNS_ROOT}/**`,
    );
    this.runsWatcher = vscode.workspace.createFileSystemWatcher(runsPattern);
    const notifyRuns = () => {
      this.postMessage({ type: "runsUpdated" });
    };
    this.runsWatcher.onDidCreate(notifyRuns, null, this.disposables);
    this.runsWatcher.onDidChange(notifyRuns, null, this.disposables);
    this.runsWatcher.onDidDelete(notifyRuns, null, this.disposables);
  }

  private postMessage(message: HostToWebviewMessage): void {
    void this.panel.webview.postMessage(message);
  }

  public notifyCasesUpdated(): void {
    this.postMessage({ type: "casesUpdated" });
  }

  public notifyRunsUpdated(): void {
    this.postMessage({ type: "runsUpdated" });
  }

  private dispose(): void {
    GitozaWebviewPanel.currentPanel = undefined;
    this.casesWatcher?.dispose();
    this.runsWatcher?.dispose();
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
