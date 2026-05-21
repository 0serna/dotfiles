import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { callExaContents } from "./exa.ts";
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

async function tryFetchContent(url: string): Promise<{
  content: string;
  fallback: boolean;
}> {
  const exaContent = await callExaContents(url).catch(() => null);
  if (exaContent) return { content: exaContent, fallback: false };
  logWebToolEvent("web_fetch_fallback", { url });
  const httpContent = await extractViaHttp(url);
  logWebToolEvent("web_fetch_http_success", {
    url,
    bytes: httpContent.length,
  });
  return { content: httpContent, fallback: true };
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
  const result = await tryFetchContent(url).catch((err: unknown) => {
    const message =
      err instanceof Error ? err.message : "Unknown error during fetch";
    logWebToolEvent("web_fetch_fail", { url, error: message });
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

export function renderWebFetchCall(args: { url: string }, theme: Theme): Text {
  return new Text(
    theme.fg("toolTitle", `web_fetch: `) + theme.fg("accent", args.url),
    0,
    0,
  );
}

export function renderWebFetchResult(
  result: AgentToolResult<Record<string, unknown>>,
  _options: unknown,
  theme: Theme,
): Text {
  const bytes = result.details["bytes"];
  const fallback = result.details["fallback"];
  if (typeof bytes === "number" && bytes > 0) {
    const kb = (bytes / 1024).toFixed(1);
    const label =
      fallback === true ? `${kb}KB extracted (fallback)` : `${kb}KB extracted`;
    return new Text(theme.fg("success", label), 0, 0);
  }
  return new Text(theme.fg("warning", "fetch error"), 0, 0);
}
