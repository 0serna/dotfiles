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
import { logWebToolEvent } from "./logger.ts";
import { retrieve } from "./retrieval.ts";
import type { TextToolResult } from "./types.ts";

function isValidHttpUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
    const result = await retrieve(url, _toolCallId);
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
  firecrawl: "firecrawl",
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
