import { retrieveWithCloudflareAdapter } from "./cloudflare.ts";
import { retrieveWithExaAdapter } from "./exa.ts";
import { callFirecrawlScrape } from "./firecrawl.ts";
import { classifyGitHubUrl, retrieveWithGitHubAdapter } from "./github.ts";
import { retrieveWithHttpAdapter } from "./http.ts";
import { logWebToolEvent } from "./logger.ts";

const CACHE_TTL_MS = 600_000;
const MAX_FETCH_CACHE_ENTRIES = 50;

type RetrievalSource =
  | "github-raw"
  | "github-api"
  | "http-fallback"
  | "firecrawl"
  | "cloudflare"
  | "exa";

type RetrievedContent = {
  content: string;
  source: RetrievalSource;
};

type AdapterResult = RetrievedContent | null | undefined;

type RetrievalAdapter = {
  name: string;
  fallbackTo?: string;
  failureReason: string;
  retrieve: (url: string, toolCallId: string) => Promise<AdapterResult>;
};

type CachedFetch = RetrievedContent & { timestamp: number };

const fetchCache = new Map<string, CachedFetch>();

function pruneFetchCache(now: number): void {
  for (const [url, cached] of fetchCache) {
    if (now - cached.timestamp >= CACHE_TTL_MS) fetchCache.delete(url);
  }

  while (fetchCache.size >= MAX_FETCH_CACHE_ENTRIES) {
    const oldestUrl = fetchCache.keys().next().value;
    if (oldestUrl === undefined) return;
    fetchCache.delete(oldestUrl);
  }
}

function getCachedFetch(url: string, now: number): RetrievedContent | null {
  const cached = fetchCache.get(url);
  if (!cached) return null;
  if (now - cached.timestamp >= CACHE_TTL_MS) {
    fetchCache.delete(url);
    return null;
  }
  return { content: cached.content, source: cached.source };
}

function cacheAndReturn(
  url: string,
  result: RetrievedContent,
): RetrievedContent {
  const now = Date.now();
  pruneFetchCache(now);
  fetchCache.set(url, { ...result, timestamp: now });
  return result;
}

function logFallback(
  toolCallId: string,
  url: string,
  from: string,
  to: string,
  reason: string,
): void {
  logWebToolEvent("web_fetch_fallback", { toolCallId, url, from, to, reason });
}

async function retrieveFromGitHubAdapter(
  url: string,
  toolCallId: string,
): Promise<AdapterResult> {
  const parsed = classifyGitHubUrl(url);
  if (parsed.type === "unsupported") return undefined;
  return retrieveWithGitHubAdapter(url, parsed, toolCallId);
}

async function retrieveFromHttpAdapter(
  url: string,
  toolCallId: string,
): Promise<AdapterResult> {
  const content = await retrieveWithHttpAdapter(url, toolCallId);
  return content ? { content, source: "http-fallback" } : null;
}

async function retrieveFromFirecrawlAdapter(
  url: string,
  toolCallId: string,
): Promise<AdapterResult> {
  const content = await callFirecrawlScrape(url, toolCallId);
  return content ? { content, source: "firecrawl" } : null;
}

async function retrieveFromCloudflareAdapter(
  url: string,
  toolCallId: string,
): Promise<AdapterResult> {
  const content = await retrieveWithCloudflareAdapter(url, toolCallId);
  return content ? { content, source: "cloudflare" } : null;
}

async function retrieveFromExaAdapter(
  url: string,
  toolCallId: string,
): Promise<AdapterResult> {
  const content = await retrieveWithExaAdapter(url, toolCallId).catch(
    () => null,
  );
  return content ? { content, source: "exa" } : null;
}

const RETRIEVAL_ADAPTERS: RetrievalAdapter[] = [
  {
    name: "github_fetch",
    fallbackTo: "http_fetch",
    failureReason: "github_fetch_failure",
    retrieve: retrieveFromGitHubAdapter,
  },
  {
    name: "http_fetch",
    fallbackTo: "firecrawl_scrape",
    failureReason: "http_fetch_failure",
    retrieve: retrieveFromHttpAdapter,
  },
  {
    name: "firecrawl_scrape",
    fallbackTo: "cloudflare_markdown",
    failureReason: "firecrawl_scrape_failure",
    retrieve: retrieveFromFirecrawlAdapter,
  },
  {
    name: "cloudflare_markdown",
    fallbackTo: "exa_contents",
    failureReason: "cloudflare_markdown_failure",
    retrieve: retrieveFromCloudflareAdapter,
  },
  {
    name: "exa_contents",
    failureReason: "exa_contents_failure",
    retrieve: retrieveFromExaAdapter,
  },
];

export async function retrieve(
  url: string,
  toolCallId: string,
): Promise<RetrievedContent> {
  const cached = getCachedFetch(url, Date.now());
  if (cached) return cached;

  for (const adapter of RETRIEVAL_ADAPTERS) {
    const result = await adapter.retrieve(url, toolCallId);
    if (result) return cacheAndReturn(url, result);

    if (result === null && adapter.fallbackTo) {
      logFallback(
        toolCallId,
        url,
        adapter.name,
        adapter.fallbackTo,
        adapter.failureReason,
      );
    }
  }

  throw new Error("All retrieval tiers failed to provide content");
}
