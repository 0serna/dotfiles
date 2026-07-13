# Share one quota snapshot across Pi processes

The quota extension will maintain one user-scoped aggregated quota snapshot shared by concurrent Pi processes rather than polling independently in each process. A central quota refresh will coalesce concurrent requests, publish each source observation as it resolves, and notify watching sessions; this avoids multiplying authenticated provider requests without requiring a separate daemon. Active provider accounts, runtime API keys, and cooldowns remain local to each Pi runtime, so processes share observations but not operational account decisions.

## Considered Options

- Per-process snapshots were rejected because each open Pi process would duplicate the five-minute provider polling cycle.
- A dedicated daemon was rejected because its deployment and lifecycle cost are disproportionate to this local extension.
