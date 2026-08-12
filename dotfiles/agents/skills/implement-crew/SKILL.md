---
name: implement-crew
description: "Orchestrate implementation tickets across a crew of subagents — one ticket per crew, gate (validate + commit + close) before the next."
disable-model-invocation: true
---

# Implement crew

Advance a set of **implementation** tickets by working the **frontier**: unlock → **crew** → **gate** → next. You are the orchestrator. Crews implement; you validate, commit, and **close** each ticket.

Not for wayfinder decision maps. Not a substitute for `/implement` on a single ticket in the current agent — reach for this when the slice is a ticket DAG and you want subagent isolation between tickets.

The issue tracker should have been provided — run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing.

## Defaults

Override only when the user says so:

- **One ticket → one crew** (fresh subagent per ticket).
- **Sequential frontier** — even when several tickets are unlocked, take one at a time in dependency / numbering order.
- **Crew does not commit.** Gate owns the commit.
- **Gate closes the ticket** after PASS+commit (comment with commit hash, then close). Leave the parent/spec issue open unless the user asks to close it.
- Stay on the current branch; keep HEAD attached.

## Process

### 1. Pin the slice

Resolve what to build from the user's argument (parent issue, ticket list, or conversation). Fetch each ticket's title, body, blockers, and acceptance criteria.

Done when: every ticket in the slice is listed with its blockers, and the initial **frontier** (open, unblocked) is known.

### 2. Lock the base

Record `git branch --show-current` and `BASE=$(git rev-parse HEAD)`. All later gates commit on this branch; the final review diffs `BASE...HEAD`.

Done when: branch name and `BASE` are noted and HEAD is not detached.

### 3. Work the frontier

While the frontier is non-empty:

1. **Pick** the next frontier ticket (lowest number / dependency order).
2. **Dispatch a crew** — background subagent whose only job is that ticket. Prompt must include:
   - ticket id/url and acceptance criteria
   - workspace path and required branch
   - `/tdd` at pre-agreed seams; follow `AGENTS.md` / domain docs
   - **do not commit**; leave a clean report (files, tests, out-of-scope, risks)
   - do not start other tickets
3. When the crew returns, run the **gate** (below). Do not pick another ticket until the gate passes, the commit lands, and the ticket is closed on the tracker.
4. **Recompute the frontier** from the tracker: open tickets whose blockers are all closed (see `docs/agents/issue-tracker.md`).

Done when: the frontier is empty — every ticket in the slice is closed with a gate-passing commit, or the user stopped the run.

### 4. Gate

For the ticket just returned:

1. Diff the working tree against the ticket's acceptance criteria (and the parent spec if the ticket points at one).
2. Confirm scope: this ticket only; no premature work on blocked siblings.
3. Confirm branch still attached; re-run focused tests if the crew's report is thin; require green for what this ticket owns.
4. **PASS** → stage only this ticket's files; commit on the current branch (user commit protocol / HEREDOC); verify clean tree and attached HEAD; then on the tracker: comment with the commit hash (and a one-line gist), **close the ticket**. Do not close the parent/spec issue here.
5. **FAIL** → do not commit or close; **resume the same crew** with a precise fix list (file + expected change). Repeat gate until PASS.

Done when: one new commit on the branch **and** the ticket is closed on the tracker, or an explicit user abort.

### 5. Review the slice

When the frontier is empty, run `/code-review` with fixed point `BASE` (or `BASE...HEAD`). Spec source: parent issue / tickets in the slice.

Done when: the two-axis report is delivered. Do not push unless the user asks.

## Crew vs gate

|                         | Crew  | Gate (you)                   |
| ----------------------- | ----- | ---------------------------- |
| Implement / TDD / tests | yes   | no (re-check only as needed) |
| Commit                  | never | on PASS                      |
| Close ticket            | never | on PASS (after commit)       |
| Start the next ticket   | never | after PASS+commit+close      |

## Pointing

- Single-ticket, same agent: `/implement`
- Breakdown into tickets: `/to-tickets`
- Decision fog before build: `/wayfinder`
