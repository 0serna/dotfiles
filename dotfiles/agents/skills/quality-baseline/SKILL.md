---
name: quality-baseline
disable-model-invocation: true
description: Establish a quality baseline with runner commands, pre-commit auto-fix, and GitHub Actions CI.
---

## Workflow

1. **Audit via parallel crews**
   Discover which of these **surfaces** exist, then one explore **crew** (subagent) per present surface — in parallel:
   - **Runner** — package/task manifests, scripts, and local quality commands (format, lint, typecheck, test, build).
   - **CI** — workflow configs and how they invoke those commands; note the platform (GitHub Actions, GitLab CI, other, or none).
   - **Analyzers** — formatter, linter, typechecker, and test-tool configs; suppressions; ignored paths.
   - **Hooks** — pre-commit / staged-file frameworks and what they run today.

   Each crew accounts for, on its surface:
   - maintained production, test, script, and configuration files
   - justified exclusions such as generated artifacts
   - disabled or downgraded rules, suppressions, and ignored paths
   - whether each command verifies the tree or mutates it

   Crews run cheap checks on their surface and return a structured brief (no proposal, no edits). You aggregate. Done when every maintained file class is checked or rationalized across the briefs, and every hiding mechanism is accounted for.

2. **Propose a quality baseline** before changing files (you). A **quality baseline** is the agreed set of checks that must pass for the maintained tree to be in good standing (blocking findings, accepted debt, file scope). Plan three enforcement slices: individual runner commands for manual use, pre-commit auto-fix, and CI.

   Make these decisions explicit:
   - which findings block and which represent accepted debt
   - whether verification and auto-fix are separate commands
   - production and test policies, with narrow overrides where test doubles need them
   - maintained file scope and justified exclusions
   - suppression policy, including obsolete-directive detection and justification requirements where supported
   - formatter and analyzer ownership, avoiding duplicate work
   - migration strategy for existing debt
   - CI plan (see [CI defaults](#ci-defaults)): create, align, or skip writing Actions; job shape; triggers; runtime pin

   Prefer errors for new correctness risks. When existing debt prevents adoption, expose it as warnings and add an automated limit that only tightens (warning budget); reduce the budget whenever debt is removed, and promote a rule to blocking when its scoped count reaches zero. Ship the baseline in one change so the repository is not left knowingly failing.

   Also propose the pre-commit flow: format → auto-fix → re-stage. Prefer an existing staged-file orchestrator over a hand-rolled hook. Common options include `lint-staged` (Node), `pre-commit` (Python), `prek` (Rust), and `lefthook` (multi-language).

   The proposal is complete when the user has confirmed:
   - each individual command, target name, and blocking vs warning semantics
   - file scope, exclusions, and any scoped rule overrides
   - accepted-debt limit, if needed
   - formatter and auto-fixer commands
   - suppression policy
   - pre-commit tool/framework
   - CI plan (path, triggers, jobs/steps, runtime)
   - dependencies to install

3. Install approved tools and configure each quality command as its own runner target. Full baseline verification is separate manual invocations of those targets, or CI. Leave aggregate runner scripts (for example `npm run check`) out of the baseline.

4. Wire pre-commit using the approved tool/framework. The hook runs format, then auto-fix, then re-stages changed files. Keep typecheck, test, and build out of the hook; those stay on CI and manual runs.

5. **Materialize CI** per the confirmed plan and [CI defaults](#ci-defaults).
   - **GitHub Actions present or chosen:** write or align workflows so every non-mutating quality command from the baseline runs on CI. New workflow file: `.github/workflows/ci.yml`. When workflows exist only for release/deploy, add quality jobs without rewriting those pipelines. When quality jobs already exist, propose an alignment diff and apply only what the user confirmed. Leave unrelated jobs alone.
   - **Other CI platforms only:** document the quality commands for that platform; say clearly that this skill writes GitHub Actions only.
   - **No clear CI platform:** ask before creating `.github/`.

   Done when the on-disk workflow matches the confirmed plan, or when the branch is "document only" for a non-Actions platform.

6. Verify every individual quality command, then the hook with the least invasive supported method, then that CI invokes the same commands (read the workflow; run locally what CI will run). Confirm effective file scope, blocking severities, warning budget, suppression controls, and mutation behavior, not only a zero exit code. Fix underlying failures. Complete when each command behaves as agreed, the hook formats/fixes/re-stages on a test run, and CI wiring matches the baseline.

7. If the baseline carries accepted debt, document its current counts, target severities, and promotion criteria in the repository's existing engineering documentation; create a focused debt tracker only when no suitable home exists.

8. Invoke the `agents-md` skill to document the verified repository structure and quality commands. Finish when `AGENTS.md` lists every configured quality command and each listed command has explicit repository evidence.

## CI defaults

Use these unless the proposal records a deliberate override:

| Concern               | Default                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| New workflow path     | `.github/workflows/ci.yml`                                                                                               |
| Triggers (greenfield) | `pull_request` and `push` to the default branch                                                                          |
| Triggers (existing)   | Keep the repo's current trigger set; extend only if quality never runs on PRs                                            |
| Job shape             | One job, sequential steps (checkout → setup → each quality command). Parallel jobs only when the proposal justifies cost |
| Runtime               | Pin from repo evidence (`engines`, `.nvmrc`, `.node-version`, Volta, etc.); if none, `lts/*` and say so in the proposal  |
| Log format            | Ordinary tool output from each quality command                                                                           |

Quality commands on CI are the verifying ones (lint, typecheck, test, build as applicable). Skip mutating format targets unless the baseline explicitly checks formatting in check mode.
