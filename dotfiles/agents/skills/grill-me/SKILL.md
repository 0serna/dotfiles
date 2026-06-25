---
name: grill-me
disable-model-invocation: true
description: Pressure-test a plan, design, idea, architecture choice, or decision space.
---

# Grill Me

Pressure-test the user's thinking through focused questions, without turning the discussion into implementation work.

## Workflow

1. Establish the subject from the user's request and current conversation. If no clear subject exists, ask what to grill on and stop until answered.
2. Synthesize what is settled, implied, and open. Continue once every important open branch is named or explicitly treated as out of scope.
3. For each open branch, first inspect available codebase context or documentation when it can answer the question. Continue once the branch is either answered by evidence or requires user judgment.
4. Ask one focused question for the highest-leverage unresolved branch. Continue once the answer is incorporated into the synthesis.
5. Repeat until every important branch is decided, captured as an assumption, or marked as a non-blocking risk.
6. Present the final shared understanding for acknowledgment.

## Rules

- Use the `question` tool for user decisions.
- Ask one question at a time and include a recommended answer.
- Do not create plans, specifications, tasks, proposals, or code changes.
- Do not recommend a next action or next command.
- When evidence is incomplete but risk is acceptable, state the assumption instead of over-exploring.

## Output

Present the final shared understanding:

- decisions made
- assumptions captured
- remaining non-blocking risks
