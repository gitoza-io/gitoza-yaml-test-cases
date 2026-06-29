import { describe, expect, it } from "vitest";
import { markdownToExportHtml } from "./markdownToExportHtml";

describe("markdownToExportHtml fenced code blocks", () => {
  it("renders yaml fence as pre/code with highlighted content", () => {
    const md = [
      "**Minimum that still indexes:**",
      "",
      "```yaml",
      "---",
      "title: My test case",
      "---",
      "```",
    ].join("\n");

    const html = markdownToExportHtml(md);
    expect(html).toContain('<pre class="export-md-pre">');
    expect(html).toContain('class="export-md-pre-code hljs"');
    expect(html).toContain("title");
    expect(html).not.toContain('<hr class="export-md-hr" />');
  });

  it("still renders standalone horizontal rules outside fences", () => {
    const html = markdownToExportHtml("above\n---\nbelow");
    expect(html).toContain('<hr class="export-md-hr" />');
  });
});
