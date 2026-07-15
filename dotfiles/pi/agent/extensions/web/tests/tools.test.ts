import { homedir } from "node:os";
import { describe, expect, it, vi } from "vitest";

import {
  buildCodeArgs,
  buildDocsArgs,
  buildFetchArgs,
  buildSearchArgs,
  createToolDefinitions,
} from "../tools.js";

const signal = new AbortController().signal;

describe("web tool contracts", () => {
  it("normalizes queries and builds federated search arguments", () => {
    expect(buildSearchArgs({ query: "  pi extensions  " })).toEqual([
      "search",
      "pi extensions",
      "--multi",
      "--limit",
      "5",
      "--json",
    ]);
    expect(buildSearchArgs({ query: "topic", limit: 9 })).toContain("9");
    expect(() => buildSearchArgs({ query: "   " })).toThrow("[validation]");
  });

  it("builds fetch arguments without llms.txt substitution", () => {
    expect(buildFetchArgs({ url: "https://example.com" })).toEqual([
      "scrape",
      "https://example.com",
      "--no-llms-txt",
      "--json",
    ]);
  });

  it("builds code arguments with optional language and limits", () => {
    expect(buildCodeArgs({ query: " useThing " })).toEqual([
      "code",
      "useThing",
      "--backend",
      "github",
      "--limit",
      "5",
      "--json",
    ]);
    expect(
      buildCodeArgs({ query: "useThing", language: "TypeScript", limit: 2 }),
    ).toEqual([
      "code",
      "useThing",
      "--backend",
      "github",
      "--lang",
      "TypeScript",
      "--limit",
      "2",
      "--json",
    ]);
    expect(() => buildCodeArgs({ query: "\n" })).toThrow("[validation]");
  });

  it("builds docs arguments with an optional Context7 library", () => {
    expect(buildDocsArgs({ query: " TypeBox schemas " })).toEqual([
      "docs",
      "TypeBox schemas",
      "--json",
    ]);
    expect(
      buildDocsArgs({ query: "hooks", library: "/facebook/react" }),
    ).toEqual(["docs", "hooks", "--library", "/facebook/react", "--json"]);
    expect(buildDocsArgs({ query: "hooks", library: "react" })).toEqual([
      "docs",
      "react hooks",
      "--json",
    ]);
    expect(() => buildDocsArgs({ query: " " })).toThrow("[validation]");
  });

  it("keeps agent-facing metadata implementation-agnostic", () => {
    const definitions = createToolDefinitions({ run: vi.fn() });

    for (const definition of definitions) {
      const metadata = JSON.stringify({
        description: definition.description,
        promptSnippet: definition.promptSnippet,
        promptGuidelines: definition.promptGuidelines,
        parameters: definition.parameters,
      }).toLowerCase();

      for (const internalTerm of ["ketch", "context7", "github", "backend"]) {
        expect(metadata).not.toContain(internalTerm);
      }
    }
  });

  it("executes every surface from HOME with Pi's signal and no timeout", async () => {
    const run = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "{}" }],
      details: {},
    });
    const definitions = createToolDefinitions({ run });

    for (const definition of definitions) {
      const params =
        definition.name === "web_fetch"
          ? { url: "https://example.com" }
          : { query: "query" };
      await definition.execute("call", params as never, signal, undefined, {
        hasUI: false,
      } as never);
    }

    expect(run).toHaveBeenCalledTimes(4);
    for (const call of run.mock.calls) {
      expect(call[1]).toBe(signal);
      expect(call[0]).toMatchObject({ cwd: homedir() });
      expect(call[0]).not.toHaveProperty("timeout");
    }
  });
});
