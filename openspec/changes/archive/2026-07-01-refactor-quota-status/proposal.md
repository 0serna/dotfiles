## Why

The quota extension status bar is cluttered with parentheses and window labels (R/W/M) that add noise without value. Users need a cleaner glanceable format and a dedicated command for full quota details.

## What Changes

- **Status format**: Remove parentheses and window labels. New format: `Codex 80% 14:30 │ OpenCode 75% 12:00`
- **Window selection**: Show only one window per provider. Default: rolling. If weekly or monthly is exhausted (0%), it replaces rolling as the visible window (highest priority: monthly > weekly > rolling).
- **Exhausted state**: When visible window is exhausted (0%), credits/balance appear in `warning` color. Codex resets (`R`) shown as `accent` if ≥ 1, `dim` if 0.
- **New command**: `/quota` prints full detail for both providers in a visual block format with all windows, credits, and resets.

## Capabilities

### New Capabilities

- `quota-command`: User-facing `/quota` command that displays detailed quota information for all providers in a formatted block.

### Modified Capabilities

- `quota-status`: Requirements changing for status format, window selection logic, and exhausted state rendering.

## Impact

- `dotfiles/pi/agent/extensions/quota/status.ts` — rewrite formatting functions and window selection
- `dotfiles/pi/agent/extensions/quota/index.ts` — register `/quota` command
- `dotfiles/pi/agent/extensions/quota/tests/` — update all test assertions
