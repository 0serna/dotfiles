## Context

The quota extension (`dotfiles/pi/agent/extensions/quota/`) monitors API usage for Codex and OpenCode Go providers. It currently displays status in the footer with parenthesized window labels: `Codex R(80% 14:30) │ OpenCode R(75% 12:00)`.

Current window selection shows the primary (rolling) window plus any below-threshold windows. This creates visual noise when multiple windows are shown.

## Goals / Non-Goals

**Goals:**

- Simplify status to one window per provider with no parentheses or labels
- Prioritize exhausted windows over rolling in status display
- Add `/quota` command for full detail view
- Maintain existing caching and polling behavior

**Non-Goals:**

- Changing the data fetch logic or API clients
- Modifying the cache format
- Adding new providers

## Decisions

### 1. Window selection priority

**Decision:** Monthly exhausted > Weekly exhausted > Rolling (default)

**Rationale:** If monthly is exhausted, weekly quota is irrelevant because the monthly cap blocks all usage. This mirrors user mental model: "I'm blocked by the monthly limit."

**Alternative considered:** Show the lowest-percent window. Rejected because a healthy weekly at 10% is less urgent than an exhausted monthly at 0%.

### 2. Status format

**Decision:** `Provider percent% reset` without window label

**Rationale:** The window label (R/W/M) adds clutter without value in a single-window display. The percent and reset time are the actionable information.

### 3. `/quota` display method

**Decision:** Use `ctx.ui.setWidget()` to render a temporary block above the editor.

**Rationale:** `setWidget` supports multi-line formatted output and auto-dismisses. `notify` is single-line only. Using a command context allows refreshing data before display.

### 4. Exhausted state coloring

**Decision:** Only credits/balance in warning color; window percent/reset stay dim.

**Rationale:** The 0% is already visible in the percent. Making credits/balance warning-colored draws attention to the actionable escape hatch (credits or reset time).

## Risks / Trade-offs

- **Single window hides context** → Mitigated by `/quota` command for full detail
- **Exhausted window priority may surprise users** → Documented in code comments; behavior is intentional
- **Widget auto-dismiss may be missed** → Status bar remains as persistent indicator

## Migration Plan

1. Update `status.ts` formatting and window selection
2. Register `/quota` command in `index.ts`
3. Update test assertions to match new format
4. Run `npm run check` to verify
