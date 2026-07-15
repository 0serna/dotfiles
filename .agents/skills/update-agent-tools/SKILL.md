---
name: update-agent-tools
disable-model-invocation: true
description: Update curated agent CLIs and binaries used by these dotfiles.
---

Update the curated agent tools used by this dotfiles repository. Update installed tools only; regenerate nothing.

## Scope

| Tool         | Method                             | Version check          |
| ------------ | ---------------------------------- | ---------------------- |
| `playwriter` | `npm install -g playwriter@latest` | `playwriter --version` |
| `ketch`      | `brew upgrade ketch`               | `ketch --version`      |
| `skills`     | `npx skills update -g -y`          | `npx skills --version` |

## Workflow

1. Capture the pre-update version for each scoped tool using the version check from the scope table. If the version command fails, record `not found`; do not stop.

2. For tools with pre-update version `not found`, skip the update and mark the tool `failed` with message `not installed`. Continue to the next tool.

3. Run every remaining update method from the scope table directly, without asking for confirmation. If an update command fails, mark only that tool `failed` and continue.

4. If the `skills` update command produced output, parse it to identify updated skill names (lines matching `✓ Updated <skill-name>`), regardless of exit status.

5. Capture the post-update version using the same checks as step 1. A failed post-update version check is not an update failure when the update command itself succeeded.

6. Run the project's configured file formatter before returning.

7. Return a compact summary: one row per tool with name, update method, status (OK or failed), version before and after (or `not verifiable`), and any short failure message. Report versions only; omit paths. If the `skills` tool updated any skill names, list them.
