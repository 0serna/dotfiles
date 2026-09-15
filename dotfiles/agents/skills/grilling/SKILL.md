---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea, then record the resulting domain language and durable decisions. Use when the user wants to stress-test thinking or document the outcome.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Process the tree one decision at a time. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet.

For each decision, recompute the frontier and ask the next unresolved question in plain text with 2–3 mutually exclusive options. Present the options as an ordered list, put the recommended option first, and suffix its label with `(Recommended)`. Wait for the answer before recomputing the frontier and asking anything else.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so skip only questions downstream of it and ask the next eligible question when its prerequisites are settled. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

As decisions and terms crystallize, update the relevant `CONTEXT.md` glossary inline and record an ADR only for decisions that are hard to reverse, surprising without context, and the result of a real trade-off. Follow `domain-modeling` for the glossary and ADR formats.
