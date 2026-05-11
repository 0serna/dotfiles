---
description: Interview relentlessly about a plan or design until important decision branches are resolved
---

Interview me about a plan, design, or decision space until the important branches are resolved and our shared understanding is explicit, without turning that discussion into implementation work.

## Arguments

```arguments
$ARGUMENTS
```

- **No arguments provided with prior context**: Use the current conversation and available context as the subject.
- **No arguments provided and no prior context**: Ask the user what plan, design, or topic they want to be grilled on before proceeding.
- **Clear arguments** (a topic, feature, problem, plan, decision, or prior exploration): Use that as the subject.
- **Unclear or ambiguous arguments**: Stop and ask the user what should be grilled on before proceeding.

## Workflow

1. Establish the subject from **Arguments** and the current conversation.
2. If there is no prior context or clear subject, use `ask_user` to ask what to grill on before proceeding.
3. Build a quick synthesis of what is settled, implied, and open.
4. Walk down each branch of the decision tree — for each unresolved branch, explore the codebase if answerable there, otherwise use `ask_user` for one focused question and include your recommended answer.
5. Incorporate answers, resolve dependencies between decisions, and repeat until all important branches are resolved or accepted as assumptions.
6. Present the final grounded understanding for acknowledgment.

## Rules

- Use `ask_user` and ask one question at a time.
- Provide your recommended answer with every question.
- If a question can be answered by exploring the codebase, explore instead of asking.
- Do not create plans, specifications, tasks, proposals, or code changes.
- Do not recommend a next action or next command.
- When evidence is incomplete but risk is acceptable, state the assumption instead of over-exploring.

## Output

Present the final shared understanding: decisions made, assumptions captured, and remaining non-blocking risks.
