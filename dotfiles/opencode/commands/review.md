---
description: Code review changes or pull requests
model: openai/gpt-5.4
---

## Input

```text
$ARGUMENTS
```

## Task

- Perform a focused, high-signal code review of local changes or a PR.
- Prioritize important issues introduced or worsened by the changes.
- Focus on correctness, security issues with concrete and material risk, data integrity, reliability, performance, contracts, and pattern regressions with concrete risk.
- Avoid style-only feedback and speculative concerns.

## Prepare diff

1. Detect review target:
   - If input contains PR number/URL:
     - `gh pr checkout <number>` (mandatory, so verification agents can inspect the checked-out files in full context)
     - `gh pr view <number> --json title,body`
     - `DIFF_FILE=$(mktemp) && gh pr diff <number> > "$DIFF_FILE"`
   - If no input:
     - `DIFF_FILE=$(mktemp) && git diff HEAD > "$DIFF_FILE"`
2. Read `DIFF_FILE` with `Read` in batches (use offset/limit).
3. If diff is empty, output `No changes to review` and STOP.

## Review workflow

### 1) Generate candidates (do not report yet)

From changed lines only, generate a small set of strong candidate issues under these lenses:

- correctness / bugs
- security / auth / permissions / input validation / secrets
- data integrity / state transitions / idempotency
- performance / unbounded work / N+1 / blocking operations
- reliability / retries / cleanup / timeouts / concurrency
- contracts / schema / API / typing / backward compatibility
- pattern regressions only if they create concrete risk

For each candidate include:

- Category
- `file:line`
- one-sentence hypothesis

Prefer fewer, stronger candidates.
Merge duplicates.
Cap the list at 8-12 candidates.

### 2) Verify each candidate with `general` agent

Run one `general` agent task per candidate. Require it to:

- read full source file (not only diff)
- read related tests/imports/exports/interfaces/config and nearby call sites as needed
- try to disprove the hypothesis before confirming it
- verify whether the issue is introduced or worsened by the current changes
- cite only exact line numbers from files it actually read
- provide concrete evidence and realistic failure scenario

Lens-specific checks:

- Security: identify a plausible trust boundary, attacker path, or missing guard when it creates concrete risk
- Performance: identify the trigger and scaling behavior
- Pattern risk: explain what established pattern was broken and why it creates concrete risk

Required verdict format per candidate:

- Verdict: `CONFIRMED` | `DISCARDED`
- Category
- Severity
- Title
- Where
- Evidence
- Why it matters
- Suggestion

If evidence is weak/speculative, not tied to changed code, or the exact location cannot be verified, mark `DISCARDED`.

### 3) Report only important confirmed findings

Include only `CONFIRMED` issues with concrete evidence.
Sort by severity, then by user or operational impact.
Never report:

- pure style feedback
- theoretical concerns without evidence
- pre-existing issues not introduced or worsened by current changes
- vague pattern complaints without a concrete defect risk

## Output Format

Return this exact format:

```markdown
# Code Review

<1-2 sentences describing what changed>

## Findings

[If there are no reportable findings: `Looks good to me`]
[Otherwise, list only reportable findings as an enumerated list]

### 1. **Title**

**Severity:** <high|medium|low>
**Area:** <security|bug|performance|reliability|data integrity|contracts|pattern risk>
**Where:** <path/to/file:line-range>
**Evidence:** <evidence>
**Why it matters:** <impact>
**Suggestion:** <suggestion>

### 2. ...
```
