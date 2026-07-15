import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWebSearch } from "../web-search.ts";

const mocks = vi.hoisted(() => ({
  callExaSearch: vi.fn(),
  callFirecrawlSearch: vi.fn(),
  callTavilySearch: vi.fn(),
}));

vi.mock("../exa.ts", () => ({
  callExaSearch: mocks.callExaSearch,
}));

vi.mock("../firecrawl.ts", () => ({
  callFirecrawlSearch: mocks.callFirecrawlSearch,
}));

vi.mock("../tavily.ts", () => ({
  callTavilySearch: mocks.callTavilySearch,
}));

function exaResult(
  title: string,
  url: string,
  highlight: string,
): { results: Array<{ title: string; url: string; highlights: string[] }> } {
  return { results: [{ title, url, highlights: [highlight] }] };
}

function tavilyResult(
  title: string,
  url: string,
  content: string,
): { results: Array<{ title: string; url: string; content: string }> } {
  return { results: [{ title, url, content }] };
}

function textOf(result: Awaited<ReturnType<typeof executeWebSearch>>): string {
  return result.content[0]?.text ?? "";
}

describe("executeWebSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EXA_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  it("throws an error for an empty query", async () => {
    await expect(executeWebSearch("tool-1", { query: "   " })).rejects.toThrow(
      "A query is required",
    );

    expect(mocks.callExaSearch).not.toHaveBeenCalled();
    expect(mocks.callTavilySearch).not.toHaveBeenCalled();
  });

  it("runs Exa + Firecrawl when TAVILY_API_KEY is absent", async () => {
    process.env.EXA_API_KEY = "exa-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa title", "https://exa.example", "Exa summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).toHaveBeenCalledWith("typescript", "tool-1", 2);
    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(mocks.callTavilySearch).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Exa summary");
    expect(textOf(result)).toContain("Exa title");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("runs Tavily + Firecrawl when EXA_API_KEY is absent", async () => {
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily title", "https://tavily.example", "Tavily summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callTavilySearch).toHaveBeenCalledWith("typescript", "tool-1");
    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(mocks.callExaSearch).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain(
      "1. [Tavily title](https://tavily.example)",
    );
    expect(textOf(result)).toContain("Tavily summary");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("runs Exa, Tavily, and Firecrawl in parallel when both API keys are present", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa title", "https://exa.example", "Exa summary"),
    );
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily title", "https://tavily.example", "Tavily summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).toHaveBeenCalledWith("typescript", "tool-1", 2);
    expect(mocks.callTavilySearch).toHaveBeenCalledWith("typescript", "tool-1");
    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toMatch(
      /1\. \[Exa title\]\(https:\/\/exa\.example\)[\s\S]*2\. \[Tavily title\]\(https:\/\/tavily\.example\)/,
    );
    expect(result.details).toEqual({
      sourceCount: 2,
      providers: { exa: 1, tavily: 1 },
    });
  });

  it("returns Tavily results when Exa fails, with Firecrawl also participating", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockRejectedValue(new Error("exa down"));
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily title", "https://tavily.example", "Tavily summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Tavily summary");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("returns Exa results when Tavily returns null, with Firecrawl also participating", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa title", "https://exa.example", "Exa summary"),
    );
    mocks.callTavilySearch.mockResolvedValue(null);

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Exa summary");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("throws when Exa and Tavily fail while Firecrawl also returns nothing", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockRejectedValue(new Error("exa down"));
    mocks.callTavilySearch.mockResolvedValue(null);

    await expect(
      executeWebSearch("tool-1", { query: "typescript" }),
    ).rejects.toThrow("Search failed");

    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
  });

  it("throws when Exa and Tavily return empty while Firecrawl also returns nothing", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue({ results: [] });
    mocks.callTavilySearch.mockResolvedValue({ results: [] });

    await expect(
      executeWebSearch("tool-1", { query: "typescript" }),
    ).rejects.toThrow("Search failed");

    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
  });

  // ── 3.1 Firecrawl orchestration paths ──────────────────────

  it("runs Firecrawl only when neither Exa nor Tavily keys are set", async () => {
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [{ title: "FC", url: "https://fc.example", description: "desc" }],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).not.toHaveBeenCalled();
    expect(mocks.callTavilySearch).not.toHaveBeenCalled();
    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("1. [FC](https://fc.example)");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("runs Exa and Firecrawl when Tavily key is absent", async () => {
    process.env.EXA_API_KEY = "exa-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa title", "https://exa.example", "Exa summary"),
    );
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [{ title: "FC", url: "https://fc.example", description: "desc" }],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).toHaveBeenCalled();
    expect(mocks.callFirecrawlSearch).toHaveBeenCalled();
    expect(mocks.callTavilySearch).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.details.providers).toEqual({ exa: 1, firecrawl: 1 });
  });

  it("runs Tavily and Firecrawl when Exa key is absent", async () => {
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily", "https://tv.example", "content"),
    );
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [{ title: "FC", url: "https://fc.example", description: "desc" }],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).not.toHaveBeenCalled();
    expect(mocks.callTavilySearch).toHaveBeenCalled();
    expect(mocks.callFirecrawlSearch).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.details.providers).toEqual({ tavily: 1, firecrawl: 1 });
  });

  it("runs all three providers in parallel when all keys are present", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    process.env.FIRECRAWL_API_KEY = "fc-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa", "https://exa.example", "exa-summary"),
    );
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily", "https://tv.example", "tv-summary"),
    );
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [
          { title: "FC", url: "https://fc.example", description: "fc-desc" },
        ],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).toHaveBeenCalledWith("typescript", "tool-1", 2);
    expect(mocks.callTavilySearch).toHaveBeenCalledWith("typescript", "tool-1");
    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(result.isError).toBeUndefined();
    expect(result.details.providers).toEqual({
      exa: 1,
      tavily: 1,
      firecrawl: 1,
    });
  });

  it("runs keyless Firecrawl alongside Exa and Tavily", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa", "https://exa.example", "exa"),
    );
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily", "https://tv.example", "tv"),
    );
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [{ title: "FC", url: "https://fc.example", description: "fc" }],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callFirecrawlSearch).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
  });

  // ── 3.2 Interleaving, dedup, partial/total failures ─────

  it("interleaves three providers in Exa → Tavily → Firecrawl order", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    process.env.FIRECRAWL_API_KEY = "fc-key";
    mocks.callExaSearch.mockResolvedValue({
      results: [
        { title: "E1", url: "https://e1.example", highlights: ["e1"] },
        { title: "E2", url: "https://e2.example", highlights: ["e2"] },
      ],
    });
    mocks.callTavilySearch.mockResolvedValue({
      results: [
        { title: "T1", url: "https://t1.example", content: "t1" },
        { title: "T2", url: "https://t2.example", content: "t2" },
      ],
    });
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [
          { title: "F1", url: "https://f1.example", description: "f1" },
          { title: "F2", url: "https://f2.example", description: "f2" },
        ],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "q" });
    const text = textOf(result);

    const urls: string[] = [];
    for (const match of text.matchAll(/\d+\. \[([^\]]+)\]\(([^)]+)\)/g)) {
      urls.push(match[2]!);
    }
    // Expected order: E1, T1, F1, E2, T2, F2
    expect(urls).toEqual([
      "https://e1.example",
      "https://t1.example",
      "https://f1.example",
      "https://e2.example",
      "https://t2.example",
      "https://f2.example",
    ]);
    expect(result.details.providers).toEqual({
      exa: 2,
      tavily: 2,
      firecrawl: 2,
    });
  });

  it("interleaves with partial provider results", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue({
      results: [
        { title: "E1", url: "https://e1.example", highlights: ["e1"] },
        { title: "E2", url: "https://e2.example", highlights: ["e2"] },
      ],
    });
    mocks.callTavilySearch.mockResolvedValue({
      results: [{ title: "T1", url: "https://t1.example", content: "t1" }],
    });
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [
          { title: "F1", url: "https://f1.example", description: "f1" },
          { title: "F2", url: "https://f2.example", description: "f2" },
        ],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "q" });
    const text = textOf(result);
    const urls: string[] = [];
    for (const match of text.matchAll(/\d+\. \[([^\]]+)\]\(([^)]+)\)/g)) {
      urls.push(match[2]!);
    }
    // E1, T1, F1, E2, F2 (T2 absent)
    expect(urls).toEqual([
      "https://e1.example",
      "https://t1.example",
      "https://f1.example",
      "https://e2.example",
      "https://f2.example",
    ]);
  });

  it("deduplicates overlapping URLs case-insensitively across three providers", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue({
      results: [
        { title: "E", url: "https://SHARED.example", highlights: ["exa"] },
      ],
    });
    mocks.callTavilySearch.mockResolvedValue({
      results: [
        { title: "T", url: "https://shared.example", content: "tavily" },
      ],
    });
    mocks.callFirecrawlSearch.mockResolvedValue({
      data: {
        web: [{ title: "F", url: "https://Shared.Example", description: "fc" }],
      },
    });

    const result = await executeWebSearch("tool-1", { query: "q" });
    const text = textOf(result);

    // Only Exa occurrence kept (first in interleave order)
    expect(text).toContain("exa");
    expect(text).not.toContain("tavily");
    expect(text).not.toContain("fc");
    expect(result.details.sourceCount).toBe(1);
    // Provider counts reflect received before dedup
    expect(result.details.providers).toEqual({
      exa: 1,
      tavily: 1,
      firecrawl: 1,
    });
  });

  it("returns partial results when Firecrawl fails", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa", "https://exa.example", "exa"),
    );
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily", "https://tv.example", "tv"),
    );
    mocks.callFirecrawlSearch.mockResolvedValue(null);

    const result = await executeWebSearch("tool-1", { query: "q" });

    expect(result.isError).toBeUndefined();
    expect(result.details.providers).toEqual({ exa: 1, tavily: 1 });
  });

  it("throws when all three providers return no usable results", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    process.env.FIRECRAWL_API_KEY = "fc-key";
    mocks.callExaSearch.mockRejectedValue(new Error("exa down"));
    mocks.callTavilySearch.mockResolvedValue(null);
    mocks.callFirecrawlSearch.mockResolvedValue(null);

    await expect(executeWebSearch("tool-1", { query: "q" })).rejects.toThrow(
      "Search failed",
    );
  });

  it("deduplicates URLs preserving the first interleaved occurrence, with Firecrawl also participating", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa duplicate", "https://same.example", "Exa wins"),
    );
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult(
        "Tavily duplicate",
        "https://same.example",
        "Tavily duplicate",
      ),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callFirecrawlSearch).toHaveBeenCalledWith(
      "typescript",
      "tool-1",
    );
    expect(textOf(result)).toContain("Exa wins");
    expect(textOf(result)).not.toContain("Tavily duplicate");
    expect(result.details).toEqual({
      sourceCount: 1,
      providers: { exa: 1, tavily: 1 },
    });
  });
});
