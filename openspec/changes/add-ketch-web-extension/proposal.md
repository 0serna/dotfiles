## Why

Pi currently lacks dedicated external research tools after removal of the previous web extension. Ketch already provides stateless web search, URL scraping, public code search, and library documentation lookup, so a thin Pi integration can restore those capabilities without maintaining provider-specific clients.

## What Changes

- Add a global Pi extension named `web` that conditionally registers four read-only tools when the `ketch` binary is available: `web_search`, `web_fetch`, `web_code`, and `web_docs`.
- Give each tool a curated interface, use Ketch's GitHub backend for reliable code search, and keep credentials, browser setup, cookies, and caching under Ketch configuration.
- Execute Ketch as cancellable subprocesses, preserve successful JSON output, bound oversized results, and map Ketch exit codes to stable tool error classes.
- Add compact TUI rendering, operator notifications for unavailable prerequisites or internal integration failures, and structured JSONL diagnostics in `web.log`.
- Add deterministic regression coverage using fake command execution rather than live network calls or a required Ketch installation.

## Capabilities

### New Capabilities

- `pi-web-research`: Read-only web discovery, known-URL retrieval, public source-code search, and library documentation lookup through a Ketch-backed Pi extension.

### Modified Capabilities

None.

## Impact

- New extension files under `dotfiles/pi/agent/extensions/web/` and focused Vitest coverage under its `tests/` directory.
- Reuses Pi extension APIs, TypeBox, the shared extension logger, and shared temporary-output utilities; no new npm runtime dependency is required.
- Requires an independently installed `ketch` executable at runtime. The extension remains unloaded as a tool provider when the binary is unavailable.
- Adds external network access through the backends and local settings already managed by Ketch.
