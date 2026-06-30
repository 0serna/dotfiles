import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWebFetch } from "../web-fetch.ts";

const mocks = vi.hoisted(() => ({
  callExaContents: vi.fn(),
  classifyGitHubUrl: vi.fn(),
  extractViaHttp: vi.fn(),
  logWebToolEvent: vi.fn(),
  tryCloudflareMarkdown: vi.fn(),
  tryGitHubFetch: vi.fn(),
}));

vi.mock("../exa.ts", () => ({
  callExaContents: mocks.callExaContents,
}));

vi.mock("../github.ts", () => ({
  classifyGitHubUrl: mocks.classifyGitHubUrl,
  tryGitHubFetch: mocks.tryGitHubFetch,
}));

vi.mock("../http.ts", () => ({
  extractViaHttp: mocks.extractViaHttp,
}));

vi.mock("../cloudflare.ts", () => ({
  tryCloudflareMarkdown: mocks.tryCloudflareMarkdown,
}));

vi.mock("../logger.ts", () => ({
  logWebToolEvent: mocks.logWebToolEvent,
}));

function textOf(result: Awaited<ReturnType<typeof executeWebFetch>>): string {
  return result.content[0]?.text ?? "";
}

describe("executeWebFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classifyGitHubUrl.mockReturnValue({ type: "unsupported" });
    mocks.tryGitHubFetch.mockResolvedValue(null);
    mocks.extractViaHttp.mockResolvedValue(null);
    mocks.tryCloudflareMarkdown.mockResolvedValue(null);
    mocks.callExaContents.mockResolvedValue(null);
  });

  it("throws an error for invalid URLs", async () => {
    await expect(
      executeWebFetch("tool-1", { url: "file:///tmp/example.txt" }),
    ).rejects.toThrow("Invalid URL");
    await expect(executeWebFetch("tool-1", { url: "" })).rejects.toThrow(
      "Invalid URL",
    );

    expect(mocks.classifyGitHubUrl).not.toHaveBeenCalled();
  });

  it("short-circuits after a successful GitHub fetch", async () => {
    mocks.classifyGitHubUrl.mockReturnValue({
      type: "repository",
      owner: "owner",
      repo: "repo",
    });
    mocks.tryGitHubFetch.mockResolvedValue({
      content: "GitHub content",
      source: "github-api",
    });

    const result = await executeWebFetch("tool-1", {
      url: "https://github.com/owner/repo",
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toBe("GitHub content");
    expect(result.details).toEqual({
      contentLength: "GitHub content".length,
      source: "github-api",
    });
    expect(mocks.tryGitHubFetch).toHaveBeenCalledOnce();
    expect(mocks.extractViaHttp).not.toHaveBeenCalled();
    expect(mocks.tryCloudflareMarkdown).not.toHaveBeenCalled();
    expect(mocks.callExaContents).not.toHaveBeenCalled();
  });

  it("short-circuits after a successful HTTP fetch", async () => {
    mocks.extractViaHttp.mockResolvedValue("HTTP content");

    const result = await executeWebFetch("tool-1", {
      url: "https://example.com/http-success",
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toBe("HTTP content");
    expect(result.details).toEqual({
      contentLength: "HTTP content".length,
      source: "http-fallback",
    });
    expect(mocks.tryGitHubFetch).not.toHaveBeenCalled();
    expect(mocks.extractViaHttp).toHaveBeenCalledOnce();
    expect(mocks.tryCloudflareMarkdown).not.toHaveBeenCalled();
    expect(mocks.callExaContents).not.toHaveBeenCalled();
  });

  it("short-circuits after a successful Cloudflare fetch", async () => {
    mocks.tryCloudflareMarkdown.mockResolvedValue("Cloudflare content");

    const result = await executeWebFetch("tool-1", {
      url: "https://example.com/cloudflare-success",
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toBe("Cloudflare content");
    expect(result.details).toEqual({
      contentLength: "Cloudflare content".length,
      source: "cloudflare",
    });
    expect(mocks.extractViaHttp).toHaveBeenCalledOnce();
    expect(mocks.tryCloudflareMarkdown).toHaveBeenCalledOnce();
    expect(mocks.callExaContents).not.toHaveBeenCalled();
  });

  it("throws a clean error when all tiers fail", async () => {
    await expect(
      executeWebFetch("tool-1", { url: "https://example.com/all-fail" }),
    ).rejects.toThrow(
      "Failed to fetch content: All retrieval tiers failed to provide content",
    );

    expect(mocks.extractViaHttp).toHaveBeenCalledOnce();
    expect(mocks.tryCloudflareMarkdown).toHaveBeenCalledOnce();
    expect(mocks.callExaContents).toHaveBeenCalledOnce();
  });

  it("truncates large content and records a full output path", async () => {
    const content = `${"line\n".repeat(3000)}end`;
    mocks.extractViaHttp.mockResolvedValue(content);

    const result = await executeWebFetch("tool-1", {
      url: "https://example.com/large-content",
    });

    expect(textOf(result)).toContain("[Content truncated:");
    expect(textOf(result)).toContain("Full content saved to:");
    expect(result.details.contentLength).toBe(content.length);
    expect(result.details.truncated).toBe(true);
    expect(result.details.fullOutputPath).toEqual(expect.any(String));
  });

  it("returns cached content without calling tiers again", async () => {
    mocks.extractViaHttp.mockResolvedValue("Cached HTTP content");

    const first = await executeWebFetch("tool-1", {
      url: "https://example.com/cache-hit",
    });

    expect(first.isError).toBeUndefined();
    expect(textOf(first)).toBe("Cached HTTP content");
    expect(mocks.extractViaHttp).toHaveBeenCalledOnce();

    vi.clearAllMocks();

    const second = await executeWebFetch("tool-2", {
      url: "https://example.com/cache-hit",
    });

    expect(second.isError).toBeUndefined();
    expect(textOf(second)).toBe("Cached HTTP content");
    expect(second.details).toEqual({
      contentLength: "Cached HTTP content".length,
      source: "http-fallback",
    });
    expect(mocks.classifyGitHubUrl).not.toHaveBeenCalled();
    expect(mocks.extractViaHttp).not.toHaveBeenCalled();
    expect(mocks.tryCloudflareMarkdown).not.toHaveBeenCalled();
    expect(mocks.callExaContents).not.toHaveBeenCalled();
  });
});
