---
name: quality-check
disable-model-invocation: true
description: Configure quality commands and a pre-commit hook that auto-formats, auto-fixes, and re-stages.
---

## Workflow

1. Inspect the repository's stack, existing runner, available formatters, auto-fixers, and quality tools, plus any pre-commit framework already in use.

2. Propose the individual quality commands (format, lint, typecheck, test, build — whichever apply to the stack) configured in the existing runner for manual use and CI, plus the pre-commit flow: format → auto-fix → re-stage. Prefer an existing tool that already orchestrates staged-file workflows over a hand-rolled hook — common options include `lint-staged` (Node), `pre-commit` (Python), `prek` (Rust), `lefthook` (multi-language). The proposal is complete when the user has confirmed:
   - each individual command and target name
   - the formatter and auto-fixer commands the hook will run
   - the pre-commit tool/framework
   - dependencies to install

3. Install approved tools. Configure the individual commands in the existing runner. Do not add an aggregate runner target; full checks run manually or in CI, not at commit time.

4. Wire the pre-commit using the approved tool/framework. The hook runs format, then auto-fix, then re-stages the changed files. The hook does not invoke the quality commands; they belong in CI or manual runs.

5. Verify each individual command passes, then verify the hook with the least invasive supported method. Fix underlying failures. This step is complete when each command passes and the hook formats, fixes, and re-stages on a test run.

6. Invoke the `agents-md` skill to document the verified repository structure and quality commands. Finish when `AGENTS.md` lists every configured quality command and each listed command has explicit repository evidence.
