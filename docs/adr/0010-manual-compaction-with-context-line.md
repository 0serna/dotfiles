# Manual compaction driven by a model-written context line

T3 Code renders assistant text only, so Pi's and OpenCode's native context meters are invisible there. We keep both agents' automatic compaction thresholds untouched and instead append an ephemeral `status: <tokens>` note to each model request; the shared `AGENTS.md` tells the model to end its final answer with `context: <n>k`. The line gives the user the number and the decision, while the native threshold (10% of the window) remains a safety net. The note is request-local, so the cached prefix stays intact.

## Considered options

- **Auto-compaction at 300k plus the line.** Rejected: the cutoff stays hidden, removes the manual decision the line exists to enable, and adds no protection on a 1M-token window.
- **Native status or footer widgets.** Rejected: T3 Code does not render them; the signal must be assistant text.
- **Repairing missed lines in the harness.** Deferred: start with the model writing the line and measure how often it fails before adding detection.

## Consequences

- The line is best-effort; a model can omit it.
- OpenCode reports the last closed step, so its number can lag by one step.
- The note must be skipped during compaction so a stale number never enters the summary.
