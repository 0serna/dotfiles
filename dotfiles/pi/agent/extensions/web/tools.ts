import type {
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { Type, type Static, type TSchema } from "typebox";

import type { KetchRunner, WebDetails, WebSurface } from "./ketch.js";
import { renderCall, renderResult } from "./rendering.js";

const limitSchema = Type.Optional(
  Type.Integer({
    description: "Maximum results to return (1-10; default 5)",
    minimum: 1,
    maximum: 10,
    default: 5,
  }),
);

export const WebSearchParams = Type.Object({
  query: Type.String({ description: "Topic or question to search for" }),
  limit: limitSchema,
});

export const WebFetchParams = Type.Object({
  url: Type.String({ description: "Absolute URL of the page to retrieve" }),
});

export const WebCodeParams = Type.Object({
  query: Type.String({
    description: "Terms or exact code text to find in public repositories",
  }),
  language: Type.Optional(
    Type.String({ description: "Programming language to filter by" }),
  ),
  limit: limitSchema,
});

export const WebDocsParams = Type.Object({
  query: Type.String({ description: "Documentation topic, API, or question" }),
  library: Type.Optional(
    Type.String({
      description:
        "Library or framework name; use an exact /owner/project ID when known",
    }),
  ),
});

export type WebSearchInput = Static<typeof WebSearchParams>;
export type WebFetchInput = Static<typeof WebFetchParams>;
export type WebCodeInput = Static<typeof WebCodeParams>;
export type WebDocsInput = Static<typeof WebDocsParams>;

function normalizedQuery(query: string): string {
  const normalized = query.trim();
  if (normalized === "") {
    throw new Error("[validation] query must not be blank");
  }
  return normalized;
}

function resultLimit(limit: number | undefined): string {
  return String(limit ?? 5);
}

export function buildSearchArgs(input: WebSearchInput): string[] {
  return [
    "search",
    normalizedQuery(input.query),
    "--multi",
    "--limit",
    resultLimit(input.limit),
    "--json",
  ];
}

export function buildFetchArgs(input: WebFetchInput): string[] {
  return ["scrape", input.url, "--no-llms-txt", "--json"];
}

export function buildCodeArgs(input: WebCodeInput): string[] {
  const args = ["code", normalizedQuery(input.query), "--backend", "github"];
  const language = input.language?.trim();
  if (language) args.push("--lang", language);
  args.push("--limit", resultLimit(input.limit), "--json");
  return args;
}

export function buildDocsArgs(input: WebDocsInput): string[] {
  const query = normalizedQuery(input.query);
  const library = input.library?.trim();
  const context7Id = /^\/[^/\s]+\/[^/\s]+(?:\/[^/\s]+)*$/;

  if (!library) return ["docs", query, "--json"];
  if (context7Id.test(library)) {
    return ["docs", query, "--library", library, "--json"];
  }

  return ["docs", `${library} ${query}`, "--json"];
}

type Runner = Pick<KetchRunner, "run">;

function createTool<S extends TSchema>(
  runner: Runner,
  opts: {
    surface: WebSurface;
    label: string;
    description: string;
    promptSnippet: string;
    promptGuidelines: string[];
    parameters: S;
    buildArgs: (input: Static<S>) => string[];
  },
) {
  return {
    name: `web_${opts.surface}`,
    label: opts.label,
    description: opts.description,
    promptSnippet: opts.promptSnippet,
    promptGuidelines: opts.promptGuidelines,
    parameters: opts.parameters,
    async execute(
      _toolCallId: string,
      params: Static<S>,
      signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ) {
      return runner.run(
        {
          surface: opts.surface,
          input: params,
          args: opts.buildArgs(params),
          cwd: homedir(),
        },
        signal,
        ctx,
      );
    },
    renderCall: (args: Static<S>, theme: Parameters<typeof renderCall>[2]) =>
      renderCall(opts.surface, args, theme),
    renderResult,
  } satisfies ToolDefinition<S, WebDetails>;
}

export function createToolDefinitions(runner: Runner) {
  return [
    createTool(runner, {
      surface: "search",
      label: "Web Search",
      description:
        "Search the web for relevant pages, summaries, and available excerpts.",
      promptSnippet: "Discover relevant pages across the web",
      promptGuidelines: [
        "Use web_search for web discovery when the relevant URL is not already known.",
      ],
      parameters: WebSearchParams,
      buildArgs: buildSearchArgs,
    }),
    createTool(runner, {
      surface: "fetch",
      label: "Web Fetch",
      description:
        "Retrieve a known URL and extract its readable page content.",
      promptSnippet: "Read content from a known URL",
      promptGuidelines: [
        "Use web_fetch to read a known URL; use web_search first when discovery is needed.",
      ],
      parameters: WebFetchParams,
      buildArgs: buildFetchArgs,
    }),
    createTool(runner, {
      surface: "code",
      label: "Web Code",
      description:
        "Search public open-source repositories for real usage and implementation examples.",
      promptSnippet: "Find public open-source usage examples",
      promptGuidelines: [
        "Use web_code when real project usage or implementation examples would answer the question.",
        "Prefer concise identifiers or API names over natural-language questions.",
      ],
      parameters: WebCodeParams,
      buildArgs: buildCodeArgs,
    }),
    createTool(runner, {
      surface: "docs",
      label: "Web Docs",
      description:
        "Search library and framework documentation for relevant API guidance and examples.",
      promptSnippet: "Look up library documentation",
      promptGuidelines: [
        "Use web_docs for library APIs and framework-specific guidance; use web_code for real project usage.",
        "Set library when it helps disambiguation; ordinary names are resolved automatically, while exact IDs start with /.",
      ],
      parameters: WebDocsParams,
      buildArgs: buildDocsArgs,
    }),
  ] satisfies [
    ToolDefinition<typeof WebSearchParams, WebDetails>,
    ToolDefinition<typeof WebFetchParams, WebDetails>,
    ToolDefinition<typeof WebCodeParams, WebDetails>,
    ToolDefinition<typeof WebDocsParams, WebDetails>,
  ];
}
