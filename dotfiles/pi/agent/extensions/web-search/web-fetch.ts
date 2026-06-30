import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  type AgentToolResult,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { failureDetails } from "../shared/diagnostics.ts";
import { writeTempOutput } from "../shared/temp-output.ts";
import { tryCloudflareMarkdown } from "./cloudflare.ts";
import { callExaContents } from "./exa.ts";
import { classifyGitHubUrl, tryGitHubFetch } from "./github.ts";
import { extractViaHttp } from "./http.ts";
import { logWebToolEvent } from "./logger.ts";
import type { TextToolResult } from "./types.ts";

function isValidHttpUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const CACHE_TTL_MS = 600_000;
const MAX_FETCH_CACHE_ENTRIES = 50;

type CachedFetch = { content: string; source: string; timestamp: number };

const fetchCache = new Map<string, CachedFetch>();

function pruneFetchCache(now = Date.now()): void {
  for (const [url, cached] of fetchCache) {
    if (now - cached.timestamp >= CACHE_TTL_MS) fetchCache.delete(url);
  }

  while (fetchCache.size >= MAX_FETCH_CACHE_ENTRIES) {
    const oldestUrl = fetchCache.keys().next().value as string | undefined;
    if (oldestUrl === undefined) return;
    fetchCache.delete(oldestUrl);
  }
}

function getCachedFetch(url: string): CachedFetch | null {
  const cached = fetchCache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= CACHE_TTL_MS) {
    fetchCache.delete(url);
    return null;
  }
  return cached;
}

function cacheAndReturn(
  url: string,
  content: string,
  source: string,
): { content: string; source: string } {
  pruneFetchCache();
  fetchCache.set(url, { content, source, timestamp: Date.now() });
  return { content, source };
}

async function tryFetchContent(
  url: string,
  toolCallId: string,
): Promise<{ content: string; source: string }> {
  const cached = getCachedFetch(url);
  if (cached) return { content: cached.content, source: cached.source };

  const parsed = classifyGitHubUrl(url);

  if (parsed.type !== "unsupported") {
    const gitHubResult = await tryGitHubFetch(url, parsed, toolCallId);
    if (gitHubResult) {
      return cacheAndReturn(url, gitHubResult.content, gitHubResult.source);
    }
    logWebToolEvent("web_fetch_fallback", {
      toolCallId,
      url,
      from: "github_fetch",
      to: "http_fetch",
      reason: "github_fetch_failure",
    });
  }

  const httpContent = await extractViaHttp(url, toolCallId);
  if (httpContent) {
    return cacheAndReturn(url, httpContent, "http-fallback");
  }
  logWebToolEvent("web_fetch_fallback", {
    toolCallId,
    url,
    from: "http_fetch",
    to: "cloudflare_markdown",
    reason: "http_fetch_failure",
  });

  const cloudflareContent = await tryCloudflareMarkdown(url, toolCallId);
  if (cloudflareContent) {
    return cacheAndReturn(url, cloudflareContent, "cloudflare");
  }
  logWebToolEvent("web_fetch_fallback", {
    toolCallId,
    url,
    from: "cloudflare_markdown",
    to: "exa_contents",
    reason: "cloudflare_markdown_failure",
  });

  const exaContent = await callExaContents(url, toolCallId).catch(() => null);
  if (exaContent) {
    return cacheAndReturn(url, exaContent, "exa");
  }

  throw new Error("All retrieval tiers failed to provide content");
}

async function formatFetchContent(
  url: string,
  content: string,
): Promise<{ text: string; details: Record<string, unknown> }> {
  const truncation = truncateHead(content, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  if (!truncation.truncated) {
    return { text: content, details: { contentLength: content.length } };
  }

  const fullOutputPath = await writeTempOutput("pi-web-fetch", content);
  const text = `${truncation.content}\n\n[Content truncated: ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). Full content saved to: ${fullOutputPath}]`;

  logWebToolEvent("web_fetch_truncated", {
    url,
    outputBytes: truncation.outputBytes,
    totalBytes: truncation.totalBytes,
    outputLines: truncation.outputLines,
    totalLines: truncation.totalLines,
    fullOutputPath,
  });

  return {
    text,
    details: {
      contentLength: content.length,
      displayedContentLength: truncation.content.length,
      truncated: true,
      fullOutputPath,
    },
  };
}

export async function executeWebFetch(
  _toolCallId: string,
  params: Record<string, unknown>,
): Promise<TextToolResult> {
  const { url } = params as { url: string };
  if (!url || !isValidHttpUrl(url)) {
    throw new Error(
      `Invalid URL: "${url}". Provide a valid http:// or https:// URL.`,
    );
  }
  try {
    const result = await tryFetchContent(url, _toolCallId);
    const formatted = await formatFetchContent(url, result.content);
    return {
      content: [{ type: "text" as const, text: formatted.text }],
      details: {
        ...formatted.details,
        source: result.source,
      },
    };
  } catch (err: unknown) {
    logWebToolEvent("web_fetch_failure", {
      toolCallId: _toolCallId,
      url,
      ...failureDetails(err),
    });
    const fetchError =
      err instanceof Error ? err.message : "Unknown error during fetch";
    throw new Error(`Failed to fetch content: ${fetchError}`, { cause: err });
  }
}

export function renderWebFetchCall(args: { url: string }, theme: Theme): Text {
  return new Text(
    theme.fg("toolTitle", `web_fetch: `) + theme.fg("accent", args.url),
    0,
    0,
  );
}

const SOURCE_LABELS: Record<string, string> = {
  "github-raw": "github",
  "github-api": "github",
  exa: "exa",
  cloudflare: "cloudflare",
  "http-fallback": "http",
};

export function renderWebFetchResult(
  result: AgentToolResult<Record<string, unknown>>,
  _options: unknown,
  theme: Theme,
): Text {
  const bytes = result.details["contentLength"];
  if (typeof bytes === "number" && bytes > 0) {
    const kb = (bytes / 1024).toFixed(1);
    const source = result.details["source"];
    const label =
      typeof source === "string" && source in SOURCE_LABELS
        ? `${kb}KB (${SOURCE_LABELS[source]})`
        : `${kb}KB extracted`;
    return new Text(theme.fg("success", label), 0, 0);
  }
  const fetchError = result.details["fetchError"];
  if (typeof fetchError === "string") {
    return new Text(theme.fg("warning", `fetch error: ${fetchError}`), 0, 0);
  }
  return new Text(theme.fg("warning", "fetch error"), 0, 0);
}
