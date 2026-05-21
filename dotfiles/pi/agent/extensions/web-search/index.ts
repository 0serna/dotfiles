import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { configureWebToolsLogger } from "./logger.ts";
import {
  executeWebFetch,
  renderWebFetchCall,
  renderWebFetchResult,
} from "./web-fetch.ts";
import {
  executeWebSearch,
  renderWebSearchCall,
  renderWebSearchResult,
} from "./web-search.ts";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    configureWebToolsLogger(ctx);
  });

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web using the Exa API. Returns an AI-synthesized answer with source citations (title + URL).",
    promptSnippet: "Search the web and return synthesized answers with sources",
    promptGuidelines: [
      "Use web_search when the user asks a factual question that benefits from up-to-date web results.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
    }),
    execute: executeWebSearch,
    renderCall: renderWebSearchCall,
    renderResult: renderWebSearchResult,
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch and extract readable content from a single URL. Attempts Exa-assisted retrieval first; falls back to HTTP+Readability extraction.",
    promptSnippet: "Fetch a URL and extract its readable content as markdown",
    promptGuidelines: [
      "Use web_fetch when the user wants to read the content of a specific web page.",
      "web_fetch returns markdown-formatted content with the page title.",
      "For JS-heavy pages the HTTP fallback extraction may not capture dynamic content.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
    }),
    execute: executeWebFetch,
    renderCall: renderWebFetchCall,
    renderResult: renderWebFetchResult,
  });
}
