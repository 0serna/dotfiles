## REMOVED Requirements

### Requirement: Auto-set thinking level on manual model change

**Reason**: Forcing `medium` ignores the user's preferred reasoning level for each model.
**Migration**: Use per-model thinking memory to restore the last selected thinking level for manually selected or cycled models.

### Requirement: No auto-set during session restore

**Reason**: The forced auto-set behavior is removed entirely.
**Migration**: Per-model thinking restoration applies only to manual set/cycle model selections.

### Requirement: Slash command routes override auto-set thinking level

**Reason**: The forced auto-set behavior is removed entirely.
**Migration**: Routed commands continue to apply their configured route thinking level when activated.
