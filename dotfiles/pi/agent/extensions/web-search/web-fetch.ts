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

async function tryFetchContent(
  url: string,
  toolCallId: string,
): Promise<{
  content: string;
  source?: string;
}> {
  const gitHubType = classifyGitHubUrl(url).type;
  const gitHubResult = await tryGitHubFetch(url, toolCallId);
  if (gitHubResult) {
    return {
      content: gitHubResult.content,
      source: gitHubResult.source,
    };
  }

  if (gitHubType !== "unsupported") {
    logWebToolEvent("web_fetch_fallback", {
      toolCallId,
      url,
      from: "github_fetch",
      to: "exa_contents",
      reason: "github_fetch_failure",
    });
  }

  const exaContent = await callExaContents(url, toolCallId).catch(() => null);
  if (exaContent) {
    return { content: exaContent, source: "exa" };
  }
  logWebToolEvent("web_fetch_fallback", {
    toolCallId,
    url,
    from: "exa_contents",
    to: "cloudflare_markdown",
    reason: "exa_contents_failure",
  });
  const cloudflareContent = await tryCloudflareMarkdown(url, toolCallId);
  if (cloudflareContent) {
    return { content: cloudflareContent, source: "cloudflare" };
  }
  logWebToolEvent("web_fetch_fallback", {
    toolCallId,
    url,
    from: "cloudflare_markdown",
    to: "http_fetch",
    reason: "cloudflare_markdown_failure",
  });
  const httpContent = await extractViaHttp(url, toolCallId);
  return { content: httpContent, source: "http-fallback" };
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
