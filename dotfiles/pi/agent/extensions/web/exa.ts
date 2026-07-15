import {
  failureDetails,
  HttpResponseError,
  responseDetails,
} from "../shared/diagnostics.ts";
import {
  DEFAULT_NUM_RESULTS,
  EXA_CONTENTS_URL,
  EXA_SEARCH_URL,
  EXA_TIMEOUT_MS,
} from "./config.ts";
import { logWebToolEvent } from "./logger.ts";
import type {
  ExaContentsResponse,
  ExaContentsStatus,
  ExaSearchResponse,
} from "./types.ts";

function getApiKeyOrThrow(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new Error(
      "EXA_API_KEY is not set. Set the EXA_API_KEY environment variable with your Exa API key.",
    );
  }
  return key;
}

function buildSearchBody(
  query: string,
  numResults?: number,
): Record<string, unknown> {
  return {
    query,
    type: "auto",
    numResults: numResults ?? DEFAULT_NUM_RESULTS,
    contents: { highlights: true },
  };
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

async function parseOkJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new HttpResponseError(
      `Exa API ${response.status} ${response.statusText}`,
      await responseDetails(response),
    );
  }
  return (await response.json()) as T;
}

export async function callExaSearch(
  query: string,
  toolCallId?: string,
  numResults?: number,
): Promise<ExaSearchResponse> {
  const startedAt = Date.now();
  try {
    const response = await doExaFetch(
      EXA_SEARCH_URL,
      buildSearchBody(query, numResults),
    );
    const data = await parseOkJson<ExaSearchResponse>(response);
    logWebToolEvent("exa_search_success", {
      toolCallId,
      query,
      results: data.results?.length ?? 0,
      elapsedMs: Date.now() - startedAt,
    });
    return data;
  } catch (err: unknown) {
    logWebToolEvent("exa_search_failure", {
      toolCallId,
      query,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    throw err;
  }
}

function getFirstResult(
  data: { results?: Array<{ text?: string }> } | null,
): { text?: string } | null {
  return data?.results?.[0] ?? null;
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

function getFirstExaStatus(
  data: ExaContentsResponse | null,
): ExaContentsStatus | undefined {
  return data?.statuses?.[0];
}

function isExaStatusError(
  status: ExaContentsStatus | undefined,
): status is ExaContentsStatus & { status: string } {
  return Boolean(status?.status && status.status !== "success");
}

export async function retrieveWithExaAdapter(
  url: string,
  toolCallId?: string,
): Promise<string | null> {
  const startedAt = Date.now();
  try {
    const response = await doExaFetch(EXA_CONTENTS_URL, {
      urls: [url],
      text: true,
    });
    const data = await parseOkJson<ExaContentsResponse>(response);
    const text = extractContentText(data);
    const status = getFirstExaStatus(data);
    const elapsedMs = Date.now() - startedAt;

    if (isExaStatusError(status)) {
      logWebToolEvent("exa_contents_failure", {
        toolCallId,
        url,
        elapsedMs,
        status: status.status,
        tag: status.tag,
        httpCode: status.httpStatusCode,
        contentLength: text?.length ?? 0,
      });
      return text;
    }

    if (text) {
      logWebToolEvent("exa_contents_success", {
        toolCallId,
        url,
        elapsedMs,
        contentLength: text.length,
      });
    } else {
      logWebToolEvent("exa_contents_failure", {
        toolCallId,
        url,
        elapsedMs,
        reason: "insufficient_content",
      });
    }

    return text;
  } catch (err: unknown) {
    logWebToolEvent("exa_contents_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    throw err;
  }
}
