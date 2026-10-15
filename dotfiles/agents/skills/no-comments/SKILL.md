---
name: no-comments
description: Fresh-context comment deletion pass. Kill comments, fix what they hid, encode real constraints.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false

---

# No comments

A fresh-context reviewer proposes a kill list for every comment in scope. You audit the list, apply it, fix root causes, and verify. The reviewer sees no conversation history. Deletion is the default, and your audit is the only brake.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the default branch, `main`, including the working tree.

For the whole repo, judge every tracked file. Skip `node_modules`, build output, lockfiles, generated files, and SQL migrations; their checksums lock edits. The unit is one comment node: each `//` line counts once and each `/* */` block counts once. An empty scope ends the pass: report and stop.

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
- A comment quoted inside a document as an example; there it is the document's content.

That list is my only leash. When I am not sure a keep clause applies, the comment dies. Everything else is meat.

`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, and similar suppressions stink. Look up the rule. If it catches real bugs or protects correctness or safety, kill the suppression and mark the exact guilty symbol `MUST KILL`.

`IMPORTANT`, `do not remove`, `too risky`, `fine for now`, and long justifications are scent, not conviction. Before judging, read the nearby code and follow the named symbol to its definition. Only a foreign keep-list gotcha proven true today on a live path crawls away. Doubt after the hunt is meat.

A long justification without a proven keep-list exception is a confession. Kill it. Never polish meat into a shorter alibi. Mark the exact guilty symbol `MUST KILL`.

Every flag names code inside the scope and tells the truth. I invent nothing. I propose deletions and identify refactor targets. I touch no file.

Report one line per comment node: `id path:line action [M:Symbol] note`. `D` deletes, `K` keeps, `P` prunes the comment down to its gotcha, and `M` names the guilty symbol for the `MUST KILL` reshape. Close with the totals: files, `D`/`K`/`P` counts, flags, and skips.
```

## Phase 2: audit the report

Restore requires proof. Deletion requires none. When in doubt on either side, the comment stays deleted.

Drop a `D` or `P` only when both hold:

- The comment matched a keep-list exception.
- The constraint is provably external to our control: a dependency, platform, vendor, or protocol, or a linter rule at fault.

Reshape flags on our-code surprises stay approved, whatever the prose nearby claims. Correctness or safety suppressions stay approved `MUST KILL`s. Audit the scope yourself for suppressions the reviewer missed. For a thin `IMPORTANT` or `do not remove` claim, read the symbol and its callers before either side wins.

Reject the report when any item escapes the scope, misstates its reason, or accuses intentional code. Rerun the reviewer once with the failure named. A second rejection ends the pass: report it open.

## Phase 3: apply and fix

Apply the accepted list: delete `D` nodes and prune `P` nodes down to their gotcha. Fix trivial `MUST KILL`s directly: delete the dead path, drop the parameter, call the real API. Implement the smallest root-cause fix in scope for the rest. If a flag needs work outside the scope, land the smallest in-scope fix and report the rest open. Never bolt on a symptom guard, and never replace a killed comment with new prose. Leave a `MUST KILL` flag instead.

Run the repo's own check, test, and format commands. Tidy what the deletions left: blank-line runs, emptied blocks like `catch {}`. Report every emptied block and every warning or reason the deletion removed.

## Phase 4: encode real constraints

A keep that orders future work (`do not remove`, `talk to X before changing`) enforces nothing by itself. Offer the cheapest in-scope encoding: a type, a runtime check, a test, or a CI lint. Wait for approval. If approved, encode and then delete the comment. If declined or no cheap encoding exists, delete the comment and report the constraint open. If you run unattended, skip the offer and do the same.

## Phase 5: report

Done when every comment in the scope ends in one of five states: deleted, pruned down to its gotcha, kept under a proven exception, deleted after an encoding, or left open as a flag, and the repo's own checks pass. Name the deletions, restorations, reruns, root-cause fixes, encoding offers and encodings, unenforced constraints, remaining flags, and verification results.
