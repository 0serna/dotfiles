import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FirecrawlScrapeResponse,
  FirecrawlSearchResponse,
} from "../types.ts";

const mocks = vi.hoisted(() => ({
  logWebToolEvent: vi.fn(),
}));

vi.mock("../logger.ts", () => ({
  logWebToolEvent: mocks.logWebToolEvent,
}));

// We import the module under test after mocks are set up so the logger mock
// is in place when the module initialises.
const firecrawlModule = await import("../firecrawl.ts");

function mockFetchResponse(status: number, json: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(JSON.stringify(json)),
    headers: new Headers(),
  } as Response;
}

describe("callFirecrawlSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FIRECRAWL_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── 1.1 Request body, endpoint, headers ──────────────

  it("sends the correct Search request body with query and limit 2", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-key";
    const fetchStub = vi
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { data: { web: [] } }));
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlSearch("typescript", "tool-1");

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.firecrawl.dev/v2/search");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ query: "typescript", limit: 2 });
  });

  it("sends the correct Scrape request body with url, markdown format, and onlyMainContent", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-key";
    const fetchStub = vi
      .fn()
      .mockResolvedValue(
        mockFetchResponse(200, { data: { markdown: "# Hello" } }),
      );
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlScrape("https://example.com", "tool-1");

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.firecrawl.dev/v2/scrape");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      url: "https://example.com",
      formats: ["markdown"],
      onlyMainContent: true,
    });
  });

  it("includes Authorization bearer header when FIRECRAWL_API_KEY is set", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-secret";
    const fetchStub = vi
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { data: { web: [] } }));
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlSearch("query", "tool-1");

    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer fc-secret" }),
    );
  });

  it("omits Authorization header when FIRECRAWL_API_KEY is not set", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const fetchStub = vi
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { data: { web: [] } }));
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlSearch("query", "tool-1");

    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers as Record<string, string>) ?? {};
    expect(headers.Authorization).toBeUndefined();
  });

  it("aborts after 30-second timeout", async () => {
    const fetchStub = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }
        }),
    );
    vi.stubGlobal("fetch", fetchStub);

    vi.useFakeTimers();
    const promise = firecrawlModule.callFirecrawlSearch("query", "tool-1");
    vi.advanceTimersByTime(30_001);
    const result = await promise;
    vi.useRealTimers();

    expect(result).toBeNull();
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_search_failure",
      expect.objectContaining({
        query: "query",
        error: expect.objectContaining({ name: "AbortError" }),
      }),
    );
  });

  // ── 1.2 Result mapping ───────────────────────────────

  it("maps Firecrawl data.web entries to SearchResponse", async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      mockFetchResponse(200, {
        data: {
          web: [
            { title: "T1", url: "https://a.com", description: "desc" },
            { title: "T2", url: "https://b.com", markdown: "md" },
          ],
        },
      } satisfies FirecrawlSearchResponse),
    );
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlSearch("q", "tool-1");

    expect(result).toEqual({
      data: {
        web: [
          { title: "T1", url: "https://a.com", description: "desc" },
          { title: "T2", url: "https://b.com", markdown: "md" },
        ],
      },
    });
  });

  it("extracts non-empty scrape data.markdown", async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      mockFetchResponse(200, {
        data: { markdown: "# Hello World" },
      } satisfies FirecrawlScrapeResponse),
    );
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlScrape(
      "https://x.com",
      "tool-1",
    );

    expect(result).toBe("# Hello World");
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_scrape_success",
      expect.objectContaining({ contentLength: 13 }),
    );
  });

  it("returns null for empty scrape markdown", async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      mockFetchResponse(200, {
        data: { markdown: "" },
      } satisfies FirecrawlScrapeResponse),
    );
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlScrape(
      "https://x.com",
      "tool-1",
    );

    expect(result).toBeNull();
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_scrape_failure",
      expect.objectContaining({ reason: "empty_content" }),
    );
  });

  it("returns null for whitespace-only scrape markdown", async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      mockFetchResponse(200, {
        data: { markdown: "   " },
      }),
    );
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlScrape(
      "https://x.com",
      "tool-1",
    );

    expect(result).toBeNull();
  });

  // ── 1.3 Error handling ───────────────────────────────

  it("returns null on non-2xx response for search", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(mockFetchResponse(500, { error: "internal" }));
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlSearch("q", "tool-1");
    expect(result).toBeNull();
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_search_failure",
      expect.objectContaining({ query: "q" }),
    );
  });

  it("returns null on 429 rate limit for scrape", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(mockFetchResponse(429, { error: "rate limited" }));
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlScrape(
      "https://x.com",
      "tool-1",
    );
    expect(result).toBeNull();
    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_scrape_failure",
      expect.objectContaining({ url: "https://x.com" }),
    );
  });

  it("returns null on malformed JSON response", async () => {
    const badResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.reject(new SyntaxError("bad json")),
      text: () => Promise.resolve("not json"),
      headers: new Headers(),
    } as Response;
    const fetchStub = vi.fn().mockResolvedValue(badResponse);
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlSearch("q", "tool-1");
    expect(result).toBeNull();
  });

  it("returns null on fetch rejection (network error)", async () => {
    const fetchStub = vi
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchStub);

    const result = await firecrawlModule.callFirecrawlSearch("q", "tool-1");
    expect(result).toBeNull();
  });

  it("logs success event with query, result count, and elapsed time", async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      mockFetchResponse(200, {
        data: {
          web: [
            { title: "A", url: "https://a.com" },
            { title: "B", url: "https://b.com" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlSearch("q", "tool-1");

    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_search_success",
      expect.objectContaining({
        query: "q",
        results: 2,
        elapsedMs: expect.any(Number) as number,
      }),
    );
  });

  it("logs scrape success event with url, content length, and elapsed time", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(
        mockFetchResponse(200, { data: { markdown: "content" } }),
      );
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlScrape("https://ex.com", "tool-1");

    expect(mocks.logWebToolEvent).toHaveBeenCalledWith(
      "firecrawl_scrape_success",
      expect.objectContaining({
        url: "https://ex.com",
        contentLength: 7,
        elapsedMs: expect.any(Number) as number,
      }),
    );
  });

  it("never includes the API key in logged search events", async () => {
    process.env.FIRECRAWL_API_KEY = "secret-key-123";
    const fetchStub = vi
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { data: { web: [] } }));
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlSearch("q", "tool-1");

    const callArgs = mocks.logWebToolEvent.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    const logPayload = JSON.stringify(callArgs[1]);
    expect(logPayload).not.toContain("secret-key-123");
    expect(logPayload).not.toContain("FIRECRAWL_API_KEY");
  });

  it("never includes the API key in logged scrape events", async () => {
    process.env.FIRECRAWL_API_KEY = "secret-key-456";
    const fetchStub = vi
      .fn()
      .mockResolvedValue(
        mockFetchResponse(200, { data: { markdown: "# OK" } }),
      );
    vi.stubGlobal("fetch", fetchStub);

    await firecrawlModule.callFirecrawlScrape("https://ex.com", "tool-1");

    const callArgs = mocks.logWebToolEvent.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    const logPayload = JSON.stringify(callArgs[1]);
    expect(logPayload).not.toContain("secret-key-456");
    expect(logPayload).not.toContain("FIRECRAWL_API_KEY");
  });
});
