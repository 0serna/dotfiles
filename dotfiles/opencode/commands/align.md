---
description: Align understanding after exploration
---

## Arguments

```text
$ARGUMENTS
```

- **No arguments provided with prior context**: Use the current conversation and available context as the alignment subject.
- **No arguments provided and no prior context**: Ask the user what subject they want to align on before proceeding.
- **Clear arguments** (a topic, feature, problem, decision, or prior exploration): Use that as the alignment subject.
- **Unclear or ambiguous arguments**: Stop and ask the user what should be aligned before proceeding.

## Task

Turn prior exploration or an initial subject into a shared, explicit understanding by summarizing what is known, identifying unresolved gaps, and asking only the questions needed to close blocking ambiguity.

This command is a convergence checkpoint. It does not create plans, specifications, tasks, proposals, or implementation changes.

## Workflow

1. Establish the alignment subject from **Arguments** and the current conversation.
2. If there is no prior context or clear subject, ask the user what they want to align on before proceeding.
3. Review relevant context already available from the conversation. Explore the codebase only when a gap can be answered directly from existing files.
4. Produce a brief working synthesis of the current understanding.
5. Separate what is settled from what is still uncertain.
6. Classify uncertainties as either blocking gaps or non-blocking risks.
7. Ask one focused question at a time for the highest-priority blocking gap (`question` tool). Include your recommended answer.
8. Incorporate the user's answer and repeat from step 5 until no blocking gaps remain.
9. Present the final alignment summary for explicit acknowledgment.

## Rules

- **You MUST use the `question` tool** when asking the user to choose or clarify.
- Ask one question at a time.
- Include your recommended answer with every question.
- Do not ask questions that can be answered by reading available project context.
- If there is no prior exploration, gather only enough context to define the alignment subject.
- Do not reopen settled decisions unless there is a contradiction or missing dependency.
- Do not expand into new exploration unless it is necessary to resolve a blocking gap.
- Do not create implementation plans, specifications, tasks, proposals, or code changes.
- Do not recommend a next action or next command.
- Keep the process focused on alignment, not persuasion.
- Stop asking once the remaining uncertainty is non-blocking.

## Output

Once alignment is complete, summarize:

- the final shared understanding
- settled decisions and rationale
- blocking gaps resolved during alignment
- remaining non-blocking risks or uncertainties
