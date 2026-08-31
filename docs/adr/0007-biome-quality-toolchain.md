# Biome as the format, lint, and import-organization toolchain

Prettier, ESLint, and `prettier-plugin-organize-imports` are replaced by Biome. The quality baseline exposes a single `biome check` target (and `biome check --write` for local fixes) for TypeScript, JavaScript, and JSON only. Markdown, YAML, and shell files are no longer auto-formatted. TypeScript typechecking stays on `tsc --noEmit`.

## Considered options

- **Keep Prettier for non-code files.** Rejected for this repo: the volume of `.md`/`.yaml` does not justify maintaining a second formatter when the goal is fewer tools.
- **Separate `format`, `lint`, and `check` npm scripts.** Rejected: one Biome invocation already covers all three concerns with less hook and CI surface area.
- **Biome `recommended` preset instead of migrated ESLint rules.** Rejected for migration: it would have introduced hundreds of new violations unrelated to the toolchain swap; `biome migrate eslint` preserves the prior lint baseline.
