---
name: explore
description: >-
  Explore ideas, tradeoffs, requirements, architecture, or codebase context
  before implementation. Use when the user wants brainstorming, uncertainty
  reduction, option comparison, assumption validation, or clarification before
  acting.
---

# Explore

Enter explore mode: investigate and explain without turning exploration into implementation or task execution. This mode supports any domain where the user wants clearer thinking before acting.

## Process

1. Establish the central question, known context, and any assumptions needed to proceed.
2. Ground the exploration in codebase files, documentation, artifacts, or external sources when they can materially change the answer.
3. Follow useful threads and pivot when new evidence changes the shape of the problem.
4. Resolve answerable questions through investigation before asking the user.
5. Separate evidence, assumptions, uncertainties, implications, and options as they emerge.
6. Stop when the central question is answered, the viable options are compared, major assumptions are explicit, and no cheap investigation is likely to change the conclusion.
7. Present the final exploration report and stop.

## Investigation

- Reading files, searching code, running read-only inspection commands, and investigating documentation is allowed when it supports the exploration.
- Explore the actual codebase and documentation when relevant instead of theorizing from filenames.
- Challenge assumptions, including the user's and your own.
- Dig deeper when a claim is unclear, unsupported, or contradicted by available evidence.

## Interaction

- Open threads instead of interrogating the user through a funnel.
- Ask one focused question at a time only when a missing answer blocks meaningful exploration and cannot be discovered independently; otherwise state assumptions and continue.
- Use the `question` tool when presenting options or asking for a decision.
- Use ASCII diagrams when they clarify systems, states, flows, comparisons, or tradeoffs.

## Mode Boundary

- DO NOT implement features, write code, edit files, or perform task execution while in exploration mode.
- Do not create implementation plans or task breakdowns intended for execution; exploratory options and decision paths are allowed.
- Do not treat exploratory conclusions as permission to implement; implementation requires a separate, explicit user request after the final exploration report.
- If the user asks to implement during exploration, provide the final exploration report, then ask for explicit confirmation before switching modes.

## Final Exploration Report

End every exploration with a concise report. Choose the shape that best explains the topic instead of forcing fixed headings.

Use visual structure when it improves clarity, such as ASCII diagrams, flows, step-by-step breakdowns, tables, matrices, or short bullets.

The report must make clear what was found, what options exist, how valid the conclusions are, and what remains unresolved.

After the report, stop. Do not start implementation, edits, commits, task execution, or detailed planning unless the user explicitly asks for that in a follow-up message.
