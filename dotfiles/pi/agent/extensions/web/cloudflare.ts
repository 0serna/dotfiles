import { failureDetails, responseDetails } from "../shared/diagnostics.ts";
import { CLOUDFLARE_MARKDOWN_URL, CLOUDFLARE_TIMEOUT_MS } from "./config.ts";
import { logWebToolEvent } from "./logger.ts";

// Set when Browser Run returns a daily-quota-exhausted 429. Skips all
// subsequent calls until the process restarts.
let cloudflareQuotaExhausted = false;

function hasCredentials(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID,
  );
}

function buildMarkdownEndpoint(): string {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  return `${CLOUDFLARE_MARKDOWN_URL}/${accountId}/browser-rendering/markdown`;
}

function buildRequestBody(url: string): Record<string, unknown> {
  return {
    url,
    gotoOptions: { waitUntil: "networkidle0" },
    rejectResourceTypes: ["image", "font", "stylesheet"],
  };
}

async function doCloudflareFetch(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const token = process.env.CLOUDFLARE_API_TOKEN!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLOUDFLARE_TIMEOUT_MS);
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

interface CloudflareMarkdownResponse {
  success?: boolean;
  result?: string;
}

function extractMarkdown(data: CloudflareMarkdownResponse): string | null {
  if (data.success === false) return null;
  if (typeof data.result !== "string") return null;
  const trimmed = data.result.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Attempts to extract Markdown from a URL using Cloudflare Browser Run's
 * `/markdown` Quick Action endpoint. Returns `null` when:
 * - Credentials are not set (silent skip)
 * - Daily quota has been exhausted (cached skip)
 * - The API returns an error, rate-limits, empty content, or times out
 */
export async function retrieveWithCloudflareAdapter(
  url: string,
  toolCallId?: string,
): Promise<string | null> {
  if (!hasCredentials()) {
    return null;
  }

  if (cloudflareQuotaExhausted) {
    logWebToolEvent("cloudflare_markdown_skipped", {
      toolCallId,
      url,
      reason: "quota_exhausted",
    });
    return null;
  }

  const endpoint = buildMarkdownEndpoint();
  const body = buildRequestBody(url);
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await doCloudflareFetch(endpoint, body);
  } catch (err: unknown) {
    logWebToolEvent("cloudflare_markdown_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      ...failureDetails(err),
    });
    return null;
  }

  if (response.status === 429) {
    const bodyText = await response.text().catch(() => "");

    if (bodyText.includes("Browser time limit exceeded")) {
      cloudflareQuotaExhausted = true;
    }

    logWebToolEvent("cloudflare_markdown_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      reason: "rate_limited",
      httpStatus: 429,
      bodySnippet: bodyText.slice(0, 200),
    });
    return null;
  }

  if (!response.ok) {
    const details = await responseDetails(response);
    logWebToolEvent("cloudflare_markdown_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      reason: "http_error",
      ...details,
    });
    return null;
  }

  let data: CloudflareMarkdownResponse;
  try {
    data = (await response.json()) as CloudflareMarkdownResponse;
  } catch (err: unknown) {
    logWebToolEvent("cloudflare_markdown_failure", {
      toolCallId,
      url,
      elapsedMs: Date.now() - startedAt,
      reason: "invalid_json",
      ...failureDetails(err),
    });
    return null;
  }

  const markdown = extractMarkdown(data);
  const elapsedMs = Date.now() - startedAt;

  if (markdown) {
    logWebToolEvent("cloudflare_markdown_success", {
      toolCallId,
      url,
      elapsedMs,
      contentLength: markdown.length,
    });
  } else {
    logWebToolEvent("cloudflare_markdown_failure", {
      toolCallId,
      url,
      elapsedMs,
      reason: "empty_result",
    });
  }

  return markdown;
}
