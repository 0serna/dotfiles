# Skill invocation is derived from one frontmatter flag

Skills marked `disable-model-invocation: true` must stay hidden from the model and visible to the human. OpenAI reads `agents/openai.yaml`; OpenCode ignores that file and reads only `metadata.opencode/autoinvoke` in `SKILL.md`. We keep `disable-model-invocation: true` as the single hand-written source and let `npm run agents:update` derive both provider signals: `policy.allow_implicit_invocation: false` in `agents/openai.yaml` and `metadata.opencode/autoinvoke: false` in the skill frontmatter. The merge is textual and scoped to the `metadata` block so key order and comments survive. `description` stays and `slash` is never set, because hiding the entry from the human is the opposite of user-invoked.

## Considered options

- **Edit each provider signal by hand.** Rejected: three sources diverge, and a regenerated skill silently loses the flag.
- **Re-serialize the whole frontmatter with a YAML library.** Rejected: it reorders keys and destroys comments. The scoped regex merge covers the known cases and is idempotent.
- **Set `slash: false` or `metadata.opencode/slash: false`.** Rejected: OpenCode v2.0.14 ignores it, and it would hide the skill from the human as well as the model.

## Consequences

- The derived OpenCode key is `opencode/autoinvoke`. It is a literal key with `/`, so naive YAML parsers need quoting.
- The flag lives in two files per skill. Run `npm run agents:update` after hand-editing a skill.
