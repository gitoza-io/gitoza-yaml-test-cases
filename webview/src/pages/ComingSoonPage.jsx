import { FlaskConical } from "lucide-react";

const COMING_SOON = {
  testrun: {
    title: "Test Run",
    description: "Create and manage test runs with the full Gitoza desktop app.",
    icon: FlaskConical,
  },
};

export default function ComingSoonPage({ viewKey = "testrun" }) {
  const meta = COMING_SOON[viewKey] ?? COMING_SOON.testrun;
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
      <div className="mb-4 rounded-full bg-indigo-50 p-4 dark:bg-indigo-500/10">
        <Icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{meta.title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{meta.description}</p>
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
        Get the full experience at{" "}
        <a
          href="https://gitoza.io"
          className="text-indigo-600 underline dark:text-indigo-400"
          target="_blank"
          rel="noreferrer"
        >
          gitoza.io
        </a>
      </p>
    </div>
  );
}
