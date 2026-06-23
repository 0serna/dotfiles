import {
  failureDetails,
  HttpResponseError,
  responseDetails,
} from "../shared/diagnostics.ts";
import { TAVILY_SEARCH_URL, TAVILY_TIMEOUT_MS } from "./config.ts";
import { logWebToolEvent } from "./logger.ts";
import type { TavilySearchResponse } from "./types.ts";

function getApiKeyOrThrow(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error(
      "TAVILY_API_KEY is not set. Set the TAVILY_API_KEY environment variable with your Tavily API key.",
    );
  }
  return key;
}

function buildSearchBody(query: string): Record<string, unknown> {
  return {
    query,
    max_results: 2,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: false,
    include_usage: true,
  };
}

async function doTavilyFetch(body: Record<string, unknown>): Promise<Response> {
  const apiKey = getApiKeyOrThrow();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
  try {
    return await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseOkJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new HttpResponseError(
      `Tavily API ${response.status} ${response.statusText}`,
      await responseDetails(response),
    );
  }
  return (await response.json()) as T;
}

export async function callTavilySearch(
  query: string,
  toolCallId?: string,
): Promise<TavilySearchResponse | null> {
  const startedAt = Date.now();
  try {
    const response = await doTavilyFetch(buildSearchBody(query));
    const data = await parseOkJson<TavilySearchResponse>(response);
    logWebToolEvent("tavily_search_success", {
      toolCallId,
      query,
      results: data.results?.length ?? 0,
      credits: data.usage?.credits,
      elapsedMs: Date.now() - startedAt,
    });
    return data;
  } catch (err: unknown) {
    logWebToolEvent("tavily_search_failure", {
      toolCallId,
      query,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    return null;
  }
}
