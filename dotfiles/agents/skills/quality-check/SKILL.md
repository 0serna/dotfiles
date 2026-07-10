---
name: quality-check
disable-model-invocation: true
description: Configure repository quality commands and a pre-commit quality gate.
---

## Workflow

1. Inspect the repository's stack, existing runner, quality tooling, commands, and pre-commit mechanism.

2. Propose the smallest relevant set of individual quality commands. Cover build, format, lint, and test when applicable, plus any project-specific checks worth adding. Always ask whether to include OpenSpec, even when the repository has no OpenSpec evidence. Prefer existing conventions and runner targets. The proposal is complete when the user has confirmed:
   - every individual command and target name
   - the aggregate quality-gate target and its commands
   - tools and dependencies to install
   - the pre-commit mechanism

3. After confirmation, install approved tools and configure the individual commands in the repository's existing runner, such as package scripts or Make targets. Add an aggregate runner target that chains the confirmed quality-gate commands; keep orchestration in the runner rather than a standalone script.

4. Configure pre-commit using the existing hook framework, or an approved project-appropriate mechanism when none exists. Run these steps in order:
   1. format
   2. auto-fix
   3. re-stage files changed by those commands
   4. invoke the aggregate quality-gate target

5. Run every configured quality command and verify the pre-commit flow with the least invasive supported method. Fix underlying failures. Finish when the commands and aggregate target pass, and the hook formats, fixes, re-stages, and blocks the commit when the quality gate fails.
