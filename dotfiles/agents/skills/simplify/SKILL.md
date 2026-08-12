---
name: simplify
description: >-
  Lean code, docs, or the current diff — drop dead code, dedupe, prefer
  native utilities, flatten wrappers. Use when the user says simplify, dedupe,
  clean up, or remove dead code.
---

# Simplify

Make the scoped work leaner without changing observable behavior. You are the
**orchestrator**: lock scope, partition into **clusters**, dispatch **crews**
when the scope fans out, then **Merge** across clusters, verify, and report.

## Lean ladder

Stop at the first rung that yields a high-confidence, behavior-preserving edit:

1. **Delete** code, comments, docs, imports, exports, files, branches, or parameters that no longer need to exist.
2. **Rename** symbols to be self-describing; delete the comments the rename made redundant.
3. **Replace** custom code with standard library, language, platform, or framework utilities.
4. **Replace** custom code with already-installed project dependencies.
5. **Merge** duplicated logic, docs, or configuration into one source of truth.
6. **Flatten** unnecessary nesting, branching, indirection, wrappers, helpers, or abstractions.
7. **Express** the same behavior more directly with nearby conventions.

## Workflow

1. **Lock scope**
   - If files, paths, symbols, docs, or a diff range are given, use them.
   - Otherwise treat the current working tree (staged, unstaged, untracked) as scope and list every changed file.
   - Complete when the in-scope path list is final.

2. **Partition into clusters**
   - Skim paths and layout enough to group by edit surface — not a full read of every file.
   - A **cluster** is a path set one crew owns exclusively. Shared helpers: hold for parent **Merge**, or fold every dependent into one cluster.
   - Prefer one cluster when the scope is small or tightly coupled.
   - Complete when every in-scope path is in exactly one cluster or held for the parent **Merge**.

3. **Simplify each cluster**
   - **One cluster** → apply the lean ladder yourself (including in-cluster **Merge**).
   - **Several clusters** → one **crew** (subagent) per cluster in parallel. Each crew prompt includes:
     - absolute workspace path and that cluster's exact path set
     - the lean ladder, with **Merge** only inside the cluster; surface cross-cluster duplicates without editing outside the set
     - the Guardrails below
     - apply the smallest correct edits; remove orphans the edit creates
     - return: edits by rung, rejected behavior-changing candidates, cross-cluster **Merge** candidates
   - A crew with nothing high-confidence reports `Lean already` and edits nothing.
   - Complete when every cluster has an inline pass or a crew report.

4. **Cross-cluster Merge (you)**
   - Apply high-confidence **Merge** candidates that span clusters (and any paths held in step 2); clean orphans.
   - If every cluster was already lean and no cross-cluster merge earns an edit, return `Lean already. Ship.` and stop before verify.
   - Complete when cross-cluster duplicates are merged or explicitly deferred in the report.

5. **Verify**
   - Run the project's quality gate when one exists.
   - Otherwise run the tests, typecheck, or lint that cover the touched code.
   - If verification fails, fix the regression before reporting; the simplification is not done until it passes.

6. **Report**
   - State the scope and the cluster partition from steps 1–2 so the user can redirect in one round.
   - List simplifications (inline and per crew) and the lean-ladder rung each came from.
   - State what verification ran and the result.
   - Surface rejected behavior-changing candidates and any deferred cross-cluster merges.

## Guardrails

- Preserve public behavior, APIs, persistence formats, side effects, accessibility, security boundaries, and error handling.
- Prefer already-installed dependencies and native APIs; do not add new ones.
- Stay obvious. Clever code is not simpler.
- Prefer self-describing names over comments; keep a comment only when the information cannot live in a name (external constraint, bug-tracker reference, regulatory requirement).
- Proceed immediately with the default scope (working tree) when none is given.
- Do not commit, stage, revert, or stash user changes.
- A candidate that changes behavior, structure, or user-facing meaning is **not** a simplification — surface it and leave it unapplied.
