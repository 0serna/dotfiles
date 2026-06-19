---
name: agent-skill
description: >-
  Create, review, validate, and improve Agent Skills (SKILL.md) following the
  agentskills.io specification, best practices, and description optimization
  guide. Use when the user wants to create a new skill, audit or improve an
  existing one, ensure spec compliance, optimize triggering, or check reference
  integrity. Covers the full lifecycle: scoping, drafting, structural validation,
  semantic quality, description optimization, progressive disclosure, and
  maintenance.
---

# Agent Skill

Create, review, validate, and improve Agent Skills following the [specification](https://agentskills.io/specification), [best practices](https://agentskills.io/skill-creation/best-practices), and [description optimization guide](https://agentskills.io/skill-creation/optimizing-descriptions).

## Scope

| Mode         | Description                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| **Create**   | Build a new skill grounded in domain context                                           |
| **Review**   | Audit an existing skill for spec compliance, semantic quality, and reference integrity |
| **Optimize** | Improve a skill's `description` for reliable triggering                                |
| **Maintain** | Update skills as requirements or the spec evolves                                      |

## Grounding (always do first)

Before drafting or reviewing, investigate existing context so instructions are concrete, not generic:

1. `ls ~/.agents/skills/` — understand conventions used by existing skills
2. Search for relevant source material with `rg`: error messages, workflows, commands, domain patterns, project-specific facts, gotchas
3. If context is insufficient for a meaningful skill, ask the user only about **blocking decisions**:
   - What triggers should activate this skill?
   - What tools, commands, or APIs should the agent use?
   - What must the agent NOT do?
   - What source material or domain-specific references exist?
4. Assume minor stylistic details (wording, section layout, example phrasing); document assumptions explicitly

## Creation Workflow

1. **Ground** — investigate existing context and clarify blocking decisions
2. **Choose a name** in kebab-case (`a-z`, `0-9`, hyphens only; max 64 chars; no leading/trailing hyphens; no consecutive `--`; must match the directory name)
3. **Create** `~/.agents/skills/<name>/SKILL.md`:
   - YAML frontmatter with `name` and `description` only — omit `license`, `compatibility`, `metadata`, `allowed-tools` unless there is a concrete documented reason to include them
   - Markdown body focused on what the agent **wouldn't know** without the skill
   - Recommend sections only where they add value: _Scope_, _Workflow_, _Validation_, _Quality Bar_, _Gotchas_ are useful for most skills. Do not force a rigid template.
4. **Add extra files** (`references/`, `assets/`, `scripts/`) only when justified: reducing context load (progressive disclosure) or automating repeatable validation. Always tell the agent **when** to load each file.
5. **Validate** — run the validation command (see [Validation](#validation))
6. **Present** a summary:
   - Files created
   - Key decisions and assumptions
   - Validation results
   - Remaining risks (if any)

## Review Workflow

1. Read the skill's `SKILL.md` and any referenced files
2. **Validate** — run the validation command
3. **Check semantic quality**:
   - Does the skill add knowledge the agent wouldn't have alone?
   - Are instructions specific ("run `script.py --validate`") not generic ("handle errors appropriately")?
   - Does it favor procedure over declaration? (generalizable workflows, not one-shot answers)
   - Do important steps have checkable completion criteria, so the agent knows when each step is done?
   - Are there concrete gotchas and edge cases?
   - Does it provide defaults, not menus of options?
   - Is every instruction necessary? Would the agent get it right without it?
   - Does each sentence change behavior, or is it a no-op the agent would already follow?
   - Is each meaning stated in one authoritative place, without semantic duplication?
4. **Check reference integrity** — every `references/`, `scripts/`, `assets/` path mentioned in `SKILL.md` must exist as a file
5. **Check progressive disclosure** — `SKILL.md` should stay under 500 lines; keep material every branch needs inline, and move branch-specific detail to separate files with instructions on when to load them
6. **Check description triggering** — see [Description Optimization](#description-optimization) for the lightweight checklist
7. **Report** findings as:

   ```
   ## Review: <name>

   **Status:** pass / fail with blockers

   **Validation:** command run → result

   **Blocking:**
   - [spec violation] ...
   - [missing file] ...

   **Should fix:**
   - [vague description] ...
   - [generic workflow] ...
   - [poor trigger boundary] ...

   **Suggestions:**
   - add gotchas for ...
   - extract ... to references/ when it grows
   ```

## Validation

**Required** for every creation or review. Run:

```bash
uvx --from git+https://github.com/agentskills/agentskills#subdirectory=skills-ref skills-ref validate ~/.agents/skills/<name>
```

Always use this `uvx` command, even if `skills-ref` is already installed locally.

Validation must pass before considering a skill complete. If `uvx` is unavailable or cannot fetch `skills-ref`, report the blocker — do not skip.

> `skills-ref validate` checks structure and frontmatter but **not** file references. Reference integrity is verified manually in the review workflow step 4.

## Description Optimization

### Lightweight checklist (always apply)

- Does the description say **what** the skill does and **when** to use it?
- Does it include specific keywords and user intents that trigger activation?
- Is it concise enough not to false-trigger on unrelated tasks? (max 1024 chars)
- Would it activate for implicit queries that describe the problem without naming the skill's domain?
- Are there near-miss queries that would falsely trigger? (precision check)

### Full eval set (when the user explicitly asks to optimize triggering)

1. Design 15–20 eval queries: roughly equal should-trigger and should-not-trigger, including near-misses with shared keywords
2. Optionally split into **train** (~60%) and **validation** (~40%) sets
3. Evaluate current description: which should-triggers miss? Which should-not-triggers fire?
4. Iterate the description up to 5 rounds, revising based on **train** failures only
5. Validate final description against the validation set to check generalization
6. Confirm description ≤ 1024 characters

## Quality Bar

| Criterion                  | What to check                                                                   |
| -------------------------- | ------------------------------------------------------------------------------- |
| **Focused scope**          | One coherent unit of work; composes well with other skills                      |
| **Predictable process**    | Makes the agent follow a reliable process, not merely produce plausible output  |
| **Progressive disclosure** | `SKILL.md` under 500 lines; deep material in `references/` with load conditions |
| **Grounded**               | Based on project-specific context, not generic knowledge                        |
| **Defaults, not menus**    | Pick one default approach; mention alternatives briefly                         |
| **Concrete gotchas**       | List corrections to mistakes the agent would make without them                  |
| **Validation gate**        | the required `uvx` validation command passes; reference integrity confirmed     |
| **Specific instructions**  | No "handle errors appropriately" — say what to do for each failure mode         |
| **Pruned prose**           | No no-op sentences, stale sediment, or duplicated meanings                      |
| **Trigger precision**      | Description covers scope without false-positive near-misses                     |
| **Minimal frontmatter**    | Only `name` and `description` unless there is a documented reason for more      |

## Gotchas

- `name` must match the parent directory exactly; regex: only `a-z`, `0-9`, `-`; no consecutive `--`; no leading/trailing `-`; max 64 chars
- `description` max 1024 characters, must be non-empty
- `SKILL.md` is the only required file; `scripts/`, `references/`, `assets/` are optional
- File references must use relative paths from the skill root; `skills-ref validate` does NOT check these
- This repo uses English for all code and file content; user-facing agent messages are in Spanish per `AGENTS.md`
- Do not add `license`, `compatibility`, `metadata`, or `allowed-tools` to frontmatter unless there is a concrete documented reason
- When referencing external docs (specification, best practices, optimization guide), use the full `https://agentskills.io/...` URLs; the agent's training data may not reflect current content
- If reviewing a skill that itself generates content (meta-skill), be careful not to apply circular or self-referential quality rules
