import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWebSearch } from "../web-search.ts";

const mocks = vi.hoisted(() => ({
  callExaSearch: vi.fn(),
  callTavilySearch: vi.fn(),
}));

vi.mock("../exa.ts", () => ({
  callExaSearch: mocks.callExaSearch,
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
    delete process.env.TAVILY_API_KEY;
  });

  it("throws an error for an empty query", async () => {
    await expect(executeWebSearch("tool-1", { query: "   " })).rejects.toThrow(
      "A query is required",
    );

    expect(mocks.callExaSearch).not.toHaveBeenCalled();
    expect(mocks.callTavilySearch).not.toHaveBeenCalled();
  });

  it("runs Exa only when TAVILY_API_KEY is absent", async () => {
    process.env.EXA_API_KEY = "exa-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa title", "https://exa.example", "Exa summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callExaSearch).toHaveBeenCalledWith("typescript", "tool-1");
    expect(mocks.callTavilySearch).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Exa summary");
    expect(textOf(result)).toContain("**Sources:**");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("runs Tavily only when EXA_API_KEY is absent", async () => {
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily title", "https://tavily.example", "Tavily summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(mocks.callTavilySearch).toHaveBeenCalledWith("typescript", "tool-1");
    expect(mocks.callExaSearch).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain(
      "1. [Tavily title](https://tavily.example)",
    );
    expect(textOf(result)).toContain("Tavily summary");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("runs Exa and Tavily in parallel when both API keys are present", async () => {
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
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toMatch(
      /1\. \[Exa title\]\(https:\/\/exa\.example\)[\s\S]*2\. \[Tavily title\]\(https:\/\/tavily\.example\)/,
    );
    expect(result.details).toEqual({
      sourceCount: 2,
      providers: { exa: 1, tavily: 1 },
    });
  });

  it("returns Tavily results when Exa fails", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockRejectedValue(new Error("exa down"));
    mocks.callTavilySearch.mockResolvedValue(
      tavilyResult("Tavily title", "https://tavily.example", "Tavily summary"),
    );

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Tavily summary");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("returns Exa results when Tavily fails", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue(
      exaResult("Exa title", "https://exa.example", "Exa summary"),
    );
    mocks.callTavilySearch.mockResolvedValue(null);

    const result = await executeWebSearch("tool-1", { query: "typescript" });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Exa summary");
    expect(result.details).toEqual({ sourceCount: 1 });
  });

  it("throws an error when both providers fail", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockRejectedValue(new Error("exa down"));
    mocks.callTavilySearch.mockResolvedValue(null);

    await expect(
      executeWebSearch("tool-1", { query: "typescript" }),
    ).rejects.toThrow("Search failed");
  });

  it("throws an error when both providers return no results", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";
    mocks.callExaSearch.mockResolvedValue({ results: [] });
    mocks.callTavilySearch.mockResolvedValue({ results: [] });

    await expect(
      executeWebSearch("tool-1", { query: "typescript" }),
    ).rejects.toThrow("Search failed");
  });

  it("deduplicates URLs preserving the first interleaved occurrence", async () => {
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

    expect(textOf(result)).toContain("Exa wins");
    expect(textOf(result)).not.toContain("Tavily duplicate");
    expect(result.details).toEqual({
      sourceCount: 1,
      providers: { exa: 1, tavily: 1 },
    });
  });
});
