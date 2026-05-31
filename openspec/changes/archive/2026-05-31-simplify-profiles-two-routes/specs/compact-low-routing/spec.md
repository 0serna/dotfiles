## REMOVED Requirements

### Requirement: Compaction triggers low-model routing

**Reason**: Compaction-specific routing removed. Compaction uses whatever model is active — no special model switching.

**Migration**: No replacement needed. Compaction proceeds with the current model without snapshot save/restore.

### Requirement: Restore pre-compaction model after compaction

**Reason**: No compaction-specific routing means no snapshot to restore after compaction.

**Migration**: No replacement needed.
