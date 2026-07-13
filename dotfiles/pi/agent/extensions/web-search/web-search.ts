import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { callExaSearch } from "./exa.ts";
import { callFirecrawlSearch } from "./firecrawl.ts";
import { callTavilySearch } from "./tavily.ts";
import type {
  ExaSearchResponse,
  FirecrawlSearchResponse,
  SearchResult,
  TavilySearchResponse,
  TextToolResult,
} from "./types.ts";

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

function toFirecrawlResults(
  data: FirecrawlSearchResponse | null,
): SearchResult[] {
  return (data?.data?.web ?? []).flatMap((entry) => {
    if (!entry.url) return [];
    return {
      title: entry.title ?? "Untitled",
      url: entry.url,
      snippet:
        entry.description ?? entry.markdown ?? "No summary text available.",
      provider: "firecrawl" as const,
    };
  });
}

function mergeResults(providerResults: SearchResult[][]): SearchResult[] {
  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(
    ...providerResults.map((results) => results.length),
  );

  for (let index = 0; index < maxLength; index += 1) {
    for (const results of providerResults) {
      const result = results[index];
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

function throwSearchFailed(): never {
  throw new Error("Search failed");
}

function searchSucceeded(
  text: string,
  sourceCount: number,
  providerCounts?: Record<string, number>,
): TextToolResult {
  return {
    content: [{ type: "text" as const, text }],
    details: providerCounts
      ? { sourceCount, providers: providerCounts }
      : { sourceCount },
  };
}

export async function executeWebSearch(
  _toolCallId: string,
  params: Record<string, unknown>,
): Promise<TextToolResult> {
  const { query } = params as { query: string };
  if (!query || query.trim() === "") {
    throw new Error("A query is required for web_search.");
  }

  const trimmedQuery = query.trim();
  const hasExaApiKey = Boolean(process.env.EXA_API_KEY);
  const hasTavilyApiKey = Boolean(process.env.TAVILY_API_KEY);

  // Firecrawl is always eligible (keyless or authenticated).
  const eligible: Array<"exa" | "tavily" | "firecrawl"> = ["firecrawl"];
  if (hasTavilyApiKey) eligible.unshift("tavily" as const);
  if (hasExaApiKey) eligible.unshift("exa" as const);

  const settled = await Promise.allSettled(
    eligible.map((provider) => {
      switch (provider) {
        case "exa":
          return callExaSearch(trimmedQuery, _toolCallId, 2);
        case "tavily":
          return callTavilySearch(trimmedQuery, _toolCallId);
        case "firecrawl":
          return callFirecrawlSearch(trimmedQuery, _toolCallId);
      }
    }),
  );

  // Map to SearchResult[] in provider order
  const allGroups: SearchResult[][] = [];
  const providerCounts: Record<string, number> = {};

  for (let i = 0; i < eligible.length; i += 1) {
    const provider = eligible[i]!;
    const s = settled[i]!;
    const data = s.status === "fulfilled" ? s.value : null;
    let group: SearchResult[];
    switch (provider) {
      case "exa":
        group = toExaResults(data as ExaSearchResponse | null);
        break;
      case "tavily":
        group = toTavilyResults(data as TavilySearchResponse | null);
        break;
      case "firecrawl":
        group = toFirecrawlResults(data as FirecrawlSearchResponse | null);
        break;
    }
    allGroups.push(group);
    providerCounts[provider] = group.length;
  }

  const mergedResults = mergeResults(allGroups);

  if (mergedResults.length === 0) throwSearchFailed();

  // Only include provider breakdown when at least two contributed.
  const contributing = Object.entries(providerCounts).filter(
    ([, count]) => count > 0,
  );
  const multiProvider =
    contributing.length > 1
      ? (Object.fromEntries(contributing) as Record<string, number>)
      : undefined;

  return searchSucceeded(
    formatMergedResults(mergedResults),
    mergedResults.length,
    multiProvider,
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
    if (providers && typeof providers === "object") {
      const parts: string[] = [];
      const p = providers as Record<string, number>;
      for (const [name, c] of Object.entries(p)) {
        if (typeof c === "number" && c > 0) {
          parts.push(`${c} ${name}`);
        }
      }
      if (parts.length > 1) {
        return new Text(
          theme.fg("success", `${count} ${label} (${parts.join(", ")})`),
          0,
          0,
        );
      }
    }
    return new Text(theme.fg("success", `${count} ${label}`), 0, 0);
  }
  return new Text(theme.fg("warning", "search error"), 0, 0);
}
