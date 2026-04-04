---
description: Code review changes or pull requests
---

## Input

```text
$ARGUMENTS
```

## Task

- Perform a focused, high-signal code review of local changes or a PR.
- Prioritize actionable bugs; avoid style-only or speculative feedback.

## Prepare diff

1. Detect review target:
   - If input contains PR number/URL:
     - `gh pr checkout <number>` (mandatory)
     - `gh pr view <number> --json title,body`
     - `DIFF_FILE=$(mktemp) && gh pr diff <number> > "$DIFF_FILE"`
   - If no input:
     - `DIFF_FILE=$(mktemp) && git diff HEAD > "$DIFF_FILE"`
2. Read `DIFF_FILE` with `Read` in batches (use offset/limit).
3. If diff is empty, output `No changes to review` and STOP.

## Review workflow

### 1) Generate candidates (do not report yet)

From changed lines only, collect candidate issues with:

- `file:line`
- one-sentence bug hypothesis
- expected failure scenario/impact

### 2) Verify each candidate with `general` agent

Run one `general` agent task per candidate. Require it to:

- read full source file (not only diff)
- read related tests/imports/exports/interfaces/config as needed
- verify whether issue is introduced by current changes
- verify whether duplicated code is introduced and creates real maintenance risk
- provide concrete evidence and realistic failure scenario

Required verdict format per candidate:

- Verdict: `CONFIRMED` | `DISCARDED`
- Title
- Evidence
- Fix

If evidence is weak/speculative or not tied to changed code, mark `DISCARDED`.

### 3) Report only important confirmed findings

Include only `CONFIRMED` issues with concrete evidence.
Never report:

- pure style feedback
- theoretical concerns without evidence
- pre-existing issues not introduced/worsened by current changes

## Output Format

Return this exact format:

```markdown
# Code Review

<1-3 sentences describing what functionality was added/modified/removed>

## Findings

[If there are no reportable findings: `Looks good to me`]
[Otherwise, list only reportable findings as an enumerated list]

### 1. **Title**

**Where:** <path/to/file:line>
**Evidence:** <evidence>
**Fix:** <fix>

### 2. ...
```
