---
name: remove-openspec
disable-model-invocation: true
description: Remove OpenSpec from a repository and migrate the decisions worth keeping to ADRs.
metadata:
  opencode/autoinvoke: false

---

# Remove OpenSpec

Removes OpenSpec from a repository and keeps the decisions that still matter as ADRs. Load the `domain-modeling` skill for the ADR bar, format, and glossary rules.

Scope: one repository plus the machine state its skills depend on.

## 1. Inventory

List every OpenSpec artifact before deleting:

- `openspec/`: `config.yaml`, `changes/` (active and archived), `specs/`
- skills named `openspec-*`: repo copies and installed links
- CLI and state: `command -v openspec`, the global package, `~/.config/openspec`
- automation: repo references (`grep -ri openspec`), scripts, CI, package manifests
- existing `docs/adr/` and `GLOSSARY.md`

Completion: each artifact has a path and a disposition.

## 2. Report the migration

Read every change's `proposal.md` and `design.md`, then the specs. Classify each item:

- **ADR**: meets all three domain-modeling criteria and no existing ADR covers it.
- **Covered**: an existing ADR records it; cite that ADR instead of restating it.
- **Dead**: describes code or tooling that no longer exists.
- **Skip**: rename, behavior contract, or obvious choice.

Report a table before writing. Ask which ADRs to write.

An active change (`changes/<name>` outside `archive/`) is unfinished work. Ask whether to finish it, turn it into an ADR, or discard it. Stop until the user decides.

Completion: the user approves the list.

## 3. Write the ADRs

- Number after the highest number in `docs/adr/`.
- One decision per file, in the domain-modeling format.
- Create `GLOSSARY.md` only for terms the specs used ambiguously.
- Keep behavior contracts in tests, not ADRs.

Completion: every approved decision is exactly one ADR, and no ADR duplicates a decision already recorded.

## 4. Remove

Delete in dependency order:

1. Skills `openspec-*`, in the repo and at their installed locations.
2. `openspec/`.
3. Automation entries: updater, scripts, CI.
4. References in `AGENTS.md`, `README.md`, and docs.
5. CLI package and config or state directories.

Use `git rm` so history stays recoverable. Preserve the only record of shipped behavior: convert it to a test or an ADR before deleting the spec that holds it.

Completion: `grep -ri openspec .` finds nothing outside `.git`, and the repository's test, typecheck, and format commands pass.
