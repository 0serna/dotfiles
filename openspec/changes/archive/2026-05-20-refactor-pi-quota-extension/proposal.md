## Why

The Pi quota extension has grown into a multi-provider footer implementation while still living in a single `codex-quota.ts` file with Codex-specific naming. Refactoring it into a directory-based `quota` extension will make the implementation easier to maintain and align names with the combined quota behavior.

## What Changes

- Replace the single-file `dotfiles/pi/agent/extensions/codex-quota.ts` extension with a directory-based Pi extension at `dotfiles/pi/agent/extensions/quota/index.ts`.
- Split provider, cache, status formatting, and runtime wiring responsibilities across compact internal modules.
- Rename internal and integration identifiers from `usage-quota`/Codex-specific names to `quota`, including status key, logger name, and cache file.
- Update the custom Pi footer integration to read and exclude the `quota` extension status key.
- Rename the visible OpenCode provider prefix from `GO` to `OC` while preserving the combined quota footer behavior.
- Remove the old `codex-quota.ts` entrypoint so Pi does not auto-discover and load duplicate quota extensions.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-codex-usage-footer`: Updates the combined quota footer implementation identity and visible OpenCode provider prefix without changing the underlying quota data sources.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/codex-quota.ts`, new `dotfiles/pi/agent/extensions/quota/` modules, and `dotfiles/pi/agent/extensions/footer.ts`.
- Runtime discovery: Pi will load `extensions/quota/index.ts` via supported subdirectory extension discovery.
- Local state: cache moves to `/tmp/pi-quota-cache.json` with no migration from `/tmp/pi-usage-quota-cache.json`.
- Logs: quota extension diagnostics move to `~/.local/state/pi/quota.log`.
