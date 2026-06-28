# Protect skill read results from large-output pruning

## Summary

Keep `read` results for `SKILL.md` files available in transient model context unless a deterministic non-size pruning rule applies.

## Motivation

Skill files contain operational instructions. Treating a stale, large `SKILL.md` read like generic evidence can remove workflow rules from context. Broadly protecting all `read` results would retain too much raw evidence, so the protection should be limited to explicit `SKILL.md` reads.

## Scope

- Detect `read` tool results whose target path ends with `SKILL.md`.
- Exclude those results from `stale_large` pruning.
- Preserve duplicate, resolved, and superseded pruning behavior.
