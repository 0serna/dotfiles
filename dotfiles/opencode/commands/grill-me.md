***

## description: Relentlessly interview the user about a plan or design until reaching shared understanding

## Input / Arguments

```text
$ARGUMENTS
```

## Task

Stress-test the user's plan or design by interviewing them relentlessly about every aspect until you reach a shared understanding.

Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

## Scope Selection

* **No arguments provided**: Ask the user what plan or design they want to be grilled on.
* **Arguments are clear** (a topic, feature, plan, or design): Use that as the starting subject.
* **Arguments are unclear or ambiguous**: Stop and ask for clarification before proceeding.

## Workflow

1. Understand the subject. Explore the codebase first if the plan is related to existing code.
2. Identify the next unresolved decision or assumption in the design tree.
3. Formulate a single, focused question about that decision. Include your recommended answer.
4. Use the `question` tool to ask it. Wait for the user's response.
5. Incorporate their answer and repeat from step 2 until the design is fully resolved and you both have a shared understanding.

## Rules

* Ask one question at a time.
* Provide your recommended answer with every question.
* If a question can be answered by exploring the codebase, explore instead of asking.
* Walk down branches of the design tree methodically; do not skip dependencies.
* Keep probing until there are no unresolved assumptions or ambiguities left.

## Output

Once grilling is complete, summarize:

* the final shared understanding
* key decisions made and their rationale
* any remaining risks or open questions
