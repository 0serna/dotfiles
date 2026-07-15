import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { formatSize } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

import type { WebDetails, WebSurface } from "./ketch.js";

type ToolArgs = Record<string, unknown>;

type RenderContext = {
  isError?: boolean;
};

function argumentFor(surface: WebSurface, args: ToolArgs): string {
  const value = surface === "fetch" ? args.url : args.query;
  return typeof value === "string" ? value : "";
}

export function renderCall(surface: WebSurface, args: ToolArgs, theme: Theme) {
  const argument = argumentFor(surface, args);
  const refinement =
    surface === "code" && typeof args.language === "string"
      ? ` (${args.language})`
      : surface === "docs" && typeof args.library === "string"
        ? ` (${args.library})`
        : "";
  return new Text(
    theme.fg("toolTitle", theme.bold(`web_${surface} `)) +
      theme.fg("muted", argument) +
      theme.fg("dim", refinement),
    0,
    0,
  );
}

export function renderResult(
  result: AgentToolResult<WebDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
  context?: RenderContext,
) {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "Researching..."), 0, 0);
  }
  if (context?.isError) {
    return new Text(theme.fg("error", "Failed"), 0, 0);
  }

  const details = result.details;
  if (!details || typeof details.outputBytes !== "number") {
    return new Text(theme.fg("dim", "No summary"), 0, 0);
  }

  const summary =
    typeof details.resultCount === "number"
      ? `${details.resultCount} ${details.resultCount === 1 ? "result" : "results"}`
      : formatSize(details.outputBytes);
  const truncation = details.truncated ? " (truncated)" : "";
  return new Text(
    theme.fg("success", summary) + theme.fg("warning", truncation),
    0,
    0,
  );
}
