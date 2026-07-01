---
name: quality-check
disable-model-invocation: true
description: Configure and maintain a repository quality check with concise agent-readable output and pre-commit integration.
---

Use this skill only when invoked by the user. The check is the repository's agreed validation command: it runs every selected tool, hides successful output, shows failed tool details, always prints a summary, and exits non-zero when any tool fails.

## Workflow

### 1. Inspect the repository

Read evidence before proposing changes. Classify every configured tool, runner, check entrypoint, and pre-commit path as present, absent, or ambiguous.

Inspect dependency manifests, task runners and package scripts, check-related commands (`check`, `lint`, `typecheck`, `test`, `validate`, `ci`, `precommit`), format/autofix commands, pre-commit frameworks (husky, lefthook, lint-staged, overcommit, pre-commit), and tool configs for the detected stack.

### 2. Build the evidence table

Classify tools in three groups:

| Group      | Meaning                                              | Disposition                |
| ---------- | ---------------------------------------------------- | -------------------------- |
| Configured | Dependency, config, script, or runner entry exists   | Prefer preserving/adapting |
| Relevant   | Stack evidence exists but no tool is configured      | Propose conservatively     |
| Unclear    | Evidence conflicts or multiple choices are plausible | Ask the user               |

Use a conservative catalog after configured tools are accounted for:

| Stack evidence        | Common check candidates                                          |
| --------------------- | ---------------------------------------------------------------- |
| JavaScript/TypeScript | eslint or biome, `tsc --noEmit`, test script, knip               |
| Python                | ruff, mypy or pyright, pytest, tox/nox                           |
| Go                    | `go test ./...`, `go vet ./...`, golangci-lint                   |
| Rust                  | `cargo check`, `cargo test`, `cargo clippy`, `cargo fmt --check` |
| Ruby                  | rubocop, rspec, rake test                                        |
| PHP                   | phpstan or psalm, phpunit, composer validate                     |
| Java/Kotlin           | gradle/maven test, check, lint, static analysis tasks            |
| Docs/specs            | markdownlint, vale, openspec validate                            |
| Containers/IaC        | hadolint, shellcheck, terraform fmt/validate, tflint             |

Do not propose every candidate. Propose the smallest useful set for the repository's visible stack and conventions.

### 3. Decide runner and command shape with the user

Validate the execution vehicle before writing anything. Recommend in this order: (1) existing repository runner (Make, Just, Taskfile, package scripts, tox/nox, cargo, rake, composer), (2) runtime from the primary stack (Node, Python, Go, Rust, Ruby, PHP), (3) Bash fallback. Ask the user to confirm the check entrypoint, runner/runtime, selected tools and commands, format/autofix commands, dependencies to add, whether existing commands are preserved or adapted, and the pre-commit mechanism.

### 4. Preserve or adapt commands

Classify each selected command as **preserved** (opaque runner/orchestrator kept verbatim), **adapted** (recognized tool adjusted for concise machine-readable output), **added** (new command accepted by the user), or **skipped** (rejected or not applicable).

Rules:

- Preserve opaque commands such as `make lint`, `nx run-many`, `turbo run`, `tox`, `gradle check`, or pipelines unless the user explicitly wants expansion.
- Expand script aliases only one level deep.
- Prefer native parseable flags when available: JSON, terse, quiet, no-progress, or equivalent.
- Keep formatters out of the check unless they run in check mode, such as `fmt --check`.
- Include tests only when selected as part of the repository check.

### 5. Define the output contract

Implement the same contract in the confirmed runner/runtime. Finish when the script or runner entrypoint guarantees:

- all selected tools run even after failures
- successful tool details are hidden
- failed tool details are printed under a stable delimiter such as `---CHECK:<tool>---`
- `---CHECK:SUMMARY---` and `---CHECK:DONE---` are always printed
- every selected tool appears in the summary as PASS or FAIL
- the final exit code is non-zero if any tool failed

Do not use fail-fast behavior for the check entrypoint. In shell scripts, do not use `set -e` around tool execution.

### 6. Integrate pre-commit

Pre-commit must run confirmed format/autofix commands before the full check, then add modified files back to the commit. Finish when the selected pre-commit mechanism exists, is executable when required, runs format/autofix, re-stages changed files, and invokes the confirmed check command without substituting a lighter profile.

Preserve the repository's existing hook framework when present. If none exists, ask which mechanism to use before adding one. Prefer the framework's native re-stage behavior when available; otherwise use the repository's VCS command, such as `git add` for Git.

### 7. Confirm before modifying

Before edits, present one consolidated change set and ask for confirmation. Include:

- files to create or update
- command names and entrypoints
- selected runner/runtime
- selected tools and exact commands
- preserved opaque commands
- adapted commands and output flags
- dependencies to add
- pre-commit mechanism, format/autofix command, re-stage command, and check command

Do not implement until the user confirms the whole set.

### 8. Verify

After implementation, run the agreed check command and the pre-commit command or hook in the least invasive supported way. Finish when:

- all selected tools executed
- passing tools did not emit details
- failing tools emitted delimited details
- summary and done delimiters appeared
- exit code semantics are correct
- pre-commit runs format/autofix before the check
- pre-commit re-stages files modified by format/autofix
- pre-commit invokes the full check

If verification fails, fix the underlying issue instead of suppressing the tool.

## Rules

- Prefer existing repository conventions over the catalog.
- Do not add stack-specific tooling without explicit user confirmation.
- Keep generated script files executable when the platform requires it.

## Output

Report:

- check entrypoint created or updated
- runner/runtime used
- tools preserved, adapted, added, skipped
- dependencies added
- pre-commit integration created or updated
- format/autofix and re-stage behavior
- verification result
