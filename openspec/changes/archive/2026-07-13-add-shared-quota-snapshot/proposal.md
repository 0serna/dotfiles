## Why

Quota data is currently fetched independently by session startup and `/quota`, while the footer has no current quota status. A user-scoped snapshot shared by concurrent Pi processes can provide a fresh, consistent source of quota observations without multiplying authenticated provider requests for every open session.

## What Changes

- Add one user-scoped aggregated quota snapshot containing every declared provider/account quota source.
- Add a centralized five-minute refresh cycle with cross-process request coalescing, two attempts per source, incremental source publication, and watcher-driven status updates.
- Preserve failed source observations for up to 30 minutes, expose degraded and expired states, and retain summarized failure metadata.
- Add an internal provider-adapter boundary so future quota providers can contribute source discovery and fetching without changing snapshot orchestration.
- Publish compact footer status through the existing `quota` status key, using active local sources and the agreed `Codex 80% R2 │ OpenCode(2) 75%` format.
- **BREAKING**: Make `/quota` read the latest snapshot immediately instead of issuing fresh provider requests; include source state, age, and summarized failures in its detailed output.
- Make OpenCode account selection consume the shared snapshot without blocking session startup, reevaluate blind fallback when observations arrive, and defer preventive account changes until Pi is fully idle.
- Share provider-confirmed quota exhaustion as source evidence while keeping active accounts, runtime API keys, rotations, and cooldowns local to each Pi runtime.

## Capabilities

### New Capabilities

- `shared-quota-snapshot`: User-scoped quota source discovery, refresh coordination, persistence, freshness states, cross-process observation, and provider adapters.

### Modified Capabilities

- `quota-command`: Change `/quota` to a read-only detailed projection of the latest shared snapshot.
- `quota-status`: Replace the obsolete compact formatting contract with the active-source percentage status and degraded/loading/error states.
- `pi-codex-usage-footer`: Align combined provider status, Codex banked reset visibility, provider isolation, and refresh behavior with the shared snapshot.
- `opencode-account-rotation`: Make startup and preventive account selection snapshot-driven and non-blocking while preserving runtime-local rotation state.

## Impact

- Affected extension code: `dotfiles/pi/agent/extensions/quota/` and its tests.
- Affected footer integration: the existing `quota` status consumed by `dotfiles/pi/agent/extensions/footer/index.ts`.
- New user-scoped state and coordination files under `XDG_STATE_HOME` or `~/.local/state/pi` with private permissions and atomic updates.
- Existing quota OpenSpec capabilities require reconciliation because their current formatting and `/quota` refresh requirements conflict with this change.
