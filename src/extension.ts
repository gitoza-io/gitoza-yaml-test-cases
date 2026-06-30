import * as vscode from "vscode";
import { CaseRepository } from "./caseRepository";
import { RunRepository } from "./runRepository";
import { registerLauncherTree } from "./launcherTree";
import { GitozaWebviewPanel } from "./webviewPanel";

let caseRepo: CaseRepository;
let runRepo: RunRepository;

export function activate(context: vscode.ExtensionContext): void {
  caseRepo = new CaseRepository();
  runRepo = new RunRepository(caseRepo);

  const openTestRepository = () => {
    GitozaWebviewPanel.createOrShow(
      context.extensionUri,
      caseRepo,
      runRepo,
    );
  };

  const openCommand = vscode.commands.registerCommand(
    "gitoza.openTestRepository",
    openTestRepository,
  );

  context.subscriptions.push(
    openCommand,
    registerLauncherTree(context, openTestRepository),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      GitozaWebviewPanel.currentPanel?.notifyCasesUpdated();
      GitozaWebviewPanel.currentPanel?.notifyRunsUpdated();
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      void GitozaWebviewPanel.currentPanel?.sendInit();
    }),
  );

  openTestRepository();
}

export function deactivate(): void {
  // panels dispose themselves
}
