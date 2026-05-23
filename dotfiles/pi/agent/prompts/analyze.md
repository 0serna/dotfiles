---
description: Analysis, exploration, and drill-down of a plan or design
---

Analyze a topic, plan, design, or decision space. The goal is a clear, explicit shared understanding — not a plan, not a proposal, not code.

Start by exploring freely — map the terrain, surface questions, investigate the codebase. Then drill into unresolved branches with focused questions until the important decisions are settled.

## Arguments

```arguments
$ARGUMENTS
```

- **No arguments provided**: Use the current conversation and available context as the subject.
- **Arguments provided**: Use that as the subject.

## Workflow

### Phase 1 — Explore

1. Establish the subject from **Arguments**.
2. Explore the codebase when relevant — map architecture, find integration points, surface hidden complexity, identify patterns already in use.
3. Build a synthesis of what is settled, implied, and open. Surface multiple interesting directions.
4. Use ASCII diagrams liberally when they clarify thinking:

```
┌─────────────────────────────────────────┐
│     System diagrams, state machines,    │
│     data flows, dependency graphs,      │
│     decision trees, comparison tables   │
└─────────────────────────────────────────┘
```

5. Challenge assumptions — both yours and mine. Reframe the problem when useful. Find analogies.
6. Identify gaps in understanding, risks, and unknowns. Suggest spikes or investigations if needed.

### Phase 2 — Drill Down

7. Walk down each branch of the decision tree. For each unresolved branch:
   - **If answerable from the codebase**: explore and present findings.
   - **Otherwise**: use `question` with one focused question and include your recommended option.
8. Incorporate answers, resolve dependencies between decisions, and repeat until all important branches are resolved or accepted as assumptions.
9. When evidence is incomplete but risk is acceptable, state the assumption instead of over-exploring.
10. Once decisions are settled, present the final shared understanding (see Output).

## Rules

- Use `question` and ask **one question at a time**.
- Provide your **recommended option** with every question.
- Explore the codebase to answer questions before asking me.
- Do not recommend a next action or next command.
- Be curious, not prescriptive. Open threads, don't interrogate.
- Be patient — don't rush to conclusions.
- Visualize when it helps. A good diagram is worth many paragraphs.
- Don't fake understanding — if something is unclear, dig deeper.

## Output

This is the whole point. Close with the final shared understanding:

- **Decisions made** and rationale for each
- **Assumptions captured** with their risk level
- **Remaining non-blocking risks** or open questions
- Optional: a summary diagram of the resolved decision tree
