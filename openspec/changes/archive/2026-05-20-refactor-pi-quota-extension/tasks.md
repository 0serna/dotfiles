## 1. Module Structure

- [x] 1.1 Create `dotfiles/pi/agent/extensions/quota/` with `index.ts`, `codex.ts`, `opencode.ts`, `status.ts`, and `cache.ts`.
- [x] 1.2 Move the existing combined quota extension entrypoint logic into `quota/index.ts` while keeping Pi lifecycle handlers and polling state there.
- [x] 1.3 Delete `dotfiles/pi/agent/extensions/codex-quota.ts` so Pi discovery cannot load duplicate quota extensions.

## 2. Provider and Cache Modules

- [x] 2.1 Move Codex auth loading, usage fetching, retry, and response normalization into `quota/codex.ts` without changing Codex data source or authentication behavior.
- [x] 2.2 Move OpenCode dashboard configuration, fetch, hydration parsing, and balance conversion into `quota/opencode.ts` without changing dashboard scraping behavior.
- [x] 2.3 Move cache read/write helpers into `quota/cache.ts` and rename the cache file to `/tmp/pi-quota-cache.json` without old-cache migration.

## 3. Status and Footer Integration

- [x] 3.1 Move shared quota types, provider result merging, reset formatting, provider labels, and status formatting into `quota/status.ts` with pure exports where practical.
- [x] 3.2 Rename the quota extension status key and logger identity to `quota`.
- [x] 3.3 Update OpenCode visible provider prefix from `GO` to `OC` while keeping Codex visible as `CODEX`.
- [x] 3.4 Update `dotfiles/pi/agent/extensions/footer.ts` to read `extStatuses.get("quota")` and exclude `quota` from the remaining extension statuses.

## 4. Verification

- [x] 4.1 Run `npm run check` and fix any ESLint, TypeScript, Fallow, or OpenSpec validation issues caused by the refactor.
- [x] 4.2 Verify the final tree has `dotfiles/pi/agent/extensions/quota/index.ts` and no `dotfiles/pi/agent/extensions/codex-quota.ts`.
