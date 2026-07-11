---
name: code-review
disable-model-invocation: true
description: Confirmed-only code review for local changes or pull requests.
---

# Code Review

Run a confirmed-only review: every reported finding must be introduced or worsened by the target changes, verified against real code, and backed by concrete evidence.

## Workflow

1. **Detect the review target.**
   - For a PR number or URL, run `gh pr checkout [number]`, inspect `gh pr view [number] --json title,body,baseRefName`, and analyze the diff between `HEAD` and the base branch.
   - If no explicit PR target is provided, analyze the diff between `HEAD` and the local working tree.
   - If the target is unclear, ask for clarification before proceeding.

2. **Generate candidates.** Read the full diff and produce a small set of strong candidate issues. For each candidate, note file, line, and a one-sentence hypothesis. Complete when every modified file has been considered.

3. **Deduplicate.** Merge duplicates so no two candidates describe the same defect.

4. **Verify.** For each candidate, read the full source file and relevant context (tests, imports, interfaces, config, call sites), then try to disprove the hypothesis. Complete when every candidate has a `CONFIRMED` or `DISCARDED` verdict.

5. **Filter.** Keep only issues introduced or worsened by the current changes. Discard pre-existing, speculative, or untethered candidates.

6. **OpenSpec compliance.** If the diff touches files under `openspec/changes/<name>/` or `openspec/specs/`, read the corresponding specs, design, and tasks. For each requirement in the spec, verify the implementation satisfies it. Treat any gap between specification and implementation as a candidate and run it through the verify and filter steps above.

7. **Report.** Output only confirmed findings with concrete evidence, following the Output format below.

## Criteria

A finding is reportable when it is **introduced or worsened** by the target changes, **backed by concrete evidence** from files actually read, and **tied to a realistic failure scenario**.

Check these dimensions against every candidate:

| Dimension                                | Signal                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Correctness                              | Logic errors, off-by-one, wrong conditions                                                             |
| Security                                 | Plausible trust boundary, attacker path, or missing guard with concrete risk                           |
| Authorization, input validation, secrets | Missing or broken guard reachable by an untrusted caller                                               |
| Data integrity                           | Lost writes, partial updates, missing constraints                                                      |
| State transitions                        | Invalid sequences, missing guards between states                                                       |
| Idempotency                              | Duplicate invocation produces wrong side effects                                                       |
| Performance                              | Identifiable trigger with scaling behavior, N+1, unbounded work, blocking in hot paths                 |
| Reliability                              | Missing retries, cleanup, timeouts; race conditions                                                    |
| Contracts                                | Schema mismatch, API breakage, type holes, backward-compat violations                                  |
| Quality-tool suppressions                | Comment or config bypassing linters, type checks, tests, or coverage while hiding an actionable defect |
| Pattern regressions                      | Breaks an established pattern creating concrete risk                                                   |

Scope findings to what the changes introduce or worsen. Cite exact line numbers from files read. Exclude pure style, theoretical concerns without evidence, and vague pattern complaints without a concrete defect.

## Output

No findings:

```text
Looks good to me
```

With findings:

```markdown
## Review Summary

**N findings** — H high, M medium, L low

---

**severity**: [high | medium | low]
**path**: [path/to/file:line-range]

## Evidence

[concrete evidence and fix direction]
```
