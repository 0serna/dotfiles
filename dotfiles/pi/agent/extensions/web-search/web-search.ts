import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { callExaSearch } from "./exa.ts";
import { logWebToolEvent } from "./logger.ts";
import type { ExaSearchResponse, TextToolResult } from "./types.ts";

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
  const data = await callExaSearch(query.trim()).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    logWebToolEvent("web_search_fail", { query: query.trim(), error: msg });
    return null;
  });
  if (data == null) {
    return {
      content: [{ type: "text" as const, text: "Search failed" }],
      details: {},
      isError: true,
    };
  }
  const searchData = data as ExaSearchResponse;
  logWebToolEvent("web_search_success", {
    query: query.trim(),
    results: searchData.results?.length ?? 0,
  });
  return {
    content: [
      {
        type: "text" as const,
        text: formatSearchResponse(searchData),
      },
    ],
    details: { sourceCount: searchData.results?.length ?? 0 },
  };
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
    const label = count === 1 ? "source" : "sources";
    return new Text(theme.fg("success", `${count} ${label}`), 0, 0);
  }
  return new Text(theme.fg("warning", "search error"), 0, 0);
}
