## REMOVED Requirements

### Requirement: Footer displays assistant output throughput

**Reason**: Live assistant throughput is now owned by the unified `pi-working-time-throughput` capability.

**Migration**: Use the `Working message shows assistant token throughput` requirement in `pi-working-time-throughput`.

### Requirement: Footer replaces live estimate with precise final throughput

**Reason**: Final throughput retention and settled completion are now owned by the unified `pi-working-time-throughput` capability.

**Migration**: Use the `Final throughput is stored for the completion notification` requirement in `pi-working-time-throughput`.

### Requirement: Throughput measurement is scoped to one assistant stream

**Reason**: Per-stream measurement is now handled as part of the unified `pi-working-time-throughput` capability.

**Migration**: Use the throughput measurement scenarios in `pi-working-time-throughput`.

### Requirement: Throughput runtime state is session-scoped

**Reason**: Session-scoped lifecycle is now defined once by the unified `pi-working-time-throughput` capability.

**Migration**: Use the `Extension cleans up runtime resources` requirement in `pi-working-time-throughput`.
