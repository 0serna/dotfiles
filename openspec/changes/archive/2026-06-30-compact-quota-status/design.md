## Context

The quota extension currently publishes a single footer status that combines OpenCode Go and Codex quota data. The formatter displays all complete OpenCode windows, both Codex windows, and available balances/reset credits, which makes the right side of the footer wide even when most values are healthy.

The existing implementation already has a low-quota threshold and warning behavior. The change can reuse that threshold while changing which segments are displayed and how they are labeled.

## Goals / Non-Goals

**Goals:**

- Make the combined quota status shorter in healthy states.
- Put Codex before OpenCode.
- Use explicit provider labels: `Codex` and `OpenCode`.
- Normalize quota window labels to `R`, `W`, and `M` across providers.
- Use a clearer segment format: `<window>(<remaining>% <reset>)`.
- Preserve warning semantics for low quota and consumed balances.
- Keep partial data useful instead of turning missing windows into provider errors.

**Non-Goals:**

- Changing quota fetch cadence, cache behavior, or authentication.
- Adding configuration for the threshold or display policy.
- Changing source data parsing beyond what is necessary for formatting.
- Replacing the single combined quota extension status.

## Decisions

- **Use normalized window labels.** Codex five-hour quota maps to `R`, Codex seven-day quota maps to `W`, OpenCode rolling maps to `R`, weekly maps to `W`, and monthly maps to `M`. This makes provider groups comparable and avoids provider-specific labels like `5h`/`7d` in the compact footer.

- **Use grouped percent/reset formatting.** Window segments use `R(82% 14:20)` instead of the current unlabelled `82(14:20)` shape. The percent sign identifies quota headroom and the second token identifies reset time without adding verbose labels.

- **Show primary windows first and filter healthy longer windows.** The primary short/rolling window remains visible when available. Longer windows are displayed only below the low-quota threshold. If the primary window is unavailable, the first available window is shown to avoid false provider errors.

- **Show balances only when they are consumed.** Codex credits and OpenCode dollar balance are only shown when an exhausted quota window causes the provider to consume those balances. This keeps healthy status compact while preserving the important fallback-spend signal.

- **Show Codex banked reset credits only during Codex pressure.** Banked reset credits use the existing `R<n>` label and appear when any Codex window is below the low-quota threshold. Explicit `R0` is still displayed in that state when the source reports zero.

- **Keep existing warning suppression for consumed balances.** When a window is exhausted but a balance is being consumed, the exhausted window remains dim and the balance/credits segment carries the warning.

## Risks / Trade-offs

- **`R` is overloaded between rolling windows and reset credits** → The window format uses `R(...)` while reset credits use `R<n>`, making the distinction visually parseable.
- **Healthy long-window state becomes hidden** → The footer remains actionable and compact; low long-window quota still appears because it crosses the threshold.
- **Provider labels are longer than `CODEX`/`OC`** → The healthy state still becomes shorter because fewer windows and balances are shown.
- **Partial data display may show less context** → Showing the first available window is preferable to a false error when usable data exists.
