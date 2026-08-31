# Biome as the format, lint, and import-organization toolchain

Prettier, ESLint, and `prettier-plugin-organize-imports` are replaced by Biome with the `recommended` rule preset. The quality baseline exposes a single `biome check` target (and `biome check --write` for local fixes) for TypeScript, JavaScript, and JSON only. Markdown, YAML, and shell files are no longer auto-formatted. TypeScript typechecking stays on `tsc --noEmit`.

## Considered options

- **Keep Prettier for non-code files.** Rejected for this repo: the volume of `.md`/`.yaml` does not justify maintaining a second formatter when the goal is fewer tools.
- **Separate `format`, `lint`, and `check` npm scripts.** Rejected: one Biome invocation already covers all three concerns with less hook and CI surface area.
- **Migrate ESLint rules verbatim via `biome migrate eslint`.** Rejected after adoption: the generated config duplicated Biome defaults and was harder to maintain than `preset: "recommended"`.
