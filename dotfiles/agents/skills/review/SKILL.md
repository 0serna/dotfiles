---
name: review
disable-model-invocation: true
description: Confirmed-only code review for local changes or pull requests.
---

# Review

Run a confirmed-only review: every reported finding must be introduced or worsened by the target changes, verified against real code, and backed by concrete evidence.

## Workflow

1. Detect the review target:
   - For a PR number or URL, run `gh pr checkout [number]`, inspect `gh pr view [number] --json title,body,baseRefName`, and analyze the diff between `HEAD` and the base branch.
   - If no explicit PR target is provided, analyze the diff between `HEAD` and the local working tree.
   - If the target is unclear, ask for clarification before proceeding.
2. Read the full diff and generate a small set of strong candidate issues. For each candidate, note file, line, and a one-sentence hypothesis; this is complete when every modified file has been considered.
3. Prefer fewer, stronger candidates and merge duplicates; this is complete when no two candidates describe the same defect.
4. Verify each candidate by reading full files and relevant context, then try to disprove the hypothesis; this is complete when each candidate has a `CONFIRMED` or `DISCARDED` verdict.
5. Keep only issues introduced or worsened by the current changes; discard every candidate that is pre-existing, speculative, or not tied to changed code.
6. Report only confirmed findings with concrete evidence.

## Review Lenses

Check correctness, security, authorization, permissions, input validation, secrets, data integrity, state transitions, idempotency, performance, unbounded work, N+1 behavior, blocking operations, reliability, retries, cleanup, timeouts, concurrency, contracts, schemas, APIs, typing, backward compatibility, quality-tool suppressions, and pattern regressions that create concrete risk.

## Rules

- Read the full source file for each candidate, not only the diff.
- Read related tests, imports, exports, interfaces, config, and nearby call sites as needed.
- Cite only exact line numbers from files actually read.
- Provide concrete evidence and a realistic failure scenario.
- For security findings, identify a plausible trust boundary, attacker path, or missing guard when it creates concrete risk.
- For performance findings, identify the trigger and scaling behavior.
- For quality-tool suppressions, report only comments or configuration changes that bypass linters, type checks, tests, coverage, or other required gates while hiding an actionable defect or concrete risk.
- For pattern-risk findings, explain what established pattern was broken and why it creates concrete risk.
- If evidence is weak, speculative, or not tied to changed code, discard the candidate.
- Never report pure style feedback, theoretical concerns without evidence, pre-existing issues not introduced or worsened by current changes, or vague pattern complaints without a concrete defect risk.

## Internal Verification Notes

Use this structure while verifying candidates. Every candidate must end with `CONFIRMED` or `DISCARDED` before writing the final output:

```text
Verdict: CONFIRMED | DISCARDED
where:
evidence:
suggestion:
```

## Output

If there are no reportable findings, print:

```text
Looks good to me
```

If there are reportable findings, print this structure per finding:

```markdown
**severity**: [severity]
**path**: [path/to/file:line-range]

## Evidence

[concise concrete evidence and fix direction]
```
