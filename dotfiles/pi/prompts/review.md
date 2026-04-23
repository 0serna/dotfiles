---
description: Review local changes or a pull request for important issues
---

Perform a focused, high-signal code review of local changes or a pull request.

## Input

```text
$ARGUMENTS
```

## Goal

Prioritize important issues introduced or worsened by the changes.
Focus on:

- correctness and bugs
- security issues with concrete and material risk
- data integrity and state transitions
- reliability, retries, cleanup, timeouts, and concurrency
- performance issues with clear triggers or scaling risk
- contracts, schema, typing, and backward compatibility
- pattern regressions only when they create concrete risk

Avoid style-only feedback and speculative concerns.

## Review target

1. Detect the target from `$ARGUMENTS`.
   - If it contains a PR number or PR URL:
      - Run `gh pr checkout [number]`
      - Run `gh pr view [number] --json title,body`
      - Save the diff with `DIFF_FILE=$(mktemp) && gh pr diff [number] > "$DIFF_FILE"`
   - If no arguments are provided:
     - Save the local diff with `DIFF_FILE=$(mktemp) && git diff HEAD > "$DIFF_FILE"`
2. Read the diff file completely. If needed, use `read` in batches.
3. If the diff is empty, output `No changes to review` and stop.

## Review workflow

### 1) Build a shortlist of candidate issues

From changed lines only, generate a small set of strong candidate issues.
Prefer fewer, stronger candidates.
Merge duplicates.
Cap the list at 8-10 candidates.

For each candidate, note:

- category
- `file:line` or nearest changed location
- a one-sentence hypothesis

### 2) Verify each candidate before reporting it

For each candidate:

- read the full source file, not just the diff
- read nearby code, imports, exports, interfaces, config, tests, and relevant call sites as needed
- try to disprove the hypothesis before confirming it
- confirm whether the issue is introduced or worsened by the current changes
- cite only exact line numbers from files you actually read
- provide a realistic failure scenario or impact

Discard any candidate that is weak, speculative, pre-existing, or not tied to the current changes.

### 3) Apply fail-fast review rules

- Prefer explicit failure over silent degradation unless the code is at a true boundary that must translate errors safely.
- Treat silent fallback parsing, swallowed exceptions, and pretend-success behavior as likely defects unless there is a documented compatibility requirement.
- If a `catch` block does not add meaningful handling, treat it as suspicious.

### 4) Report only important confirmed findings

Include only confirmed issues with concrete evidence.
Sort by severity, then by user or operational impact.
Never report:

- pure style feedback
- theoretical concerns without evidence
- issues not introduced or worsened by the current changes
- vague pattern complaints without a concrete defect risk

## Output format

Return this exact structure:

```markdown
# Code Review

[1-2 sentences describing what changed]

## Verdict

[correct|needs attention]

## Findings

[If there are no reportable findings: `Looks good to me`]
[Otherwise, list only reportable findings as an enumerated list]

### 1. **[P1] Title**

**Severity:** [high|medium|low]
**Area:** [security|bug|performance|reliability|data integrity|contracts|pattern risk]
**Where:** [path/to/file:line-range]
**Evidence:** [evidence]
**Why it matters:** [impact]
**Suggestion:** [suggestion]

### 2. [...]
```

## Additional rules

- Use priority tags in findings: `[P0]`, `[P1]`, `[P2]`, or `[P3]`.
- Use `P0` only for universally critical issues that should block release or operation.
- Keep line references as tight as possible.
- Prefer exact file and line references over broad ranges.
- If reviewing a PR, use the checked-out files for full-context inspection.
- If there are no important confirmed findings, keep the output short, mark the verdict as `correct`, and say `Looks good to me`.
