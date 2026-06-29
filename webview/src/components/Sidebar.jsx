import { File, FlaskConical } from "lucide-react";
import Tooltip from "./Tooltip";

function navButtonClassName(isActive) {
  const base =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-listItem transition";
  return isActive
    ? `${base} bg-list-selected dark:bg-slate-700`
    : `${base} hover:bg-list-hover dark:hover:bg-slate-800`;
}

const primaryNavItems = [
  { key: "explorer", label: "Test Repository", icon: File },
  { key: "testrun", label: "Test Run", icon: FlaskConical },
];

function NavIconButtons({ items, activeView, onChangeView }) {
  return items.map((item) => {
    const Icon = item.icon;
    const isActive = activeView === item.key;
    return (
      <Tooltip key={item.key} label={item.label} placement="right">
        <button
          type="button"
          onClick={() => onChangeView(item.key)}
          className={navButtonClassName(isActive)}
          aria-current={isActive ? "page" : undefined}
          aria-label={item.label}
        >
          <Icon
            className={`h-5 w-5 ${isActive ? "text-ink dark:text-slate-100" : "text-muted dark:text-slate-400"}`}
          />
        </button>
      </Tooltip>
    );
  });
}

function Sidebar({ activeView, onChangeView, updateBanner = null }) {
  return (
    <aside className="relative flex h-full w-10 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white py-3 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-6 flex min-h-[2.5rem] items-center justify-center" aria-hidden="true" />

      {updateBanner}

      <nav className="flex flex-col items-center gap-0.5" aria-label="Main navigation">
        <NavIconButtons
          items={primaryNavItems}
          activeView={activeView}
          onChangeView={onChangeView}
        />
      </nav>
    </aside>
  );
}

export default Sidebar;
