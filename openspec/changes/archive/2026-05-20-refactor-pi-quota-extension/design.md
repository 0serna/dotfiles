## Context

`dotfiles/pi/agent/extensions/codex-quota.ts` is now a combined quota footer extension for Codex and OpenCode usage. The file is large and mixes Pi lifecycle wiring, mutable runtime state, cache persistence, Codex API access, OpenCode dashboard scraping, HTML parsing, status merging, and footer formatting. Pi supports auto-discovered extension subdirectories with `extensions/*/index.ts`, so the extension can be renamed and split without changing the managed dotfiles link layout.

The custom footer extension currently reads the quota status from the `usage-quota` extension status key. A full rename to `quota` therefore includes both the quota extension and the footer integration.

## Goals / Non-Goals

**Goals:**

- Replace the single `codex-quota.ts` entrypoint with `extensions/quota/index.ts`.
- Keep the module layout compact: `index.ts`, `codex.ts`, `opencode.ts`, `status.ts`, and `cache.ts`.
- Keep mutable Pi runtime state and polling orchestration in `index.ts`.
- Keep provider fetching/parsing, cache, status merging, and formatting helpers in focused modules with pure exports where practical.
- Rename extension identity surfaces from `usage-quota` to `quota`, including footer status key, logger name, and cache file.
- Preserve current combined quota behavior while changing the OpenCode visible prefix to `OC`.
- Remove the old `codex-quota.ts` file so Pi discovery loads only one quota extension.

**Non-Goals:**

- Do not change quota data sources, polling cadence, request timeout, or provider authentication strategy.
- Do not add new runtime dependencies.
- Do not migrate old `/tmp/pi-usage-quota-cache.json` data.
- Do not replace OpenCode dashboard scraping with a new API.
- Do not expand the refactor into unrelated footer, logger, or model-routing changes.

## Decisions

### Use `quota/` as the directory extension name

Pi discovers `extensions/*/index.ts` and does not require a top-level `.ts` file. The refactor will create `dotfiles/pi/agent/extensions/quota/index.ts` and delete `codex-quota.ts`.

Alternatives considered:

- Keep `codex-quota.ts` as a shim: rejected because Pi would auto-discover both entrypoints and load duplicate quota extensions.
- Use `usage-quota/`: rejected because the desired final identity is the shorter `quota` name.

### Keep a compact five-file module split

The module boundary will be:

- `index.ts`: Pi entrypoint, event handlers, mutable context/status state, polling, refresh orchestration calls.
- `codex.ts`: Codex auth loading, usage fetch, retry behavior, and response normalization.
- `opencode.ts`: OpenCode dashboard configuration, fetch, hydration parsing, and balance conversion.
- `status.ts`: shared quota types, provider result merging, reset/status formatting, and provider labels.
- `cache.ts`: read/write of `/tmp/pi-quota-cache.json`.

Alternatives considered:

- More granular files such as `types.ts`, `formatting.ts`, and `refresh.ts`: rejected as more structure than the current scope needs.
- A single `providers.ts`: rejected because it would mix Codex and OpenCode concerns again.

### Rename all quota identity surfaces consistently

The extension will use `quota` for its Pi status key, shared logger name, and cache file stem. `footer.ts` will read `extStatuses.get("quota")` and exclude `quota` from the left-side extension status list.

Alternatives considered:

- Keep `usage-quota` as the status key only: rejected because it leaves mixed naming after the rename.
- Keep the old cache filename: rejected because the cache is temporary and does not justify compatibility naming.

### Preserve cache behavior without migration

The extension will continue to cache the last combined quota status and publish it on session start before the first fresh refresh completes. The cache file will move to `/tmp/pi-quota-cache.json`, with no fallback read from the old file.

Alternatives considered:

- Remove cache entirely: rejected because it would delay first footer display until network requests complete.
- Migrate or read the old cache: rejected because `/tmp` cache data is ephemeral.

### Export pure helpers for future tests

Provider parsing, balance conversion, status merging, and formatting helpers should be exported where useful so tests can exercise them without mocking the Pi extension runtime.

Alternatives considered:

- Test only through the extension entrypoint: rejected because Pi UI/runtime mocking would obscure the pure behavior.

## Risks / Trade-offs

- Status key rename missed in `footer.ts` → The quota status would stop appearing in the right side of the custom footer. Mitigation: include footer integration in tasks and verification.
- Duplicate extension loading if old file remains → Two quota pollers/status publishers could run. Mitigation: delete `codex-quota.ts` as part of the refactor.
- Import path issues after moving into a subdirectory → Relative imports to shared logger need updating. Mitigation: verify with the repository quality gate.
- OpenCode filename is broader than OpenCode Go → The module name is intentionally compact; its exported names should still make Go-specific data clear where needed.
