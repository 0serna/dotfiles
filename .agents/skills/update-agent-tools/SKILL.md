---
name: update-agent-tools
disable-model-invocation: true
description: Update curated agent CLIs and binaries used by these dotfiles.
---

Update the curated agent tools used by this dotfiles repository.

Guardrails:

- Update installed tools only.
- Do not modify repository files or regenerate generated content.
- Do not scan for new commands or broaden the tool list.
- Report versions only; omit paths.

## Scope

Update these tools with these exact methods:

| Tool         | Method                             | Version check          |
| ------------ | ---------------------------------- | ---------------------- |
| `playwriter` | `npm install -g playwriter@latest` | `playwriter --version` |
| `ctx7`       | `npm install -g ctx7@latest`       | `ctx7 --version`       |
| `skills`     | `npx skills update -g -y`          | `npx skills --version` |

## Workflow

1. Capture the pre-update version for each scoped tool using the version check from the scope table. If the version command fails, record `not found`; do not stop.

2. For tools with pre-update version `not found`, skip the update and mark the tool `failed` with message `not installed`.

3. Run every remaining update method from the scope table directly, without asking for confirmation.

4. Continue to the next tool if an update command fails.

5. If the `skills` update command produced output, parse it to identify updated skill names (lines matching `✓ Updated <skill-name>`), regardless of exit status.

6. Capture the post-update version using the same checks as step 1.

7. Return a compact summary for every tool (versions only, no paths). Derive status from the update command, not the version check. If the `skills` tool updated any skill names, list them.

## Failure Handling

- If a tool is not installed before the update, count only that tool as failed and continue.
- If `npm install -g ...` or `npx skills update -g -y` fails, count only the affected tool as failed and continue.
- Post-update version checks are best effort. A failed post-update version check is not an update failure when the update command itself succeeded.

## Output

Return a concise summary with one row per tool:

- tool name
- update method
- status: OK or failed
- version before and after, or `not verifiable`
- any short failure message

If the `skills` tool updated any skill names, list them.
