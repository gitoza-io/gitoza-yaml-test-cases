import * as vscode from "vscode";

export const LAUNCHER_VIEW_ID = "gitoza.launcher";

class EmptyLauncherTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    return [];
  }
}

export function registerLauncherTree(
  context: vscode.ExtensionContext,
): vscode.TreeView<vscode.TreeItem> {
  const provider = new EmptyLauncherTreeProvider();
  const treeView = vscode.window.createTreeView(LAUNCHER_VIEW_ID, {
    treeDataProvider: provider,
  });
  context.subscriptions.push(treeView);
  return treeView;
}
