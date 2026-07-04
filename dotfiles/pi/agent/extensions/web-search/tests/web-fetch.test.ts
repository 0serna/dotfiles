import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWebFetch } from "../web-fetch.ts";

const mocks = vi.hoisted(() => ({
  logWebToolEvent: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("../logger.ts", () => ({
  logWebToolEvent: mocks.logWebToolEvent,
}));

vi.mock("../retrieval.ts", () => ({
  retrieve: mocks.retrieve,
}));

function textOf(result: Awaited<ReturnType<typeof executeWebFetch>>): string {
  return result.content[0]?.text ?? "";
}

describe("executeWebFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieve.mockResolvedValue({
      content: "Fetched content",
      source: "http-fallback",
    });
  });

  it("throws an error for invalid URLs", async () => {
    await expect(
      executeWebFetch("tool-1", { url: "file:///tmp/example.txt" }),
    ).rejects.toThrow("Invalid URL");
    await expect(executeWebFetch("tool-1", { url: "" })).rejects.toThrow(
      "Invalid URL",
    );

    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("returns retrieved content with source details", async () => {
    mocks.retrieve.mockResolvedValue({
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
    expect(mocks.retrieve).toHaveBeenCalledWith(
      "https://github.com/owner/repo",
      "tool-1",
    );
  });

  it("wraps retrieval failures in a clean tool error", async () => {
    mocks.retrieve.mockRejectedValue(
      new Error("All retrieval tiers failed to provide content"),
    );

    await expect(
      executeWebFetch("tool-1", { url: "https://example.com/all-fail" }),
    ).rejects.toThrow(
      "Failed to fetch content: All retrieval tiers failed to provide content",
    );

    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "web_fetch_failure",
      expect.objectContaining({
        toolCallId: "tool-1",
        url: "https://example.com/all-fail",
      }),
    );
  });

  it("truncates large content and records a full output path", async () => {
    const content = `${"line\n".repeat(3000)}end`;
    mocks.retrieve.mockResolvedValue({ content, source: "http-fallback" });

    const result = await executeWebFetch("tool-1", {
      url: "https://example.com/large-content",
    });

    expect(textOf(result)).toContain("[Content truncated:");
    expect(textOf(result)).toContain("Full content saved to:");
    expect(result.details.contentLength).toBe(content.length);
    expect(result.details.truncated).toBe(true);
    expect(result.details.fullOutputPath).toEqual(expect.any(String));
    expect(result.details.source).toBe("http-fallback");
  });
});
