import { parse, stringify } from "yaml";
import type { RunCaseResult, RunYamlCase } from "./messageTypes";

const VALID_RESULTS = new Set<RunCaseResult>([
  "pending",
  "passed",
  "failed",
  "skipped",
]);

export interface ParsedRunYaml {
  title?: string;
  cases: RunYamlCase[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function parseResult(value: unknown): RunCaseResult {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (VALID_RESULTS.has(s as RunCaseResult)) {
    return s as RunCaseResult;
  }
  return "pending";
}

function parseCases(value: unknown): RunYamlCase[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const cases: RunYamlCase[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const path = normalizePath(String(rec.path ?? "").trim());
    if (!path) {
      continue;
    }
    cases.push({ path, result: parseResult(rec.result) });
  }
  return cases;
}

function lowerKeyMap(map: Record<string, unknown>): Record<string, unknown> {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(map)) {
    lower[k.toLowerCase()] = v;
  }
  return lower;
}

function splitFrontMatter(content: string): {
  frontText: string;
  body: string;
} | null {
  const stripped = content.trimStart();
  if (!stripped.startsWith("---")) {
    return null;
  }
  const rest = stripped.slice(3);
  const end = rest.indexOf("\n---");
  if (end >= 0) {
    return {
      frontText: rest.slice(0, end),
      body: rest.slice(end + 4).trimStart(),
    };
  }
  return { frontText: rest, body: "" };
}

export function parseRunYaml(content: string): ParsedRunYaml | null {
  const parts = splitFrontMatter(content);
  if (!parts) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parse(parts.frontText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const lower = lowerKeyMap(parsed as Record<string, unknown>);
  const title =
    lower.title != null ? String(lower.title).trim() || undefined : undefined;

  let cases = parseCases(lower.cases);
  if (!cases.length && parts.body.trim()) {
    try {
      const bodyParsed = parse(parts.body);
      if (bodyParsed && typeof bodyParsed === "object" && !Array.isArray(bodyParsed)) {
        const bodyLower = lowerKeyMap(bodyParsed as Record<string, unknown>);
        cases = parseCases(bodyLower.cases);
      }
    } catch {
      // ignore body parse errors
    }
  }

  return { title, cases };
}

export function parseRunYamlFrontMatterOnly(
  content: string,
): ParsedRunYaml | null {
  const parts = splitFrontMatter(content);
  if (!parts) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parse(parts.frontText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const lower = lowerKeyMap(parsed as Record<string, unknown>);
  const title =
    lower.title != null ? String(lower.title).trim() || undefined : undefined;
  const cases = parseCases(lower.cases);

  return { title, cases };
}

export function serializeRunYaml(detail: {
  title?: string;
  cases: RunYamlCase[];
}): string {
  const fm: Record<string, unknown> = {};
  if (detail.title?.trim()) {
    fm.title = detail.title.trim();
  }

  const yamlHeader = stringify(fm).trimEnd();
  const casesBlock = stringify({
    cases: detail.cases.map((c) => ({
      path: normalizePath(c.path),
      result: c.result,
    })),
  }).trimEnd();

  if (!yamlHeader) {
    return `---\n---\n\n${casesBlock}\n`;
  }
  return `---\n${yamlHeader}\n---\n\n${casesBlock}\n`;
}
