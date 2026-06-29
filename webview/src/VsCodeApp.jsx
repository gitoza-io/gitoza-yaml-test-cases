import { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import TestRepositoryPage from "./pages/TestRepositoryPage";
import TestRunPage from "./pages/TestRunPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import { getInitPayload, onInit, ready } from "./api/vscodeApi";

export default function VsCodeApp() {
  const [activeView, setActiveView] = useState("explorer");
  const [hasCasesRoot, setHasCasesRoot] = useState(
    () => getInitPayload()?.hasCasesRoot ?? false,
  );
  const [hasRunsRoot, setHasRunsRoot] = useState(
    () => getInitPayload()?.hasRunsRoot ?? false,
  );
  const [theme, setTheme] = useState(() => getInitPayload()?.theme ?? "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    void ready();
    return onInit((init) => {
      setHasCasesRoot(Boolean(init.hasCasesRoot));
      setHasRunsRoot(Boolean(init.hasRunsRoot));
      setTheme(init.theme === "dark" ? "dark" : "light");
    });
  }, []);

  const handleChangeView = useCallback((view) => {
    setActiveView(view);
  }, []);

  const handleCasesRootInitialized = useCallback(() => {
    setHasCasesRoot(true);
  }, []);

  const handleRunsRootInitialized = useCallback(() => {
    setHasRunsRoot(true);
  }, []);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-white dark:bg-slate-950">
      <Sidebar activeView={activeView} onChangeView={handleChangeView} />
      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {activeView === "explorer" ? (
          <TestRepositoryPage
            hasCasesRoot={hasCasesRoot}
            onCasesRootInitialized={handleCasesRootInitialized}
          />
        ) : activeView === "testrun" ? (
          <TestRunPage
            hasCasesRoot={hasCasesRoot}
            hasRunsRoot={hasRunsRoot}
            onRunsRootInitialized={handleRunsRootInitialized}
          />
        ) : (
          <ComingSoonPage viewKey={activeView} />
        )}
      </main>
    </div>
  );
}
