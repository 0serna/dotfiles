---
name: review
description: >-
  Perform a focused code review of local changes or a GitHub pull request. Use
  when the user asks to review a diff, current changes, staged or unstaged work,
  or a PR, and report only important confirmed findings grounded in real code.
---

# Review

Perform a focused code review of local changes or a pull request, verify likely issues against the real code, and report only important confirmed findings.

## Workflow

1. Detect the review target:
   - For a PR number or URL, run `gh pr checkout [number]`, inspect `gh pr view [number] --json title,body,baseRefName`, and analyze the diff between `HEAD` and the base branch.
   - If no explicit PR target is provided, analyze the diff between `HEAD` and the local working tree.
   - If the target is unclear, ask for clarification before proceeding.
2. Generate a small set of strong candidate issues from the changes. For each candidate, note category, file and line, and a one-sentence hypothesis.
3. Prefer fewer, stronger candidates and merge duplicates.
4. Verify each candidate by reading full files and relevant context, then try to disprove the hypothesis.
5. Keep only issues introduced or worsened by the current changes.
6. Report only confirmed findings with concrete evidence.

## Review Lenses

Check correctness, security, authorization, permissions, input validation, secrets, data integrity, state transitions, idempotency, performance, unbounded work, N+1 behavior, blocking operations, reliability, retries, cleanup, timeouts, concurrency, contracts, schemas, APIs, typing, backward compatibility, and pattern regressions that create concrete risk.

## Rules

- Read the full source file for each candidate, not only the diff.
- Read related tests, imports, exports, interfaces, config, and nearby call sites as needed.
- Cite only exact line numbers from files actually read.
- Provide concrete evidence and a realistic failure scenario.
- For security findings, identify a plausible trust boundary, attacker path, or missing guard when it creates concrete risk.
- For performance findings, identify the trigger and scaling behavior.
- For pattern-risk findings, explain what established pattern was broken and why it creates concrete risk.
- If evidence is weak, speculative, or not tied to changed code, discard the candidate.
- Never report pure style feedback, theoretical concerns without evidence, pre-existing issues not introduced or worsened by current changes, or vague pattern complaints without a concrete defect risk.

## Internal Verification Notes

Use this structure while verifying candidates:

```text
Verdict: CONFIRMED | DISCARDED
category:
severity:
title:
where:
evidence:
why it matters:
suggestion:
```

## Output

If there are no reportable findings, print:

```text
Looks good to me
```

If there are reportable findings, print this structure per finding:

```text
severity: [severity]
path: [path/to/file:line-range]
suggestion: [concise evidence and suggestion]
```
