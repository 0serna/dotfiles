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

function buildSearchBody(query: string): Record<string, unknown> {
  return {
    query,
    type: "auto",
    numResults: DEFAULT_NUM_RESULTS,
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

async function parseExaResponse<T>(
  response: Response,
  label: string,
): Promise<T | null> {
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    logWebToolEvent("exa_api_error", {
      label,
      status: response.status,
      errorText: errorText.slice(0, 200),
    });
    return null;
  }
  return (await response.json()) as T;
}

export async function callExaSearch(query: string): Promise<unknown> {
  const body = buildSearchBody(query);
  const response = await doExaFetch(EXA_SEARCH_URL, body);
  const data = await parseExaResponse<ExaSearchResponse>(
    response,
    "exa_search",
  );
  if (!data) {
    throw new Error(`Exa API error for query="${query}"`);
  }
  return data;
}

function getFirstResult(
  data: { results?: Array<{ text?: string }> } | null,
): { text?: string } | null {
  if (!data?.results?.length) return null;
  return data.results[0] ?? null;
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

export async function callExaContents(url: string): Promise<string | null> {
  const response = await doExaFetch(EXA_CONTENTS_URL, {
    urls: [url],
    text: true,
  });
  const data = await parseExaResponse<ExaContentsResponse>(
    response,
    "exa_contents",
  );

  const text = extractContentText(data);
  const status = getFirstExaStatus(data);

  if (isExaStatusError(status)) {
    logWebToolEvent("exa_contents_error", {
      url,
      status: status.status,
      tag: status.tag,
      httpCode: status.httpStatusCode,
    });
    return text;
  }

  if (text) {
    logWebToolEvent("exa_contents_success", { url, len: text.length });
  } else {
    logWebToolEvent("exa_contents_insufficient", { url });
  }

  return text;
}
