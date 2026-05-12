## 1. Scaffolding

- [x] 1.1 Create the extension file at `dotfiles/pi/agent/extensions/web-tools.ts` with the default export function skeleton
- [x] 1.2 Verify the extension file is loadable by Pi (no TypeScript errors, imports resolve from Pi's runtime)

## 2. Configuration

- [x] 2.1 Read `EXA_API_KEY` from `process.env` at tool execution time
- [x] 2.2 Validate the key is present and return a clear error if missing

## 3. Exa HTTP API Client

- [x] 3.1 Implement a `callExaSearch` function that POSTs to `https://api.exa.ai/search` with the API key in the `x-api-key` header
- [x] 3.2 Support the search body fields: `query`, `type: "auto"`, `numResults`, `startPublishedDate` (for recency), `includeDomains`/`excludeDomains` (for domain filter), and `contents: { highlights: true, text: true }`
- [x] 3.3 Handle API errors (non-2xx, timeout, malformed response) with descriptive messages

## 4. Web Search Tool

- [x] 4.1 Register `web_search` with parameters: `query` (required string), `numResults` (optional number), `recencyFilter` (optional enum), `domainFilter` (optional string array)
- [x] 4.2 Map `recencyFilter` to `startPublishedDate` by computing the date offset
- [x] 4.3 Map `domainFilter` to `includeDomains`/`excludeDomains`
- [x] 4.4 Format the Exa search response into a synthesized answer with source citations (title + URL)
- [x] 4.5 Validate empty query and return appropriate error

## 5. HTTP Fallback Extraction

- [x] 5.1 Implement an `extractViaHttp(url)` function that fetches the URL with a browser-like User-Agent
- [x] 5.2 Parse HTML with `linkedom`, extract readable content with `@mozilla/readability`, convert to markdown with `turndown`
- [x] 5.3 Handle non-2xx responses, connection failures, and timeouts

## 6. Web Fetch Tool

- [x] 6.1 Register `web_fetch` with parameter: `url` (required string)
- [x] 6.2 Attempt content retrieval via Exa `contents` endpoint first
- [x] 6.3 If Exa returns insufficient content, fall back to the HTTP extraction function
- [x] 6.4 Return extracted content as markdown with a title, or a descriptive error

## 7. Tool Registration Wiring

- [x] 7.1 Wire both tools in the default extension export using Pi's `registerTool` API with TypeBox schemas
- [x] 7.2 Add prompt snippets for both tools
- [x] 7.3 Ensure `EXA_API_KEY` is read fresh at each tool call (not cached across calls)

## 8. Validation

- [x] 8.1 Verify `web_search` returns synthesized answers with sources for a sample query
- [x] 8.2 Verify `web_fetch` returns extracted content for a reachable URL
- [x] 8.3 Verify `web_fetch` fallback works when Exa content is unavailable
- [x] 8.4 Verify error messages for missing API key, invalid URLs, and network failures
- [x] 8.5 Run Pi's extension validation to confirm the file loads without errors
