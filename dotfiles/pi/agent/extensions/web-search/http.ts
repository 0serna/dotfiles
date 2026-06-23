import {
  failureDetails,
  HttpResponseError,
  responseDetails,
} from "../shared/diagnostics.ts";
import { HTTP_FETCH_TIMEOUT_MS } from "./config.ts";
import { logWebToolEvent } from "./logger.ts";

async function doHttpFetch(
  url: string,
): Promise<{ text: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/plain, */*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpResponseError(
        `HTTP ${response.status} ${response.statusText} for ${url}`,
        await responseDetails(response),
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    return { text, contentType };
  } finally {
    clearTimeout(timer);
  }
}

export async function extractViaHttp(
  url: string,
  toolCallId?: string,
): Promise<string | null> {
  const startedAt = Date.now();
  try {
    const { text, contentType } = await doHttpFetch(url);
    if (!contentType.startsWith("text/plain")) {
      logWebToolEvent("http_fetch_skip", {
        toolCallId,
        url,
        elapsedMs: Date.now() - startedAt,
        reason: "non_text_plain",
        contentType,
      });
      return null;
    }
    if (!text.trim()) {
      logWebToolEvent("http_fetch_failure", {
        toolCallId,
        url,
        elapsedMs: Date.now() - startedAt,
        reason: "empty_content",
      });
      return null;
    }
    logWebToolEvent("http_fetch_success", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      contentLength: text.length,
    });
    return text;
  } catch (err: unknown) {
    logWebToolEvent("http_fetch_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    return null;
  }
}
