---
name: review-change
disable-model-invocation: true
description: Review local implementation changes against an OpenSpec change.
---

# Review OpenSpec Change

Run a contract-first code review: derive the obligations from one OpenSpec change, trace every obligation to the local implementation, and report only confirmed defects.

## Workflow

1. **Select the change.** Use a change named by the user or unambiguous conversation context. Otherwise run `openspec list --json` and use the question tool to select one. Complete when exactly one active change is named.

2. **Load the contract.** Run:

   ```bash
   openspec status --change "<name>" --json
   openspec instructions apply --change "<name>" --json
   ```

   Read every path in `contextFiles`. Build a review ledger containing:
   - every spec requirement and scenario;
   - every relevant design decision;
   - every proposal commitment, scope boundary, and non-goal;
   - every implementation task and its checkbox state.

   Treat specs as the behavioral authority, followed by design, proposal, and tasks. If artifacts conflict and the conflict changes the expected implementation, use the question tool to resolve the contract before reviewing. Complete when every contract item has one ledger entry.

3. **Isolate the implementation.** Review the complete local delta against `HEAD`: staged changes, unstaged changes, and untracked files. Separate OpenSpec artifacts from implementation files, but retain artifact edits as contract context. If the delta is empty or unrelated work cannot be separated from the change, use the question tool to obtain a reviewable target. Complete when every implementation file in the target is enumerated.

4. **Trace the contract.** For every ledger entry, inspect the resulting code, tests, configuration, call sites, and relevant pre-existing behavior. Record concrete file and line evidence, then assign `SATISFIED`, `VIOLATED`, or `UNPROVEN`. A checked task is a claim, not evidence. Try to resolve every `UNPROVEN` entry through further inspection before treating it as a candidate defect. Complete when every requirement, scenario, design decision, proposal boundary, and task has an evidence-backed verdict.

5. **Review the code delta.** Read `../code-review/SKILL.md` and apply its candidate generation, deduplication, verification, filtering, criteria, and severity discipline to every implementation file. Use this skill's change selection, contract ledger, and output rules instead of the target-selection and OpenSpec steps in that skill. Include contract violations as candidates. Complete when every candidate is `CONFIRMED` or `DISCARDED` and every modified implementation file has been considered.

6. **Run affected quality gates.** Discover project instructions and configured checks, then run every non-writing test, lint, typecheck, build, and OpenSpec validation command affected by the target. Diagnose failures and retain only failures introduced or worsened by the implementation. Complete when each affected gate has a passing result or a confirmed finding.

7. **Report.** Output only confirmed findings introduced or worsened by the implementation. Each finding must identify its severity, contract item when applicable, exact path and lines, concrete failure scenario, evidence, and fix direction. Do not report style preferences, speculative risks, unchecked tasks whose behavior is already satisfied, or unrelated pre-existing defects.

## Output

No findings:

```text
Looks good to me

Reviewed: N requirements, N scenarios, N tasks; all affected quality gates passed.
```

With findings:

```markdown
## Review Summary

**N findings** — H high, M medium, L low

---

**severity**: [high | medium | low]
**contract**: [requirement, scenario, design decision, proposal boundary, or task]
**path**: [path/to/file:line-range]

## Evidence

[Concrete mismatch or defect, realistic failure scenario, and fix direction.]
```
