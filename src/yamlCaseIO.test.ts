import { describe, expect, it } from "vitest";
import {
  parseCaseYaml,
  serializeCaseYaml,
  detailToFrontMatter,
} from "./yamlCaseIO";
import type { YamlCaseDetail } from "./messageTypes";

describe("yamlCaseIO", () => {
  it("parses front matter and body", () => {
    const content = `---
title: Welcome to Gitoza
tags:
  - Alpha
  - beta
status: active
priority: medium
---
Hello body
with newlines
`;
    const parsed = parseCaseYaml(content, ".gitoza-lite/test/cases/demo/welcome-001.yaml");
    expect(parsed).not.toBeNull();
    expect(parsed!.case_id).toBe("welcome-001");
    expect(parsed!.title).toBe("Welcome to Gitoza");
    expect(parsed!.tags).toEqual(["Alpha", "beta"]);
    expect(parsed!.body.trim()).toBe("Hello body\nwith newlines");
    expect(parsed!.status).toBe("active");
    expect(parsed!.approve_status).toBe("draft");
  });

  it("defaults status and approve_status when omitted", () => {
    const content = `---
title: Only title
---

Body.
`;
    const parsed = parseCaseYaml(content, "case.yaml");
    expect(parsed!.status).toBe("active");
    expect(parsed!.approve_status).toBe("draft");
  });

  it("allows empty body between separators", () => {
    const content = `---
title: Empty body
---
`;
    const parsed = parseCaseYaml(content, "case.yaml");
    expect(parsed!.body).toBe("");
    const serialized = serializeCaseYaml(parsed!);
    expect(serialized).toContain("---");
    expect(serialized.trimEnd()).toMatch(/---\s*$/m);
  });

  it("round-trips params and automated", () => {
    const detail: YamlCaseDetail = {
      case_id: "TC-1",
      title: "Params test",
      tags: [],
      status: "active",
      priority: "high",
      file_path: ".gitoza-lite/test/cases/p/TC-1.yaml",
      body: "Body text",
      approve_status: "draft",
      automated: true,
      comments: [],
      params: { browser: "chrome", env: "staging" },
    };
    const serialized = serializeCaseYaml(detail);
    const parsed = parseCaseYaml(serialized, detail.file_path);
    expect(parsed!.params).toEqual(detail.params);
    expect(parsed!.automated).toBe(true);
    expect(parsed!.body.trim()).toBe("Body text");
  });

  it("omits automated when false in front matter", () => {
    const detail: YamlCaseDetail = {
      case_id: "TC-2",
      title: "Manual",
      tags: [],
      status: "active",
      priority: "medium",
      file_path: "x.yaml",
      body: "",
      approve_status: "draft",
      automated: false,
      comments: [],
      params: {},
    };
    const fm = detailToFrontMatter(detail);
    expect(fm.automated).toBeUndefined();
  });

  it("parses comma-separated tags string", () => {
    const content = `---
title: Tags
tags: alpha, beta, gamma
---
`;
    const parsed = parseCaseYaml(content, "t.yaml");
    expect(parsed!.tags).toEqual(["alpha", "beta", "gamma"]);
  });

  it("parses audit fields but omits them on serialize", () => {
    const content = `---
title: Legacy audit
updated_at: "2024-01-01T00:00:00Z"
updated_by: alice
approve_status: approved
---
Body.
`;
    const parsed = parseCaseYaml(content, "legacy.yaml");
    expect(parsed!.updated_at).toBe("2024-01-01T00:00:00Z");
    expect(parsed!.updated_by).toBe("alice");
    expect(parsed!.approve_status).toBe("approved");

    const serialized = serializeCaseYaml(parsed!);
    expect(serialized).not.toMatch(/updated_at/);
    expect(serialized).not.toMatch(/updated_by/);
    expect(serialized).not.toMatch(/approve_status/);
    expect(serialized).toContain("title: Legacy audit");
    expect(serialized).toContain("Body.");
  });
});
