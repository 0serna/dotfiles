## 1. Data Model and Naming

- [x] 1.1 Rename internal quota status identifiers from Codex-specific names to `usage-quota` where they affect status key, cache file, and logger name.
- [x] 1.2 Replace the single-provider status shape with a combined status model that can represent Codex data, OpenCode Go data, and per-provider error states independently.
- [x] 1.3 Preserve existing Codex status fields and cached-data behavior while adding OpenCode Go rolling, weekly, monthly, and balance fields.

## 2. OpenCode Go Dashboard Fetching

- [x] 2.1 Read `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE` from `process.env` and treat OpenCode Go as unconfigured unless both are present.
- [x] 2.2 Add an authenticated dashboard fetch for `https://opencode.ai/workspace/{workspaceId}/go` using the configured `auth` cookie and the existing request timeout policy.
- [x] 2.3 Parse `rollingUsage`, `weeklyUsage`, and `monthlyUsage` from the dashboard hydration HTML, accepting field-order variation for `usagePercent` and `resetInSec`.
- [x] 2.4 Parse OpenCode Go billing balance from the dashboard hydration HTML and convert it to a display dollar amount.
- [x] 2.5 Return structured OpenCode Go results with remaining percentages, reset timestamps or reset durations, balance, and parse/fetch errors.

## 3. Refresh Orchestration

- [x] 3.1 Refactor the existing Codex fetch path so it returns a provider-specific success or error result without throwing away the other provider's data.
- [x] 3.2 Fetch Codex and OpenCode Go quota data in parallel during refresh.
- [x] 3.3 Merge provider results into the combined status while preserving successful provider data when the other provider fails.
- [x] 3.4 Persist and restore the combined status cache from `/tmp/pi-usage-quota-cache.json`.

## 4. Footer Formatting

- [x] 4.1 Add provider-prefixed formatting for the Codex quota group.
- [x] 4.2 Add provider-prefixed formatting for OpenCode Go rolling, weekly, monthly, and dollar balance segments.
- [x] 4.3 Format OpenCode Go windows as remaining percentages with compact reset labels derived from dashboard reset durations.
- [x] 4.4 Display compact provider error indicators when Codex or OpenCode Go cannot provide current data.
- [x] 4.5 Keep unavailable optional segments omitted rather than displaying invented values.

## 5. Verification

- [ ] 5.1 Add or update tests for Codex-only formatting to ensure existing behavior is preserved under the combined status model.
- [ ] 5.2 Add tests for OpenCode Go hydration parsing, including all three windows, field-order variation, missing windows, and balance conversion.
- [ ] 5.3 Add tests for combined status formatting with both providers, single-provider failure, missing Go configuration, and unavailable balance.
- [x] 5.4 Run the repository quality gate with `npm run check`.
