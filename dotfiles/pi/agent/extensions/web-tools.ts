import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { appendFileSync } from "fs";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_FILE = "/tmp/pi-web-tools.log";

function log(msg: string): void {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_CONTENTS_URL = "https://api.exa.ai/contents";
const EXA_TIMEOUT_MS = 15_000;
const HTTP_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_NUM_RESULTS = 5;

type RecencyFilter = "day" | "week" | "month" | "year";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKeyOrThrow(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new Error(
      "EXA_API_KEY is not set. Set the EXA_API_KEY environment variable with your Exa API key.",
    );
  }
  return key;
}

/** Map a RecencyFilter string to an ISO start date. */
function recencyToStartDate(filter: RecencyFilter): string {
  const now = Date.now();
  const ms = {
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
  }[filter];
  return new Date(now - ms).toISOString().split("T")[0] as string;
}

/** Parse domainFilter strings: "+foo.com" → includeDomains, "-bar.com" → excludeDomains */
// fallow-ignore-next-line complexity
function parseDomainFilter(filter: string[]): {
  includeDomains?: string[];
  excludeDomains?: string[];
} {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const entry of filter) {
    if (entry.startsWith("-")) {
      exclude.push(entry.slice(1));
    } else {
      include.push(entry);
    }
  }
  const result: { includeDomains?: string[]; excludeDomains?: string[] } = {};
  if (include.length > 0) result.includeDomains = include;
  if (exclude.length > 0) result.excludeDomains = exclude;
  return result;
}

// ---------------------------------------------------------------------------
// Exa API Client
// ---------------------------------------------------------------------------

// fallow-ignore-next-line complexity
async function callExaSearch(
  query: string,
  opts: {
    numResults?: number;
    recencyFilter?: RecencyFilter;
    domainFilter?: string[];
  },
): Promise<unknown> {
  const apiKey = getApiKeyOrThrow();

  const body: Record<string, unknown> = {
    query,
    type: "auto",
    numResults: opts.numResults ?? DEFAULT_NUM_RESULTS,
    contents: { highlights: true },
  };

  if (opts.recencyFilter) {
    body.startPublishedDate = recencyToStartDate(opts.recencyFilter);
  }

  if (opts.domainFilter && opts.domainFilter.length > 0) {
    const parsed = parseDomainFilter(opts.domainFilter);
    Object.assign(body, parsed);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);

  try {
    const response = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `Exa API error (${response.status}): ${errorText.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        highlights?: string[];
        text?: string;
      }>;
    };
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      log(`exa_search timeout query="${query}"`);
      throw new Error("Exa API request timed out", { cause: err });
    }
    const msg = err instanceof Error ? err.message : String(err);
    log(`exa_search error query="${query}" msg="${msg}"`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// fallow-ignore-next-line complexity
async function callExaContents(url: string): Promise<string | null> {
  const apiKey = getApiKeyOrThrow();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);

  try {
    const response = await fetch(EXA_CONTENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: [url],
        text: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      log(`exa_contents fail url="${url}" status=${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      results?: Array<{ text?: string }>;
    };
    const first = data.results?.[0];
    const text = first?.text?.trim();
    if (!text || text.length <= 100) {
      log(`exa_contents insufficient url="${url}" len=${text?.length ?? 0}`);
      return null;
    }
    return text;
  } catch {
    log(`exa_contents error url="${url}"`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTTP Fallback Extraction (lightweight, no external dependencies)
// ---------------------------------------------------------------------------

/**
 * Extract readable text content from HTML using a lightweight approach.
 * Strips scripts/styles, pulls text from heading/paragraph/list/table/code
 * elements, and converts to a rough markdown format.
 */
function htmlToMarkdown(html: string): string {
  // Strip <script>, <style>, <noscript>, <svg>, <nav>, <footer>, <header>
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  cleaned = cleaned.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
  cleaned = cleaned.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  cleaned = cleaned.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  // Comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Convert block elements to newlines
  cleaned = cleaned.replace(
    /<\/?(?:h[1-6]|p|div|section|article|blockquote|li|tr|dt|dd|br|hr)[^>]*>/gi,
    "\n",
  );

  // Replace <br> inline
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Links: extract text and href (support both quoting styles)
  cleaned = cleaned.replace(
    /<a[^>]*href=(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (
      _match,
      dqHref: string | undefined,
      sqHref: string | undefined,
      text: string,
    ) => {
      const href = dqHref ?? sqHref;
      const t = text.replace(/<[^>]*>/g, "").trim();
      return t ? `${t} (${href})` : href;
    },
  );

  // Images: extract alt text (support both quoting styles)
  cleaned = cleaned.replace(
    /<img[^>]*alt=(?:"([^"]*)"|'([^']*)')[^>]*\/?>/gi,
    (_match, dqAlt: string | undefined, sqAlt: string | undefined) => {
      const alt = dqAlt ?? sqAlt;
      return alt ? `[Image: ${alt}]` : "";
    },
  );

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // Decode common entities
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/&nbsp;/g, " ");

  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim each line
  cleaned = cleaned
    .split("\n")
    .map((l) => l.trim())
    .join("\n");

  // Collapse again after trimming
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

// fallow-ignore-next-line complexity
async function extractViaHttp(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} for ${url}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isHtml =
      contentType.startsWith("text/html") ||
      contentType.startsWith("application/xhtml+xml") ||
      contentType.startsWith("text/plain");
    if (!isHtml) {
      throw new Error(
        `Unsupported content type "${contentType}" for ${url}. Only HTML pages are supported.`,
      );
    }

    const html = await response.text();
    const title = extractTitle(html);
    const body = htmlToMarkdown(html);

    if (!body) {
      throw new Error("Could not extract readable content from the page");
    }

    return title ? `# ${title}\n\n${body}` : body;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out for ${url}`, { cause: err });
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Failed to fetch ${url}: unknown error`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tool: web_search
// ---------------------------------------------------------------------------

const RECENCY_VALUES = ["day", "week", "month", "year"] as const;

function formatSearchResponse(data: {
  results?: Array<{
    title?: string;
    url?: string;
    highlights?: string[];
    text?: string;
  }>;
}): string {
  const results = data.results ?? [];
  if (results.length === 0) {
    return "No results found.";
  }

  const sources = results
    .map((r, i) => `${i + 1}. [${r.title ?? "Untitled"}](${r.url ?? ""})`)
    .join("\n");

  const bestText =
    results
      .map((r) => r.highlights?.[0] ?? "")
      .filter(Boolean)
      .join("\n\n") || "No summary text available.";

  return `${bestText}\n\n**Sources:**\n${sources}`;
}

// ---------------------------------------------------------------------------
// Tool: web_fetch
// ---------------------------------------------------------------------------

function isValidHttpUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Extension Entry Point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // ---- web_search ----
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web using the Exa API. Returns an AI-synthesized answer with source citations (title + URL).",
    promptSnippet: "Search the web and return synthesized answers with sources",
    promptGuidelines: [
      "Use web_search when the user asks a factual question that benefits from up-to-date web results.",
      "Use web_search with recencyFilter ('day'|'week'|'month'|'year') to limit results by publish date.",
      "Use web_search with domainFilter to include/exclude specific domains (prefix with '-' to exclude).",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      numResults: Type.Optional(
        Type.Number({
          description: "Number of results to return (default: 5)",
        }),
      ),
      recencyFilter: Type.Optional(
        StringEnum(RECENCY_VALUES, {
          description:
            "Filter results by recency: 'day', 'week', 'month', 'year'",
        }),
      ),
      domainFilter: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Include or exclude domains. Prefix with '-' to exclude (e.g. ['github.com', '-spam.com'])",
        }),
      ),
    }),
    // fallow-ignore-next-line complexity
    async execute(_toolCallId, params) {
      const { query, numResults, recencyFilter, domainFilter } = params as {
        query: string;
        numResults?: number;
        recencyFilter?: RecencyFilter;
        domainFilter?: string[];
      };

      if (!query || query.trim() === "") {
        return {
          content: [
            {
              type: "text" as const,
              text: "A query is required for web_search.",
            },
          ],
          details: {},
          isError: true,
        };
      }

      try {
        const data = await callExaSearch(query.trim(), {
          numResults,
          recencyFilter,
          domainFilter,
        });
        const results = (data as { results?: unknown[] })?.results ?? [];
        const answer = formatSearchResponse(
          data as Parameters<typeof formatSearchResponse>[0],
        );
        return {
          content: [{ type: "text" as const, text: answer }],
          details: { sourceCount: results.length },
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error during search";
        log(`web_search fail query="${query.trim()}" msg="${message}"`);
        return {
          content: [
            { type: "text" as const, text: `Search failed: ${message}` },
          ],
          details: {},
          isError: true,
        };
      }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", `web_search: `) + theme.fg("accent", args.query),
        0,
        0,
      );
    },

    // fallow-ignore-next-line complexity
    renderResult(result, _options, theme) {
      const count = (result.details as { sourceCount?: number })?.sourceCount;
      if (count != null && count > 0) {
        const label = count === 1 ? "source" : "sources";
        return new Text(theme.fg("success", `${count} ${label}`), 0, 0);
      }
      return new Text(theme.fg("warning", "search error"), 0, 0);
    },
  });

  // ---- web_fetch ----
  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch and extract readable content from a single URL. Attempts Exa-assisted retrieval first; falls back to HTTP+Readability extraction.",
    promptSnippet: "Fetch a URL and extract its readable content as markdown",
    promptGuidelines: [
      "Use web_fetch when the user wants to read the content of a specific web page.",
      "web_fetch returns markdown-formatted content with the page title.",
      "For JS-heavy pages the HTTP fallback extraction may not capture dynamic content.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
    }),
    // fallow-ignore-next-line complexity
    async execute(_toolCallId, params) {
      const { url } = params as { url: string };

      if (!url || !isValidHttpUrl(url)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid URL: "${url ?? ""}". Provide a valid http:// or https:// URL.`,
            },
          ],
          details: {},
          isError: true,
        };
      }

      // Attempt Exa first
      let content: string | null = null;
      let usedFallback = false;
      try {
        content = await callExaContents(url);
      } catch {
        // fall through to HTTP fallback
      }

      // Fall back to HTTP extraction
      if (!content) {
        usedFallback = true;
        log(`web_fetch fallback url="${url}"`);
        try {
          content = await extractViaHttp(url);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error during fetch";
          log(`web_fetch fail url="${url}" msg="${message}"`);
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to fetch content: ${message}`,
              },
            ],
            details: {},
            isError: true,
          };
        }
      }

      return {
        content: [{ type: "text" as const, text: content }],
        details: { bytes: content.length, fallback: usedFallback },
      };
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", `web_fetch: `) + theme.fg("accent", args.url),
        0,
        0,
      );
    },

    renderResult(result, _options, theme) {
      const { bytes, fallback } = result.details as {
        bytes?: number;
        fallback?: boolean;
      };
      if (bytes != null && bytes > 0) {
        const kb = (bytes / 1024).toFixed(1);
        const label = fallback
          ? `${kb}KB extracted (fallback)`
          : `${kb}KB extracted`;
        return new Text(theme.fg("success", label), 0, 0);
      }
      return new Text(theme.fg("warning", "fetch error"), 0, 0);
    },
  });
}
