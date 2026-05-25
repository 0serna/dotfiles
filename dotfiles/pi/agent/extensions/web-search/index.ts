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
    description: "Search the web. Returns a synthesized answer with sources.",
    promptSnippet: "Search the web and return synthesized answers with sources",
    promptGuidelines: [
      "Use web_search when you need to search the web for current information.",
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
    description: "Fetch and extract readable content from a single URL.",
    promptSnippet: "Fetch a URL and extract its readable content",
    promptGuidelines: [
      "Use web_fetch when you need to read or extract the content of a specific URL.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
    }),
    execute: executeWebFetch,
    renderCall: renderWebFetchCall,
    renderResult: renderWebFetchResult,
  });
}
