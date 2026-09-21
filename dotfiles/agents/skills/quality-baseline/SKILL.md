---
name: quality-baseline
disable-model-invocation: true
description: Establish a quality baseline — runner targets, pre-commit auto-fix, and GitHub Actions CI.
metadata:
  opencode/autoinvoke: false

---

## Workflow

1. **Audit surfaces** (parallel crews)
   One explore crew per present surface:
   - **Runner** — manifests, scripts, quality targets (`check`, `typecheck`, `test`, `build`)
   - **CI** — workflows and how they invoke targets; note the platform
   - **Analyzers** — `biome.json` and other tool configs, suppressions, ignored paths
   - **Hooks** — pre-commit / staged-file frameworks

   Each crew returns a brief (no proposal, no edits) covering maintained file classes, justified exclusions, suppressions, and whether each command verifies or mutates.

   Done when every maintained file class is checked or rationalized, and every hiding mechanism is accounted for.

2. **Propose baseline** (before edits)
   A **quality baseline** is the agreed checks that must pass for the maintained tree (blocking findings, accepted debt, file scope). Plan three **slices**: runner targets, pre-commit auto-fix, and CI.

   Node/TypeScript repos default to [Biome](#biome-defaults) unless the audit shows a strong reason to keep another stack.

   Record explicitly: blocking vs debt, verify vs fix commands, file scope and exclusions, suppression policy, analyzer ownership, debt migration, and the [CI plan](#ci-defaults).

   New correctness risks block. Existing debt may ship as warnings with a **warning budget** that only tightens; promote a rule to blocking when its scoped count reaches zero. Ship the baseline in one change.

   Propose pre-commit as format → fix → re-stage via an existing orchestrator (`lint-staged`, `pre-commit`, `prek`, `lefthook`).

   Done when the user has confirmed every target name, scope, hook tool, CI plan, and dependency.

3. **Install targets**
   One **target** per tool. A single analyzer may bundle related work in one target (`biome check` covers format, lint, and imports). A **meta-script** that chains multiple tools stays out — `typecheck`, `test`, and `build` each keep their own target.

   Done when every agreed target runs from the package manifest (or equivalent) and mutating targets are separate from verifying ones.

4. **Wire pre-commit**
   The hook runs format → fix → re-stage. Typecheck, test, and build stay on CI and manual runs.

   Node/Biome repos: `lint-staged` → `biome check --write --no-errors-on-unmatched` on `*.{js,jsx,ts,tsx,json,jsonc}`.

   Done when a test commit triggers auto-fix and re-stage.

5. **Materialize CI** per the confirmed [CI defaults](#ci-defaults).
   - **GitHub Actions:** write or align `.github/workflows/ci.yml`; add quality jobs without rewriting unrelated pipelines.
   - **Other platforms:** document commands; this skill writes Actions only.
   - **No CI platform:** ask before creating `.github/`.

   Done when the on-disk workflow matches the confirmed plan.

6. **Verify**
   Run every verifying target, then the hook, then confirm CI invokes the same commands locally.

   Done when scope, severities, warning budget, and mutation behavior match the proposal — not only exit codes.

7. **Document debt** when the baseline carries accepted debt: counts, target severities, promotion criteria. Create a debt tracker only when no suitable home exists.

8. **Invoke `agents-md`** to list every quality target in `AGENTS.md` with repository evidence.

## Biome defaults

For Node/TypeScript repos unless the proposal overrides.

### Targets

| Target      | Command                 |
| ----------- | ----------------------- |
| `check`     | `biome check .`         |
| `check:fix` | `biome check --write .` |

Add `typecheck` and `test` as separate targets when they apply. Expose `check` and `check:fix` only — Biome already covers format, lint, and import order.

Scope: JavaScript, TypeScript, and JSON. Reach for a second formatter for Markdown, YAML, or shell only when the proposal justifies it.

### Minimal `biome.json`

Rely on Biome defaults (`recommended`, built-in import organization). Keep the file **minimal**: only non-default options.

| Option | When to include |
| ------ | --------------- |
| `vcs` | repo uses git |
| `files.includes` | repo-specific exclusions |
| `formatter.indentStyle` | repo uses spaces |
| `formatter.includes` | limit to code extensions |

Put exclusions in `files.includes`; the linter inherits them. Add `linter.includes` only for a lint-only override.

Exclude only paths Biome and `.gitignore` (via `vcs.useIgnoreFile`) do not already skip. Trim migration output from `biome migrate eslint` / `biome migrate prettier` to non-default settings. Override `linter.rules` only beyond `recommended`.

## CI defaults

Unless the proposal overrides:

| Concern | Default |
| ------- | ------- |
| Path | `.github/workflows/ci.yml` |
| Triggers (greenfield) | `pull_request` and `push` to default branch |
| Triggers (existing) | keep current; extend only if quality never runs on PRs |
| Job shape | one job, sequential steps |
| Step order (Node/Biome) | `check` → `typecheck` → `test` when each applies |
| Runtime | pin from `engines`, `.nvmrc`, `.node-version`, Volta; else `lts/*` and note in proposal |
| CI commands | verifying targets only |
