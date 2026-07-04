import { beforeEach, describe, expect, it, vi } from "vitest";
import { retrieve } from "../retrieval.ts";

const mocks = vi.hoisted(() => ({
  classifyGitHubUrl: vi.fn(),
  logWebToolEvent: vi.fn(),
  retrieveWithCloudflareAdapter: vi.fn(),
  retrieveWithExaAdapter: vi.fn(),
  retrieveWithGitHubAdapter: vi.fn(),
  retrieveWithHttpAdapter: vi.fn(),
}));

vi.mock("../exa.ts", () => ({
  retrieveWithExaAdapter: mocks.retrieveWithExaAdapter,
}));

vi.mock("../github.ts", () => ({
  classifyGitHubUrl: mocks.classifyGitHubUrl,
  retrieveWithGitHubAdapter: mocks.retrieveWithGitHubAdapter,
}));

vi.mock("../http.ts", () => ({
  retrieveWithHttpAdapter: mocks.retrieveWithHttpAdapter,
}));

vi.mock("../cloudflare.ts", () => ({
  retrieveWithCloudflareAdapter: mocks.retrieveWithCloudflareAdapter,
}));

vi.mock("../logger.ts", () => ({
  logWebToolEvent: mocks.logWebToolEvent,
}));

describe("retrieve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classifyGitHubUrl.mockReturnValue({ type: "unsupported" });
    mocks.retrieveWithGitHubAdapter.mockResolvedValue(null);
    mocks.retrieveWithHttpAdapter.mockResolvedValue(null);
    mocks.retrieveWithCloudflareAdapter.mockResolvedValue(null);
    mocks.retrieveWithExaAdapter.mockResolvedValue(null);
  });

  it("short-circuits after a successful GitHub fetch", async () => {
    mocks.classifyGitHubUrl.mockReturnValue({
      type: "repository",
      owner: "owner",
      repo: "repo",
    });
    mocks.retrieveWithGitHubAdapter.mockResolvedValue({
      content: "GitHub content",
      source: "github-api",
    });

    await expect(
      retrieve("https://github.com/owner/repo", "tool-1"),
    ).resolves.toEqual({ content: "GitHub content", source: "github-api" });

    expect(mocks.retrieveWithGitHubAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithHttpAdapter).not.toHaveBeenCalled();
    expect(mocks.retrieveWithCloudflareAdapter).not.toHaveBeenCalled();
    expect(mocks.retrieveWithExaAdapter).not.toHaveBeenCalled();
  });

  it("short-circuits after a successful HTTP fetch", async () => {
    mocks.retrieveWithHttpAdapter.mockResolvedValue("HTTP content");

    await expect(
      retrieve("https://example.com/http-success", "tool-1"),
    ).resolves.toEqual({ content: "HTTP content", source: "http-fallback" });

    expect(mocks.retrieveWithGitHubAdapter).not.toHaveBeenCalled();
    expect(mocks.retrieveWithHttpAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithCloudflareAdapter).not.toHaveBeenCalled();
    expect(mocks.retrieveWithExaAdapter).not.toHaveBeenCalled();
  });

  it("short-circuits after a successful Cloudflare fetch", async () => {
    mocks.retrieveWithCloudflareAdapter.mockResolvedValue("Cloudflare content");

    await expect(
      retrieve("https://example.com/cloudflare-success", "tool-1"),
    ).resolves.toEqual({
      content: "Cloudflare content",
      source: "cloudflare",
    });

    expect(mocks.retrieveWithHttpAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithCloudflareAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithExaAdapter).not.toHaveBeenCalled();
  });

  it("tries Exa last", async () => {
    mocks.retrieveWithExaAdapter.mockResolvedValue("Exa content");

    await expect(
      retrieve("https://example.com/exa-success", "tool-1"),
    ).resolves.toEqual({ content: "Exa content", source: "exa" });

    expect(mocks.retrieveWithHttpAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithCloudflareAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithExaAdapter).toHaveBeenCalledOnce();
  });

  it("logs fallback transitions", async () => {
    mocks.classifyGitHubUrl.mockReturnValue({
      type: "repository",
      owner: "owner",
      repo: "repo",
    });
    mocks.retrieveWithExaAdapter.mockResolvedValue("Exa content");

    await retrieve("https://github.com/owner/repo-fallback", "tool-1");

    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "web_fetch_fallback",
      expect.objectContaining({
        from: "github_fetch",
        to: "http_fetch",
      }),
    );
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "web_fetch_fallback",
      expect.objectContaining({
        from: "http_fetch",
        to: "cloudflare_markdown",
      }),
    );
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "web_fetch_fallback",
      expect.objectContaining({
        from: "cloudflare_markdown",
        to: "exa_contents",
      }),
    );
  });

  it("throws when all tiers fail", async () => {
    await expect(
      retrieve("https://example.com/all-fail", "tool-1"),
    ).rejects.toThrow("All retrieval tiers failed to provide content");

    expect(mocks.retrieveWithHttpAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithCloudflareAdapter).toHaveBeenCalledOnce();
    expect(mocks.retrieveWithExaAdapter).toHaveBeenCalledOnce();
  });

  it("returns cached content without calling tiers again", async () => {
    mocks.retrieveWithHttpAdapter.mockResolvedValue("Cached HTTP content");

    await expect(
      retrieve("https://example.com/cache-hit", "tool-1"),
    ).resolves.toEqual({
      content: "Cached HTTP content",
      source: "http-fallback",
    });

    expect(mocks.retrieveWithHttpAdapter).toHaveBeenCalledOnce();
    vi.clearAllMocks();

    await expect(
      retrieve("https://example.com/cache-hit", "tool-2"),
    ).resolves.toEqual({
      content: "Cached HTTP content",
      source: "http-fallback",
    });

    expect(mocks.classifyGitHubUrl).not.toHaveBeenCalled();
    expect(mocks.retrieveWithHttpAdapter).not.toHaveBeenCalled();
    expect(mocks.retrieveWithCloudflareAdapter).not.toHaveBeenCalled();
    expect(mocks.retrieveWithExaAdapter).not.toHaveBeenCalled();
  });
});
