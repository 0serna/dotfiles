## Context

The profiles extension (`dotfiles/pi/agent/extensions/profiles/`) provides model routing for Pi sessions. Currently it supports:

- 3 route types: `low`, `medium`, `high`
- 2 fixed profiles: `default`, `fallback`
- Compaction-specific routing via `COMPACT_ROUTE`
- Status bar reporting via `publishStatus`

Real-world usage shows that `medium` and `high` routes often use the same model configuration, making the 3-tier distinction unnecessary. The `fallback` profile adds complexity without clear value — users typically configure one profile and stick with it.

## Goals / Non-Goals

**Goals:**

- Simplify routing model to 2 tiers: `default` (normal work) and `high` (power commands)
- Reduce config structure to flat `{ default: ModelRoute, high: ModelRoute }`
- Remove compaction-specific routing (compaction uses whatever model is active)
- Remove status bar reporting
- Simplify command flow: `/profile` goes directly to route editor

**Non-Goals:**

- Backward compatibility with existing config files (user will manually migrate)
- Automatic config migration tooling
- Changing which commands route to `high` (stays: `/review`, `/openspec-propose`)

## Decisions

### Decision: 2 routes instead of 3

**Choice**: `default` and `high`

**Rationale**: The `low` route was primarily used for compaction and "cheap" commands. With compaction routing removed, `low` becomes redundant. Commands that used `low` now use `default` — they don't need special model switching.

**Alternatives considered**:

- Keep `low` but rename it: Still adds unnecessary complexity for minimal benefit
- Single route (no routing): Loses the ability to use powerful models for complex tasks

### Decision: Single profile, flat config

**Choice**: One profile, flat JSON structure

**Rationale**: Multiple profiles (`default`, `fallback`) added complexity without clear value. Users configure once and use. Flat structure is easier to read and edit manually.

**Config format**:

```json
{
  "default": { "model": "provider/model-id", "thinkingLevel": "medium" },
  "high": { "model": "provider/model-id", "thinkingLevel": "high" }
}
```

**Alternatives considered**:

- Keep `profile` wrapper key: Unnecessary nesting for single profile
- Keep multiple profiles: Adds selection UI, active profile tracking, etc.

### Decision: Remove compaction routing

**Choice**: No model switching during compaction

**Rationale**: Compaction routing added complexity (snapshot save/restore, special handlers) for marginal benefit. The active model handles compaction fine.

**Impact**: Removes `session_before_compact` and `session_compact` handlers. Simplifies snapshot logic to only handle command-based routing.

### Decision: Remove status bar reporting

**Choice**: No `publishStatus` calls

**Rationale**: Status bar adds code complexity and visual noise. Users can see the current model in Pi's built-in model indicator.

**Impact**: Removes `publishStatus`, `publishFailedStatus`, `warnOnce` status-related code.

### Decision: Rename command to `/profile`

**Choice**: Singular `/profile`

**Rationale**: Reflects single-profile model. More intuitive than plural `/profiles`.

### Decision: Rename `profiles.ts` to `routes.ts`

**Choice**: `routes.ts`

**Rationale**: File defines route types and mappings, not profiles. More accurate name.

## Risks / Trade-offs

- **Risk**: User must manually migrate config → **Mitigation**: Clear documentation in change; config is simple JSON
- **Risk**: No status bar feedback → **Mitigation**: Pi's model indicator provides similar info; warnings still show for errors
- **Risk**: Losing fallback profile → **Mitigation**: Single profile is simpler; users can reconfigure if needed

## Migration Plan

1. Extension code changes (this change)
2. User manually updates `~/.local/state/pi/profiles.json` to new flat format
3. Old config becomes invalid (structural validation catches this)

## Open Questions

_(none — all decisions resolved in interview)_
