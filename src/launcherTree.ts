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
  onViewVisible: () => void,
): vscode.TreeView<vscode.TreeItem> {
  const provider = new EmptyLauncherTreeProvider();
  const treeView = vscode.window.createTreeView(LAUNCHER_VIEW_ID, {
    treeDataProvider: provider,
  });
  context.subscriptions.push(
    treeView,
    treeView.onDidChangeVisibility((e) => {
      if (!e.visible) return;
      onViewVisible();
      void vscode.commands.executeCommand("workbench.view.explorer");
    }),
  );
  return treeView;
}
