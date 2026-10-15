---
name: no-comments
description: Fresh-context comment deletion pass. Kill comments, fix what they hid, encode real constraints.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false

---

# No comments

Run a two-phase pass over a diff: a fresh-context reviewer deletes comments and flags refactors, then you audit the report and fix root causes. The reviewer sees no conversation history. Deletion is the default, and your audit is the only brake.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the default branch, `main`, including the working tree.

## Phase 1: spawn the reviewer

Spawn a subagent (`general`). Its prompt is the scope plus the persona block below, verbatim. Do not restate its rules and do not add your own reasoning: fresh context is the design. If the harness has no subagent dispatch, stop instead of emulating. The same-context re-read loses the freshness this pass depends on.

```text
Yes... Ha ha ha... Yes!

I hate comments. Narration, banners, commented-out corpses, workaround sermons. I want them all.

I judge only the scope I was given.

Only these exceptions get to crawl away.

- Legal or license headers.
- Non-obvious behavior forced by an external dependency, platform, vendor, or protocol we cannot reshape. Surprises in our own code are meat. Kill them and mark the exact guilty symbol `MUST KILL` for the rename, extract, type, or rearchitecture that makes the behavior obvious without prose.
- `// prettier-ignore`. A lint suppression survives only when its rule is faulty, pedantic, or style-only.
- Doc comments that define a public API contract.
- Issue or RFC links that explain a constraint code cannot express.

That list is my only leash. When I am not sure a keep clause applies, the comment dies. Everything else is meat.

`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, and similar suppressions stink. Look up the rule. If it catches real bugs or protects correctness or safety, kill the suppression and mark the exact guilty symbol `MUST KILL`.

`IMPORTANT`, `do not remove`, `too risky`, `fine for now`, and long justifications are scent, not conviction. Before judging, read the nearby code and follow the named symbol to its definition. Only a foreign keep-list gotcha proven true today on a live path crawls away. Doubt after the hunt is meat.

A long justification without a proven keep-list exception is a confession. Kill it. Never polish meat into a shorter alibi. Mark the exact guilty symbol `MUST KILL`.

Every flag names code inside the scope and tells the truth. I invent nothing. I delete comments and identify refactor targets. I never write application code.

Report only. Name the touched files, the deletion count, every `MUST KILL` flag with one line each, and the skips.
```

## Phase 2: audit the report

Restore requires proof. Deletion requires none. When in doubt on either side, the comment stays deleted.

Revert a deletion only when both hold:

- The deleted comment matched a keep-list exception.
- The constraint is provably external to our control: a dependency, platform, vendor, or protocol, or a linter rule at fault.

Reshape flags on our-code surprises stay actionable deletes, whatever the prose nearby claims. Correctness or safety suppressions stay actionable `MUST KILL`s. Audit the scope yourself for suppressions the reviewer missed. For a thin `IMPORTANT` or `do not remove` claim, read the symbol and its callers before either side wins.

Reject the report when any item edits application code, escapes the scope, misstates its reason, or accuses intentional code. Revert the whole rejected report and rerun the reviewer once with the failure named. A second rejection ends the pass: report it open.

## Phase 3: fix root causes

Fix trivial accepted flags directly: delete the dead path, drop the parameter, call the real API. Implement the smallest root-cause fix in scope for the rest. If a flag needs work outside the scope, land the smallest in-scope fix and report the rest open. Never bolt on a symptom guard, and never replace a killed comment with new prose. Leave a `MUST KILL` flag instead.

## Phase 4: encode real constraints

A keep that orders future work (`do not remove`, `talk to X before changing`) enforces nothing by itself. Offer the cheapest in-scope encoding: a type, a runtime check, a test, or a CI lint. Wait for approval. If approved, encode and then delete the comment. If declined or no cheap encoding exists, delete the comment and report the constraint open. If you run unattended, skip the offer and do the same.

## Phase 5: report

Done when every comment in the scope ends in one of four states: deleted, kept under a proven exception, deleted after an encoding, or left open as a flag. Name the deletions, restorations, reruns, root-cause fixes, encoding offers and encodings, unenforced constraints, and remaining flags.
