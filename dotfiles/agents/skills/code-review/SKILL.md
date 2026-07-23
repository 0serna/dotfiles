---
name: code-review
disable-model-invocation: true
description: Confirmed-only review of local changes, enriched by an applicable OpenSpec contract.
---

# Code Review

Run a confirmed-only review. Apply the review criteria to every modified implementation file; when an OpenSpec change governs the target, trace its complete contract before reporting.

## Steps

1. **Recover the brief.** Re-read the conversation and record relevant decisions, constraints, implementation claims, known failures, explicit review targets, and OpenSpec change names. Treat the brief as evidence to verify rather than authority over repository artifacts. Complete when every relevant session fact is recorded or none exists.

2. **Isolate the target.** Analyze the complete local delta against `HEAD`, including staged, unstaged, and untracked files. If the delta is empty or unrelated work cannot be separated, use the question tool to obtain a reviewable target. Complete when every target file is enumerated.

3. **Detect the contract branch.** Use an OpenSpec change named by the user or unambiguous conversation context. Otherwise inspect changed OpenSpec artifacts and active changes from `openspec list --json`; correlate their proposal impact and artifact paths with the target implementation. Enter the contract branch only when exactly one applicable active change is established. If multiple changes plausibly govern the target, use the question tool to select one. If none applies, continue without a contract. Complete when the target has exactly one governing change or is classified as ordinary code review.

4. **Build the contract ledger when applicable.** Run:

   ```bash
   openspec status --change "<name>" --json
   openspec instructions apply --change "<name>" --json
   ```

   Read every path in `contextFiles`. Add one ledger entry for every spec requirement and scenario, relevant design decision, proposal commitment, scope boundary, non-goal, and implementation task with its checkbox state. Specs are the behavioral authority, followed by design, proposal, and tasks. If artifacts conflict in a way that changes expected behavior, use the question tool to resolve the contract. Complete when every contract item has one ledger entry, or no contract applies.

5. **Trace the contract when applicable.** For every ledger entry, inspect the resulting code, tests, configuration, call sites, and relevant pre-existing behavior. Record file-and-line evidence and assign `SATISFIED`, `VIOLATED`, or `UNPROVEN`; a checked task is a claim, not evidence. Investigate every `UNPROVEN` entry before making it a candidate. Complete when every ledger entry has an evidence-backed verdict, or no contract applies.

6. **Generate candidates.** Read the full diff and apply every review criterion below to every modified implementation file. Include each `VIOLATED` contract entry. For every candidate, record its file, line, realistic failure scenario, and one-sentence hypothesis. Complete when every modified implementation file and applicable contract violation has been considered.

7. **Verify and filter.** Deduplicate candidates. For each one, read the full source file and relevant tests, imports, interfaces, configuration, call sites, and history needed to try to disprove it. Assign `CONFIRMED` or `DISCARDED`; retain only defects introduced or worsened by the target. Complete when every candidate has a verdict backed by concrete evidence.

8. **Run affected quality gates.** Discover repository instructions and configured checks, then run every affected non-writing test, lint, typecheck, build, and OpenSpec validation command. Diagnose failures and retain only failures introduced or worsened by the target. Complete when each affected gate passes or produces a confirmed finding.

9. **Report.** Output only confirmed findings using the format below. Exclude style preferences, speculative risks, already-satisfied unchecked tasks, and unrelated pre-existing defects.

## Review criteria

A finding is reportable only when it is introduced or worsened by the target, backed by concrete evidence from files read, and tied to a realistic failure scenario.

| Dimension                                | Signal                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Correctness                              | Logic errors, off-by-one errors, wrong conditions                                              |
| Security                                 | Plausible trust boundary, attacker path, or missing guard with concrete risk                   |
| Authorization, input validation, secrets | Missing or broken guard reachable by an untrusted caller                                       |
| Data integrity                           | Lost writes, partial updates, missing constraints                                              |
| State transitions                        | Invalid sequences, missing guards between states                                               |
| Idempotency                              | Duplicate invocation produces wrong side effects                                               |
| Performance                              | Identifiable trigger with scaling behavior, N+1 queries, unbounded work, blocking in hot paths |
| Reliability                              | Missing retries, cleanup, or timeouts; race conditions                                         |
| Contracts                                | OpenSpec violation, schema mismatch, API breakage, type hole, backward-compatibility violation |
| Quality-tool suppressions                | Comment or configuration bypass hiding an actionable lint, type, test, or coverage defect      |
| Pattern regressions                      | Broken established pattern that creates a concrete risk                                        |

## Output

No findings:

```text
Looks good to me
```

With findings:

```markdown
## Findings

### [High | Medium | Low] — [Brief description]

`path/to/file:line-range`

[Concrete defect, realistic failure scenario, evidence, and fix direction.]

Contract: [OpenSpec contract item, only when applicable]
```
