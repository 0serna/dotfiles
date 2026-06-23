import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { failureDetails } from "../shared/diagnostics.ts";
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

const fetchCache = new Map<
  string,
  { content: string; source: string; timestamp: number }
>();

function cacheAndReturn(
  url: string,
  content: string,
  source: string,
): { content: string; source: string } {
  fetchCache.set(url, { content, source, timestamp: Date.now() });
  return { content, source };
}

async function tryFetchContent(
  url: string,
  toolCallId: string,
): Promise<{ content: string; source: string }> {
  const cached = fetchCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { content: cached.content, source: cached.source };
  }

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

export async function executeWebFetch(
  _toolCallId: string,
  params: Record<string, unknown>,
): Promise<TextToolResult> {
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
  try {
    const result = await tryFetchContent(url, _toolCallId);
    return {
      content: [{ type: "text" as const, text: result.content }],
      details: {
        contentLength: result.content.length,
        source: result.source,
      },
    };
  } catch (err: unknown) {
    const fetchError =
      err instanceof Error ? err.message : "Unknown error during fetch";
    logWebToolEvent("web_fetch_failure", {
      toolCallId: _toolCallId,
      url,
      ...failureDetails(err),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to fetch content: ${fetchError}`,
        },
      ],
      details: { fetchError },
      isError: true,
    };
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
