---
description: Interview relentlessly about a plan or design until all decision branches are resolved
---

## Arguments

```text
$ARGUMENTS
```

- **No arguments provided with prior context**: Use the current conversation and available context as the subject.
- **No arguments provided and no prior context**: Ask the user what plan, design, or topic they want to be grilled on before proceeding.
- **Clear arguments** (a topic, feature, problem, plan, decision, or prior exploration): Use that as the subject.
- **Unclear or ambiguous arguments**: Stop and ask the user what should be grilled on before proceeding.

## Task

Interview the user relentlessly about every aspect of the plan or design until reaching shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. This command is a convergence checkpoint before implementation — it does not create plans, specifications, tasks, proposals, or code changes.

## Workflow

1. Establish the subject from **Arguments** and the current conversation.
2. If there is no prior context or clear subject, ask the user what to grill on before proceeding.
3. Build a quick synthesis of what's settled, implied, and open.
4. Walk down each branch of the decision tree — for each unresolved branch, explore the codebase if answerable there, otherwise ask one focused question with your recommended answer using the `question` tool.
5. Incorporate answers, resolve dependencies between decisions, and repeat until all branches are resolved or accepted as assumptions.
6. Present the final grounded understanding for acknowledgment.

## Rules

- Ask one question at a time.
- Provide your recommended answer with every question.
- Use the `question` tool when asking the user.
- If a question can be answered by exploring the codebase, explore instead of asking.
- Do not create plans, specifications, tasks, proposals, or code changes.
- Do not recommend a next action or next command.
- When evidence is incomplete but risk is acceptable, state the assumption instead of over-exploring.

## Output

Present the final shared understanding: decisions made, assumptions captured, and remaining non-blocking risks.
