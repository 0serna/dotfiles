## REMOVED Requirements

### Requirement: Pi footer displays compact Codex quota headroom

**Reason**: The provider-specific `R(...)`/`W(...)` formatting is replaced by the unified compact active-source contract.

**Migration**: `quota-status` now defines Codex as `Codex <rolling>% R<n>` or `Codex 0% R<n>`.

### Requirement: Codex quota footer uses remaining values

**Reason**: Remaining-value normalization and compact balance omission now apply to every adapter and projection, not a Codex-only footer implementation.

**Migration**: `shared-quota-snapshot` owns normalized observations and `quota-status` owns compact rendering.

### Requirement: Codex quota footer remains visible independently of active provider

**Reason**: Visibility is now defined generically as one active quota source per configured provider.

**Migration**: `quota-status` publishes one combined `quota` status independently of the selected model.

### Requirement: Codex quota footer reports missing Pi authentication

**Reason**: Missing authentication is now an unavailable quota-source state whose detailed cause belongs in `/quota`, while compact status remains generic.

**Migration**: `shared-quota-snapshot` records the unavailable source and compact status shows `Codex error`.

### Requirement: Codex quota footer preserves cached data after transient fetch failures

**Reason**: Last-known-data retention is now a provider-neutral snapshot rule with a 30-minute usability boundary.

**Migration**: `shared-quota-snapshot` defines degraded and expired source observations.

### Requirement: Pi footer displays OpenCode Go usage quota headroom

**Reason**: Labeled multi-window OpenCode formatting is replaced by the unified active-source percentage format.

**Migration**: `quota-status` displays `OpenCode(<account>) <rolling>%` or `0%` when any window is exhausted.

### Requirement: Pi footer displays OpenCode Go dollar balance

**Reason**: Spendable balances are intentionally removed from compact status.

**Migration**: `/quota` detail remains the only UI projection that displays OpenCode dollar balances.

### Requirement: OpenCode Go quota footer uses dashboard cookie configuration

**Reason**: Fetch eligibility and missing configuration are now modeled by provider adapters and unavailable source state.

**Migration**: `shared-quota-snapshot` defines declared sources, configuration checks, and no-fetch behavior for unavailable sources.

### Requirement: Combined usage quota footer preserves provider isolation

**Reason**: Isolation is now enforced at finer quota-source granularity, including individual provider accounts.

**Migration**: `shared-quota-snapshot` publishes each source independently and `quota-status` projects active sources.

### Requirement: Combined usage quota footer fetches providers independently

**Reason**: Fetch concurrency and incremental publication now belong to the centralized refresh coordinator rather than the footer.

**Migration**: `shared-quota-snapshot` starts sources independently and commits each result as it resolves.

### Requirement: Combined quota footer uses a single quota extension status

**Reason**: The requirement is moved to the canonical compact-status capability.

**Migration**: `quota-status` defines publication through the single `quota` status key.

### Requirement: Codex quota footer compact status rules for reset credits

**Reason**: Reset credits are no longer conditional on exhausted windows; Codex always exposes their known or unknown state compactly.

**Migration**: `quota-status` defines `R<n>`, confirmed `R0`, and unavailable `R?` for every Codex compact state.
