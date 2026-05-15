## Context

Three agent prompts (`commit.md`, `review.md`, `simplify.md`) in `dotfiles/pi/agent/prompts/` invoke `git diff` / `gh pr diff` to inspect code changes. The `bash` tool truncates output at 2000 lines or 50KB. When diffs exceed this limit, the agent receives an incomplete view, leading to poor commit messages, missed review issues, or incorrect simplifications.

The current approach in `commit.md` mitigates this by reading per-file diffs individually (`git diff --cached -- <path>`). However, this is slow (N+1 commands) and `review.md`/`simplify.md` still invoke full diffs directly. The per-file strategy also loses the holistic view needed for good review/commit decisions.

## Goals / Non-Goals

**Goals:**

- All git diff output in agent prompts is captured completely, without truncation.
- The agent inspects diffs via the `read` tool (which supports offset/limit batching) instead of relying on raw `bash` output.
- Eliminate N+1 per-file diff commands — one command fetches the full diff.
- Eliminate `--stat` preflight — the full diff already contains all context.
- Consistent pattern across all three prompts.

**Non-Goals:**

- No changes to the `bash` or `read` tools themselves.
- No changes to the `opsx-*` prompts, `grill-me.md`, or `setup-repository.md` (they don't use git diff).
- No cleanup mechanism for temp files — `/tmp` accumulation is accepted.

## Decisions

### Decision 1: Capture full diff in one command

**Choice:** Run a single `git diff` / `gh pr diff` command redirected to a temp file, instead of per-file diffs.

**Rationale:** Eliminates N+1 round-trips, gives the agent a complete picture, simplifies prompt instructions. The temp file + batched read pattern handles any size.

### Decision 2: Use `mktemp` for temp file creation

**Choice:** Use `mktemp` (without arguments) to create a uniquely named temp file, save the path in a variable, and redirect diff output into it. `mktemp` prints the file path, which the agent captures from the command output.

**Alternatives considered:** Hardcoded path like `/tmp/pi-diff.md` — rejected because concurrent invocations would collide. Timestamp-based names — `mktemp` is standard, simpler, and POSIX.

**Example:**

```bash
DIFF_FILE=$(mktemp) && git diff HEAD > "$DIFF_FILE" && echo "Diff saved to $DIFF_FILE"
```

### Decision 3: Read temp file in batches with offset/limit

**Choice:** Use the `read` tool with `offset` and `limit` parameters to consume the file in batches of 2000 lines (Pi's maximum line limit per `read` invocation). After each batch, continue at `offset + 2000` until the file is consumed (a batch returns fewer lines than the limit signals end-of-file, but the 50KB secondary cap means a batch may return <2000 lines without being EOF — the agent must also check that the next read at the new offset returns empty).

**Rationale:** Matches Pi's built-in batch size. Minimal iterations for most diffs. The 50KB cap is a secondary constraint — if a single batch hits 50KB before 2000 lines, the agent continues from the next offset.

### Decision 4: No `--stat` preflight

**Choice:** Remove `git diff --stat` as a separate step from all three prompts.

**Rationale:** The full diff contains all the information. A separate stat step adds latency and complexity for no benefit once the full diff is available.

### Decision 5: No explicit cleanup

**Choice:** Do not include `rm "$DIFF_FILE"` in the prompts.

**Rationale:** `/tmp` is ephemeral (cleaned on reboot). Adding cleanup adds a failure point and unnecessary verbosity. Temp files are tiny and self-cleaning.

### Decision 6: Same pattern for `gh pr diff`

**Choice:** `gh pr diff [number] > "$DIFF_FILE"` follows the exact same pattern as `git diff`.

**Rationale:** `gh pr diff` output has the same truncation risk and the same mitigation applies identically.

### Decision 7: Empty diff detection is implicit

**Choice:** If the first `read` of the temp file returns empty content, the agent treats it as "no changes" and stops.

**Rationale:** No special instruction needed. The natural workflow (create file → read first batch) handles this transparently.

## Risks / Trade-offs

| Risk                                                                                                                                         | Mitigation                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **50KB hit before 2000 lines**: A batch returns fewer lines than `limit` but the file isn't fully consumed. The agent might think it's done. | Prompt instructions clarify: if a batch returns exactly the requested lines, assume more content may exist and continue; if it returns fewer, check one more offset to confirm EOF. |
| **Temp file accumulation**: `/tmp/` accumulates one file per agent invocation.                                                               | Acceptable — files are tiny and cleaned on reboot. No prompt cleanup needed.                                                                                                        |
| **`mktemp` not available**: Rare on Linux but theoretically possible on minimal containers.                                                  | The prompts target the user's development environment. `mktemp` is available on all standard Linux/macOS systems.                                                                   |
| **Agent misinterprets batching instructions**: The agent might not loop correctly on first attempt.                                          | Prompt instructions should be precise about the batching loop. Manual iteration with explicit offset math is simpler and more reliable than asking the agent to "figure it out."    |
