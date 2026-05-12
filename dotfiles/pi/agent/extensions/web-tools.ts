import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { appendFileSync } from "fs";
import { Type } from "typebox";

// ===========================================================================
// Logging
// ===========================================================================

const LOG_FILE = "/tmp/pi-web-tools.log";

function log(msg: string): void {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // ignore
  }
}

// ===========================================================================
// Configuration
// ===========================================================================

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_CONTENTS_URL = "https://api.exa.ai/contents";
const EXA_TIMEOUT_MS = 15_000;
const HTTP_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_NUM_RESULTS = 5;

type RecencyFilter = "day" | "week" | "month" | "year";

// ===========================================================================
// Helpers
// ===========================================================================

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

function parseDomainFilter(filter: string[]): Record<string, string[]> {
  const include = filter.filter((e) => !e.startsWith("-"));
  const exclude = filter
    .filter((e) => e.startsWith("-"))
    .map((e) => e.slice(1));
  return Object.assign(
    {},
    include.length > 0 && { includeDomains: include },
    exclude.length > 0 && { excludeDomains: exclude },
  );
}

// ===========================================================================
// Exa API Client
// ===========================================================================

function addDomainFilter(
  body: Record<string, unknown>,
  domainFilter: string[] | undefined,
): void {
  if (domainFilter && domainFilter.length > 0) {
    Object.assign(body, parseDomainFilter(domainFilter));
  }
}

function buildSearchBody(
  query: string,
  opts: {
    numResults?: number;
    recencyFilter?: RecencyFilter;
    domainFilter?: string[];
  },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query,
    type: "auto",
    numResults: opts.numResults || DEFAULT_NUM_RESULTS,
    contents: { highlights: true },
  };
  if (opts.recencyFilter) {
    body.startPublishedDate = recencyToStartDate(opts.recencyFilter);
  }
  addDomainFilter(body, opts.domainFilter);
  return body;
}

async function doExaFetch(
  url: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const apiKey = getApiKeyOrThrow();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseExaResponse<T>(
  response: Response,
  label: string,
): Promise<T | null> {
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    log(
      `${label} fail status=${response.status} body="${errorText.slice(0, 200)}"`,
    );
    return null;
  }
  return (await response.json()) as T;
}

async function callExaSearch(
  query: string,
  opts: {
    numResults?: number;
    recencyFilter?: RecencyFilter;
    domainFilter?: string[];
  },
): Promise<unknown> {
  const body = buildSearchBody(query, opts);
  const response = await doExaFetch(EXA_SEARCH_URL, body);
  const data = await parseExaResponse<{
    results?: Array<{
      title?: string;
      url?: string;
      highlights?: string[];
      text?: string;
    }>;
  }>(response, "exa_search");
  if (!data) {
    throw new Error(`Exa API error for query="${query}"`);
  }
  return data;
}

function getFirstResult(
  data: { results?: Array<{ text?: string }> } | null,
): { text?: string } | null {
  if (!data?.results?.length) return null;
  return data.results[0];
}

function extractContentText(
  data: { results?: Array<{ text?: string }> } | null,
): string | null {
  const result = getFirstResult(data);
  if (result == null) return null;
  const text = result.text;
  if (text == null) return null;
  if (text.trim().length <= 100) return null;
  return text.trim();
}

async function callExaContents(url: string): Promise<string | null> {
  const response = await doExaFetch(EXA_CONTENTS_URL, {
    urls: [url],
    text: true,
  });
  const data = await parseExaResponse<{
    results?: Array<{ text?: string }>;
  }>(response, "exa_contents");
  const text = extractContentText(data);
  if (!text) {
    log(`exa_contents insufficient url="${url}"`);
  }
  return text;
}

// ===========================================================================
// HTTP Fallback Extraction
// ===========================================================================

async function doHttpFetch(
  url: string,
): Promise<{ html: string; contentType: string }> {
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
    const html = await response.text();
    return { html, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function assertHtmlContent(contentType: string, url: string): void {
  const isHtml =
    contentType.startsWith("text/html") ||
    contentType.startsWith("application/xhtml+xml") ||
    contentType.startsWith("text/plain");
  if (!isHtml) {
    throw new Error(
      `Unsupported content type "${contentType}" for ${url}. Only HTML pages are supported.`,
    );
  }
}

function stripTags(html: string, tags: string[]): string {
  const pattern = new RegExp(
    `<(${tags.join("|")})[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi",
  );
  return html.replace(pattern, "");
}

function replaceBlockElements(html: string): string {
  return html.replace(
    /<\/?(?:h[1-6]|p|div|section|article|blockquote|li|tr|dt|dd|br|hr)[^>]*>/gi,
    "\n",
  );
}

function replaceLinks(html: string): string {
  return html.replace(
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
}

function replaceImages(html: string): string {
  return html.replace(
    /<img[^>]*alt=(?:"([^"]*)"|'([^']*)')[^>]*\/?>/gi,
    (_match, dqAlt: string | undefined, sqAlt: string | undefined) => {
      const alt = dqAlt ?? sqAlt;
      return alt ? `[Image: ${alt}]` : "";
    },
  );
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function collapseLines(html: string): string {
  return html
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function htmlToMarkdown(html: string): string {
  let cleaned = html;
  cleaned = stripTags(cleaned, [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "header",
  ]);
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  cleaned = replaceBlockElements(cleaned);
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  cleaned = replaceLinks(cleaned);
  cleaned = replaceImages(cleaned);
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  cleaned = decodeEntities(cleaned);
  cleaned = collapseLines(cleaned);
  return cleaned.trim();
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

async function extractViaHttp(url: string): Promise<string> {
  const { html, contentType } = await doHttpFetch(url);
  assertHtmlContent(contentType, url);
  const title = extractTitle(html);
  const body = htmlToMarkdown(html);
  if (!body) {
    throw new Error("Could not extract readable content from the page");
  }
  return title ? `# ${title}\n\n${body}` : body;
}

// ===========================================================================
// Tool: web_search
// ===========================================================================

const RECENCY_VALUES = ["day", "week", "month", "year"] as const;

function getResultCount(data: unknown): number {
  const d = data as { results?: unknown[] } | null;
  return d?.results?.length ?? 0;
}

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

async function executeWebSearch(
  _toolCallId: string,
  params: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
}> {
  const { query, numResults, recencyFilter, domainFilter } = params as {
    query: string;
    numResults?: number;
    recencyFilter?: RecencyFilter;
    domainFilter?: string[];
  };
  if (!query || query.trim() === "") {
    return {
      content: [
        { type: "text" as const, text: "A query is required for web_search." },
      ],
      details: {},
      isError: true,
    };
  }
  const data = await callExaSearch(query.trim(), {
    numResults,
    recencyFilter,
    domainFilter,
  }).catch(() => null);
  if (data == null) {
    log(`web_search fail query="${query.trim()}"`);
    return {
      content: [{ type: "text" as const, text: "Search failed" }],
      details: {},
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: formatSearchResponse(data) }],
    details: { sourceCount: getResultCount(data) },
  };
}

function renderWebSearchCall(
  args: { query: string },
  theme: { fg: (style: string, text: string) => string },
): Text {
  return new Text(
    theme.fg("toolTitle", `web_search: `) + theme.fg("accent", args.query),
    0,
    0,
  );
}

function renderWebSearchResult(
  result: { details: { sourceCount?: number } },
  _options: unknown,
  theme: { fg: (style: string, text: string) => string },
): Text {
  const count = result.details.sourceCount;
  if (count != null && count > 0) {
    const label = count === 1 ? "source" : "sources";
    return new Text(theme.fg("success", `${count} ${label}`), 0, 0);
  }
  return new Text(theme.fg("warning", "search error"), 0, 0);
}

// ===========================================================================
// Tool: web_fetch
// ===========================================================================

function isValidHttpUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function tryFetchContent(url: string): Promise<{
  content: string;
  fallback: boolean;
}> {
  const exaContent = await callExaContents(url).catch(() => null);
  if (exaContent) return { content: exaContent, fallback: false };
  log(`web_fetch fallback url="${url}"`);
  const httpContent = await extractViaHttp(url);
  return { content: httpContent, fallback: true };
}

async function executeWebFetch(
  _toolCallId: string,
  params: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
}> {
  const { url } = params as { url: string };
  if (!url || !isValidHttpUrl(url)) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Invalid URL: "${url}". Provide a valid http:// or https:// URL.`,
        },
      ],
      details: {},
      isError: true,
    };
  }
  const result = await tryFetchContent(url).catch((err: unknown) => {
    const message =
      err instanceof Error ? err.message : "Unknown error during fetch";
    log(`web_fetch fail url="${url}" msg="${message}"`);
    return null;
  });
  if (result == null) {
    return {
      content: [{ type: "text" as const, text: "Failed to fetch content" }],
      details: {},
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: result.content }],
    details: { bytes: result.content.length, fallback: result.fallback },
  };
}

function renderWebFetchCall(
  args: { url: string },
  theme: { fg: (style: string, text: string) => string },
): Text {
  return new Text(
    theme.fg("toolTitle", `web_fetch: `) + theme.fg("accent", args.url),
    0,
    0,
  );
}

function renderWebFetchResult(
  result: { details: { bytes?: number; fallback?: boolean } },
  _options: unknown,
  theme: { fg: (style: string, text: string) => string },
): Text {
  const { bytes, fallback } = result.details;
  if (bytes != null && bytes > 0) {
    const kb = (bytes / 1024).toFixed(1);
    const label = fallback
      ? `${kb}KB extracted (fallback)`
      : `${kb}KB extracted`;
    return new Text(theme.fg("success", label), 0, 0);
  }
  return new Text(theme.fg("warning", "fetch error"), 0, 0);
}

// ===========================================================================
// Extension Entry Point
// ===========================================================================

export default function (pi: ExtensionAPI) {
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
    execute: executeWebSearch,
    renderCall: renderWebSearchCall,
    renderResult: renderWebSearchResult,
  });

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
    execute: executeWebFetch,
    renderCall: renderWebFetchCall,
    renderResult: renderWebFetchResult,
  });
}
