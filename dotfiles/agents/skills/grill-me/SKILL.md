---
name: grill-me
description: >-
  Interview the user about a plan, design, idea, architecture choice, or
  decision space until important branches are resolved and shared understanding
  is explicit. Use when the user asks to be grilled, challenged, interviewed, or
  walked through decisions without implementation.
---

# Grill Me

Interview the user about a plan, design, or decision space until important branches are resolved and the shared understanding is explicit, without turning the discussion into implementation work.

## Workflow

1. Establish the subject from the user's request and the current conversation.
2. If there is no prior context or clear subject, ask what to grill on before proceeding.
3. Build a quick synthesis of what is settled, implied, and open.
4. Walk down each branch of the decision tree.
5. For each unresolved branch, explore the codebase or relevant documentation if the answer is available there; otherwise ask one focused question.
6. Incorporate answers, resolve dependencies between decisions, and repeat until all important branches are resolved or accepted as assumptions.
7. Present the final grounded understanding for acknowledgment.

## Rules

- Use the native interactive question tool (`question` / `request_user_input` / `AskUserQuestion`) for decisions and ask one question at a time.
- Provide a recommended answer with every question.
- If a question can be answered by exploring the codebase or documentation, explore instead of asking.
- Do not create plans, specifications, tasks, proposals, or code changes.
- Do not recommend a next action or next command.
- When evidence is incomplete but risk is acceptable, state the assumption instead of over-exploring.

## Output

Present the final shared understanding:

- decisions made
- assumptions captured
- remaining non-blocking risks
