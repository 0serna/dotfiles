## REMOVED Requirements

### Requirement: Duration extension publishes live agent elapsed time

**Reason**: Processing-cycle duration is now owned by the unified `pi-working-time-throughput` capability, which defines settled completion across retries, compaction, and continuations.

**Migration**: Use the `Working message shows elapsed agent time` requirement in `pi-working-time-throughput`.

### Requirement: Duration extension manages lifecycle cleanup

**Reason**: Working-stats lifecycle cleanup is now defined once by the unified `pi-working-time-throughput` capability.

**Migration**: Use the `Extension cleans up runtime resources` requirement in `pi-working-time-throughput`.
