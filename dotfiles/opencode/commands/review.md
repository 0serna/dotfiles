---
description: Code review changes or pull requests
---

## Arguments

```text
$ARGUMENTS
```

- **PR number or URL**: Check out and review that pull request.
- **No arguments provided**: Review local changes against `HEAD`.
- **Unclear or ambiguous arguments**: Stop and ask the user for clarification before proceeding.

## Task

- Perform a focused, high-signal code review of local changes or a PR.
- Prioritize important issues introduced or worsened by the changes.
- Focus on correctness, security issues with concrete and material risk, data integrity, reliability, performance, contracts, and pattern regressions with concrete risk.
- Avoid style-only feedback and speculative concerns.

## Workflow

1. Detect review target:
   - If arguments contain PR number/URL:
      - `gh pr checkout [number]` (mandatory, so verification agents can inspect the checked-out files in full context)
      - `gh pr view [number] --json title,body`
      - `DIFF_FILE=$(mktemp) && gh pr diff [number] > "$DIFF_FILE"`
   - If no arguments:
     - `DIFF_FILE=$(mktemp) && git diff HEAD > "$DIFF_FILE"`
2. Read `DIFF_FILE` with `Read` in batches (use offset/limit).
3. If diff is empty, output `No changes to review` and STOP.
4. From changed lines only, generate a small set of strong candidate issues.
5. For each candidate, include category, `file:line`, and a one-sentence hypothesis.
6. Prefer fewer, stronger candidates; merge duplicates and cap the list at 8-12 candidates.
7. Run one `general` agent task per candidate to verify or discard it.
8. Report only important confirmed findings with concrete evidence.

## Rules

- Review through these lenses: correctness / bugs, security / auth / permissions / input validation / secrets, data integrity / state transitions / idempotency, performance / unbounded work / N+1 / blocking operations, reliability / retries / cleanup / timeouts / concurrency, contracts / schema / API / typing / backward compatibility, and pattern regressions only if they create concrete risk.
- Require each verification agent to read the full source file, not only the diff.
- Require each verification agent to read related tests/imports/exports/interfaces/config and nearby call sites as needed.
- Require each verification agent to try to disprove the hypothesis before confirming it.
- Require each verification agent to verify whether the issue is introduced or worsened by the current changes.
- Require each verification agent to cite only exact line numbers from files it actually read.
- Require each verification agent to provide concrete evidence and a realistic failure scenario.
- For security findings, identify a plausible trust boundary, attacker path, or missing guard when it creates concrete risk.
- For performance findings, identify the trigger and scaling behavior.
- For pattern-risk findings, explain what established pattern was broken and why it creates concrete risk.
- Require each verification verdict to include: `Verdict: CONFIRMED | DISCARDED`, category, severity, title, where, evidence, why it matters, and suggestion.
- If evidence is weak/speculative, not tied to changed code, or the exact location cannot be verified, mark the candidate `DISCARDED`.
- Include only `CONFIRMED` issues with concrete evidence in the final review.
- Sort findings by severity, then by user or operational impact.
- Never report pure style feedback, theoretical concerns without evidence, pre-existing issues not introduced or worsened by current changes, or vague pattern complaints without a concrete defect risk.

## Output

Return only the final review result.

If there are no reportable findings, print exactly:

```text
Looks good to me
```

If there are reportable findings, print a compact numbered list using this structure:

```markdown
1. [severity][area] [title]
   Where: [path/to/file:line-range]
   Impact: [evidence and why it matters]
   Fix: [suggestion]

2. ...
```
