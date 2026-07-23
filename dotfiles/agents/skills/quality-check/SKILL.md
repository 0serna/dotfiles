---
name: quality-check
disable-model-invocation: true
description: Establish a practical quality baseline, quality commands, and a pre-commit auto-fix flow.
---

## Workflow

1. Audit the repository's effective quality boundary. Inspect the stack, existing runner, CI, formatters, auto-fixers, quality tools, and pre-commit framework. For each tool, account for:
   - maintained production, test, script, and configuration files
   - justified exclusions such as generated artifacts
   - disabled or downgraded rules, inline and file-wide suppressions, and ignored paths
   - whether the command verifies the tree or mutates it

   Exercise the normal commands and, where supported, inspect excluded maintained files without treating generated artifacts as debt. The audit is complete when every maintained file class is either checked or has an explicit rationale, and every mechanism that can hide findings is accounted for.

2. Propose a **practical baseline** before changing files. Configure individual format, lint, typecheck, test, and build commands—whichever apply—in the existing runner for manual use and CI. Make these decisions explicit:
   - which findings block and which represent accepted debt
   - whether verification and auto-fix are separate commands
   - production and test policies, with narrow overrides where test doubles need them
   - maintained file scope and justified exclusions
   - suppression policy, including obsolete-directive detection and justification requirements where supported
   - formatter and analyzer ownership, avoiding duplicate work
   - migration strategy for existing debt

   Prefer errors for new correctness risks. When existing debt prevents adoption, expose it as warnings and add an automated ratchet such as a warning budget; reduce the budget whenever debt is removed, and promote a rule to blocking when its scoped count reaches zero. Keep the baseline in one change rather than leaving the repository with a knowingly failing gate.

   Also propose the pre-commit flow: format → auto-fix → re-stage. Prefer an existing staged-file orchestrator over a hand-rolled hook—common options include `lint-staged` (Node), `pre-commit` (Python), `prek` (Rust), and `lefthook` (multi-language).

   The proposal is complete when the user has confirmed:
   - each individual command, target name, and gate semantics
   - file scope, exclusions, and any scoped rule overrides
   - accepted-debt ratchet, if needed
   - formatter and auto-fixer commands
   - suppression policy
   - pre-commit tool/framework
   - dependencies to install

3. Install approved tools and configure the individual commands in the existing runner. Do not add an aggregate runner target; full checks run manually or in CI, not at commit time.

4. Wire pre-commit using the approved tool/framework. The hook runs format, then auto-fix, then re-stages changed files. The hook does not invoke the full quality commands; they belong in CI or manual runs.

5. Verify every individual command, then verify the hook with the least invasive supported method. Confirm the effective file scope, blocking severities, warning ratchet, suppression controls, and mutation behavior—not only a zero exit code. Fix underlying failures. This step is complete when each command behaves as agreed and the hook formats, fixes, and re-stages on a test run.

6. If the baseline carries accepted debt, document its current counts, target severities, and promotion criteria in the repository's existing engineering documentation; create a focused debt tracker only when no suitable home exists.

7. Invoke the `agents-md` skill to document the verified repository structure and quality commands. Finish when `AGENTS.md` lists every configured quality command and each listed command has explicit repository evidence.
