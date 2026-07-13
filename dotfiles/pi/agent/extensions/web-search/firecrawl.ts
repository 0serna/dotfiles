import { failureDetails, responseDetails } from "../shared/diagnostics.ts";
import {
  FIRECRAWL_SCRAPE_URL,
  FIRECRAWL_SEARCH_URL,
  FIRECRAWL_TIMEOUT_MS,
} from "./config.ts";
import { logWebToolEvent } from "./logger.ts";
import type {
  FirecrawlScrapeResponse,
  FirecrawlSearchResponse,
} from "./types.ts";

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.FIRECRAWL_API_KEY;
  if (key) {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return headers;
}

async function doFirecrawlFetch(
  url: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseOkJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(
      `Firecrawl API ${response.status} ${response.statusText}: ${await responseDetails(response).then((d) => d.bodySnippet)}`,
    );
  }
  return (await response.json()) as T;
}

export async function callFirecrawlSearch(
  query: string,
  toolCallId?: string,
): Promise<FirecrawlSearchResponse | null> {
  const startedAt = Date.now();
  try {
    const response = await doFirecrawlFetch(FIRECRAWL_SEARCH_URL, {
      query,
      limit: 2,
    });
    const data = await parseOkJson<FirecrawlSearchResponse>(response);
    logWebToolEvent("firecrawl_search_success", {
      toolCallId,
      query,
      results: data.data?.web?.length ?? 0,
      elapsedMs: Date.now() - startedAt,
    });
    return data;
  } catch (err: unknown) {
    logWebToolEvent("firecrawl_search_failure", {
      toolCallId,
      query,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    return null;
  }
}

export async function callFirecrawlScrape(
  url: string,
  toolCallId?: string,
): Promise<string | null> {
  const startedAt = Date.now();
  try {
    const response = await doFirecrawlFetch(FIRECRAWL_SCRAPE_URL, {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    });
    const data = await parseOkJson<FirecrawlScrapeResponse>(response);
    const markdown = data.data?.markdown;
    if (!markdown || markdown.trim().length === 0) {
      logWebToolEvent("firecrawl_scrape_failure", {
        toolCallId,
        url,
        elapsedMs: Date.now() - startedAt,
        reason: "empty_content",
      });
      return null;
    }
    logWebToolEvent("firecrawl_scrape_success", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      contentLength: markdown.length,
    });
    return markdown;
  } catch (err: unknown) {
    logWebToolEvent("firecrawl_scrape_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    return null;
  }
}
