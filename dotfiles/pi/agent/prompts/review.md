---
description: Code review changes or pull requests
---

Perform a focused code review of local changes or a pull request, verify likely issues against the real code, and report only important confirmed findings with concrete evidence.

## Arguments

```arguments
$ARGUMENTS
```

- **PR number or URL**: Check out and review that pull request.
- **No arguments provided**: Review local changes against `HEAD`.
- **Unclear or ambiguous arguments**: Stop and ask the user for clarification before proceeding.

## Workflow

1. Detect review target:
   - If arguments contain PR number/URL:
     - `gh pr checkout [number]` (mandatory, so changed files can be inspected in full context)
     - `gh pr view [number] --json title,body`
     - `gh pr diff [number]`
   - If no arguments:
     - `git diff HEAD`
2. If the diff is empty, output `No changes to review` and STOP.
3. Read the diff output to inspect the changes. If the diff is large, read in batches.
4. From the diff, generate a small set of strong candidate issues. For each candidate, note category, `file:line`, and one-sentence hypothesis.
5. Prefer fewer, stronger candidates; merge duplicate candidates.
6. Verify each candidate directly in the current session using the available read/search/diff tools.
7. During verification, read full files and relevant context, try to disprove the hypothesis, and keep only issues introduced or worsened by the current changes.
8. Report only important confirmed findings with concrete evidence.

## Rules

- Review through these lenses: correctness / bugs, security / auth / permissions / input validation / secrets, data integrity / state transitions / idempotency, performance / unbounded work / N+1 / blocking operations, reliability / retries / cleanup / timeouts / concurrency, contracts / schema / API / typing / backward compatibility, and pattern regressions only if they create concrete risk.
- Read the full source file for each candidate, not only the diff.
- Read related tests/imports/exports/interfaces/config and nearby call sites as needed.
- Try to disprove each hypothesis before confirming it.
- Verify whether the issue is introduced or worsened by the current changes.
- Cite only exact line numbers from files actually read.
- Provide concrete evidence and a realistic failure scenario.
- For security findings, identify a plausible trust boundary, attacker path, or missing guard when it creates concrete risk.
- For performance findings, identify the trigger and scaling behavior.
- For pattern-risk findings, explain what established pattern was broken and why it creates concrete risk.
- For internal verification notes, use: `Verdict: CONFIRMED | DISCARDED`, category, severity, title, where, evidence, why it matters, and suggestion.
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

If there are reportable findings, print this structure per finding:

```markdown
severity: [severity]
path: [path/to/file:line-range]
[evidence, why it matters and suggestion]

---

[next finding]
```
