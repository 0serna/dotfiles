## Context

The repository previously carried a provider-specific `web` extension, but it was removed along with its living specifications. The replacement integrates the independently installed Ketch CLI, whose four relevant commands already own provider selection, credentials, browser behavior, cookies, caching, and network access.

Pi extensions load before `session_start`, custom tools execute in parallel by default, and tool results must remain bounded to 50 KB or 2,000 lines. Ketch emits structured JSON on stdout, warnings on stderr, and differentiated exit codes. The extension must preserve those contracts without exposing Ketch's operational configuration to the model.

## Goals / Non-Goals

**Goals:**

- Expose four intent-specific web research surfaces through small, stable Pi tool interfaces.
- Keep Ketch configuration operator-owned and invisible in tool parameters.
- Preserve successful Ketch JSON while providing cancellation, bounded output, compact rendering, structured diagnostics, and actionable prerequisite notifications.
- Keep registration and behavior deterministic when Ketch is absent.
- Make all extension logic testable without Ketch or network access.

**Non-Goals:**

- Install, update, configure, or pin a Ketch version.
- Reimplement Ketch providers, scraping, caching, browser automation, or credential management.
- Expose backend selection, cookies, raw HTML, CSS selectors, cache controls, browser forcing, regex code search, or combined search-and-scrape.
- Provide an MCP transport or a persistent Ketch process.
- Validate `web_fetch` URLs beyond the TypeBox string contract; Ketch remains authoritative for scrape input handling.

## Decisions

### Use one stateless CLI process per tool call

The extension will call `pi.exec("ketch", args, { cwd: homedir(), signal })` with argument arrays and no shell. It will not add a timeout because Ketch already bounds HTTP and federated-backend requests, while Pi's abort signal supports user cancellation. Calls remain parallel; cache-lock contention may disable caching for one process but does not change correctness.

A persistent `ketch mcp serve` process was rejected because it adds lifecycle management and can hold Ketch's single-process page-cache lock. Importing Ketch's Go implementation is not viable from the TypeScript extension.

### Register tools only when Ketch is available

The async extension factory will probe `ketch version` once. A successful probe registers all four tools. A failed probe registers none and installs a `session_start` handler that uses `ctx.ui.notify` when `ctx.hasUI` is true. Non-UI modes remain silent. Installing Ketch followed by `/reload` reruns the factory and enables the tools.

This is preferred over registering tools that always fail because unavailable capabilities should not be advertised to the model. No minimum or exact version is enforced; command execution and JSON syntax are the compatibility check.

### Expose curated, intent-specific tool interfaces

- `web_search`: `query` plus optional `limit` from 1 to 10, defaulting to 5. It always uses federated search (`--multi`) and never scrapes result pages.
- `web_fetch`: `url` only. It always disables bare-domain `/llms.txt` substitution with `--no-llms-txt`.
- `web_code`: `query`, optional `language`, and optional `limit` from 1 to 10, defaulting to 5. It uses Ketch's GitHub backend because grep.app proved unreliable for agent-generated multi-term queries; regex remains omitted.
- `web_docs`: `query` and optional library name or Context7 `library` ID. Ordinary names are folded into the query for Ketch resolution; exact IDs are forwarded with `--library` for explicit selection.

Queries are trimmed and rejected as `[validation]` when empty. Backend selection and all operator configuration remain outside the tool schemas; the extension owns the fixed GitHub choice for code search. Prompt snippets and guidelines distinguish discovery, known-URL reading, public OSS usage, and library documentation.

Mirroring every Ketch flag was rejected because it would create a shallow adapter coupled to CLI churn. Query/URL-only interfaces were rejected where a small bound or language/library refinement materially improves research quality.

### Preserve stdout as JSON and treat stderr as diagnostics

Every research command receives `--json`. On exit code 0, the runner verifies only that stdout parses as JSON; it does not enforce command-specific response schemas. The original successful JSON text is returned to the model, while tolerant inspection derives small `details` metadata for rendering. Stderr, including partial federated-search warnings, is logged but never mixed into successful content.

Strict schema validation was rejected to avoid breaking on additive Ketch output changes. Reformatting results as Markdown was rejected because the chosen contract is structured Ketch JSON.

### Bound oversized output with Pi's standard truncation contract

The runner applies Pi's 50 KB and 2,000-line head truncation after receiving and validating the complete JSON. If truncated, it writes the full output through `shared/temp-output.ts` using private permissions and appends a notice with the path. The visible prefix may no longer be valid JSON; this deliberate trade-off preserves the largest useful prefix and a route to the exact full response without imposing Ketch `--max-chars`.

`details` stores only small metrics such as surface, result count, output bytes, title/library when available, truncation state, and full-output path. It never stores stdout, stderr, snippets, or page content.

### Preserve Ketch's error taxonomy and add integration failures

Nonzero exits map as follows: 2 `[validation]`, 3 `[not_found]`, 4 `[upstream]`, 5 `[precondition]`, and 6 `[cancelled]`. Exit 1, successful commands with empty or invalid JSON, and other adapter failures use `[internal]`. A process killed by Pi is `[cancelled]`.

Tool execution throws classified errors so Pi records `isError: true`. `[precondition]` and `[internal]` also issue a short actionable `ctx.ui.notify` when UI is available; complete diagnostics remain in the log. Other failures rely on normal tool-error presentation.

### Centralize orchestration behind a Ketch runner

The extension uses four focused modules:

- `index.ts`: availability probe, lifecycle-bound logger setup, tool registration, and prompt metadata.
- `tools.ts`: TypeBox schemas, query normalization, Ketch argument construction, and execute adapters.
- `ketch.ts`: subprocess execution, JSON validation, classification, truncation, temp output, details extraction, logging, and notifications.
- `rendering.ts`: compact call and result renderers that never display full JSON.

The runner accepts an execution dependency so tests can use a fake. This seam concentrates process and output behavior while keeping tool declarations small.

### Log structured outcomes with user inputs

The extension uses `createExtensionLogger(ctx, "web")`, producing `~/.local/state/pi/web.log`. Entries include tool name, complete query or URL, optional language/library, duration, exit code, result counts, stderr diagnostics, truncation metadata, and classified failures. Logs never contain stdout, snippets, markdown, cookies, credentials, or effective Ketch configuration.

## Risks / Trade-offs

- **[Risk] Ketch output changes without a version gate** → Validate JSON syntax, keep result inspection tolerant, and classify malformed output as `[internal]` with diagnostics.
- **[Risk] Truncated content is no longer valid JSON** → State truncation explicitly and save the exact response to a private temp file whose path is returned.
- **[Risk] Queries and URLs in persistent logs may be sensitive** → This is an accepted operator choice; exclude response content, credentials, cookies, and configuration.
- **[Risk] Parallel Ketch processes contend for the page-cache lock** → Accept uncached fallback because Ketch preserves correctness; avoid serializing unrelated research.
- **[Risk] `web_fetch` delegates scrape-input autodetection despite advertising a URL** → Keep the documented interface URL-focused and avoid extra validation for improbable non-URL inputs.
- **[Risk] No tools or explanation appear in non-UI mode when Ketch is absent** → This is an accepted contract; interactive sessions receive the actionable notification.
- **[Risk] Context7 automatic resolution may choose the wrong library** → Let the agent provide an ordinary library name to improve resolution or pin a known Context7 ID when correctness requires it.

## Migration Plan

1. Add the extension and deterministic tests without restoring any removed provider-specific code or specs.
2. Install and configure Ketch separately on machines that should expose the tools.
3. Reload Pi so the availability probe registers the tools.
4. Roll back by removing the `web/` extension directory; no persistent extension state or configuration migration is required.

## Open Questions

None.
