import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { callExaSearch } from "./exa.ts";
import { callTavilySearch } from "./tavily.ts";
import type {
  ExaSearchResponse,
  SearchResult,
  TavilySearchResponse,
  TextToolResult,
} from "./types.ts";

function formatSearchResponse(data: ExaSearchResponse): string {
  const results = data.results ?? [];
  if (results.length === 0) {
    return "No results found.";
  }
  const sources = results
    .map((r, i) => `${i + 1}. [${r.title ?? "Untitled"}](${r.url ?? ""})`)
    .join("\n");
  const bestText =
    results
      .map((r) => r.highlights?.[0] ?? "")
      .filter(Boolean)
      .join("\n\n") || "No summary text available.";
  return `${bestText}\n\n**Sources:**\n${sources}`;
}

function toExaResults(data: ExaSearchResponse | null): SearchResult[] {
  return (data?.results ?? []).flatMap((result) => {
    if (!result.url) return [];
    return {
      title: result.title ?? "Untitled",
      url: result.url,
      snippet: result.highlights?.[0] ?? "No summary text available.",
      provider: "exa" as const,
    };
  });
}

function toTavilyResults(data: TavilySearchResponse | null): SearchResult[] {
  return (data?.results ?? []).flatMap((result) => {
    if (!result.url) return [];
    return {
      title: result.title ?? "Untitled",
      url: result.url,
      snippet: result.content ?? "No summary text available.",
      provider: "tavily" as const,
    };
  });
}

function mergeResults(
  exaResults: SearchResult[],
  tavilyResults: SearchResult[],
): SearchResult[] {
  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(exaResults.length, tavilyResults.length);

  for (let index = 0; index < maxLength; index += 1) {
    const pair = [exaResults[index], tavilyResults[index]];
    for (const result of pair) {
      if (!result) continue;
      const key = result.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(result);
    }
  }

  return merged;
}

function formatMergedResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No results found.";
  }

  return results
    .map(
      (result, index) =>
        `${index + 1}. [${result.title}](${result.url})\n   ${result.snippet}`,
    )
    .join("\n\n");
}

function searchFailed(): TextToolResult {
  return {
    content: [{ type: "text" as const, text: "Search failed" }],
    details: {},
    isError: true,
  };
}

function searchSucceeded(
  text: string,
  sourceCount: number,
  providers?: { exa: number; tavily: number },
): TextToolResult {
  return {
    content: [{ type: "text" as const, text }],
    details: providers ? { sourceCount, providers } : { sourceCount },
  };
}

async function runExaOnly(
  query: string,
  toolCallId: string,
): Promise<TextToolResult> {
  const data = await callExaSearch(query, toolCallId).catch(() => null);
  if (data == null) return searchFailed();
  return searchSucceeded(formatSearchResponse(data), data.results?.length ?? 0);
}

export async function executeWebSearch(
  _toolCallId: string,
  params: Record<string, unknown>,
): Promise<TextToolResult> {
  const { query } = params as { query: string };
  if (!query || query.trim() === "") {
    return {
      content: [
        { type: "text" as const, text: "A query is required for web_search." },
      ],
      details: {},
      isError: true,
    };
  }

  const trimmedQuery = query.trim();
  const hasExaApiKey = Boolean(process.env.EXA_API_KEY);
  const hasTavilyApiKey = Boolean(process.env.TAVILY_API_KEY);

  if (!hasTavilyApiKey) {
    return runExaOnly(trimmedQuery, _toolCallId);
  }

  if (!hasExaApiKey) {
    const tavilyData = await callTavilySearch(trimmedQuery, _toolCallId);
    const tavilyResults = toTavilyResults(tavilyData);
    if (tavilyResults.length === 0) return searchFailed();
    return searchSucceeded(
      formatMergedResults(tavilyResults),
      tavilyResults.length,
    );
  }

  const [exaSettled, tavilySettled] = await Promise.allSettled([
    callExaSearch(trimmedQuery, _toolCallId, 2),
    callTavilySearch(trimmedQuery, _toolCallId),
  ]);

  const exaData = exaSettled.status === "fulfilled" ? exaSettled.value : null;
  const tavilyData =
    tavilySettled.status === "fulfilled" ? tavilySettled.value : null;
  const exaResults = toExaResults(exaData);
  const tavilyResults = toTavilyResults(tavilyData);
  const mergedResults = mergeResults(exaResults, tavilyResults);

  if (mergedResults.length === 0) return searchFailed();

  const bothProvidersContributed =
    exaResults.length > 0 && tavilyResults.length > 0;

  return searchSucceeded(
    formatMergedResults(mergedResults),
    mergedResults.length,
    bothProvidersContributed
      ? { exa: exaResults.length, tavily: tavilyResults.length }
      : undefined,
  );
}

export function renderWebSearchCall(
  args: { query: string },
  theme: Theme,
): Text {
  return new Text(
    theme.fg("toolTitle", `web_search: `) + theme.fg("accent", args.query),
    0,
    0,
  );
}

export function renderWebSearchResult(
  result: AgentToolResult<Record<string, unknown>>,
  _options: unknown,
  theme: Theme,
): Text {
  const count = result.details["sourceCount"];
  if (typeof count === "number" && count > 0) {
    const providers = result.details["providers"];
    const label = count === 1 ? "source" : "sources";
    if (
      providers &&
      typeof providers === "object" &&
      "exa" in providers &&
      "tavily" in providers &&
      typeof providers.exa === "number" &&
      typeof providers.tavily === "number"
    ) {
      return new Text(
        theme.fg(
          "success",
          `${count} ${label} (${providers.exa} exa, ${providers.tavily} tavily)`,
        ),
        0,
        0,
      );
    }
    return new Text(theme.fg("success", `${count} ${label}`), 0, 0);
  }
  return new Text(theme.fg("warning", "search error"), 0, 0);
}
