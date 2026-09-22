# Skills as slash commands via in-memory plugin mirror

`dotfiles/opencode/plugins/skills-as-slash.ts` is the single source for a global OpenCode V2 plugin that mirrors every skill with a `description` as `/skill:<id>` commands entirely in memory. On setup it reads `ctx.skill.list()`, registers one command per skill with `ctx.command.transform`, and each `execute` re-submits via `ctx.session.prompt` attaching the skill natively (`skills: [{id}]`) with the user's text and delivery mode. On `skill.updated` events it disposes and re-registers. The plugin loads through auto-discovery (`dotfiles/opencode/plugins/` linked to `~/.config/opencode/plugins/`), with no `opencode.jsonc` edits and no generated command or skill files. Its single runtime import (`@opencode/plugin`) is satisfied by pinning `@opencode/plugin@2.0.14` in the repo's `devDependencies`: the v2.0.14 loader resolves it by walking up from the plugin file's real path to repo-root `node_modules` (verified on a hermetic boot with the production symlinked layout). Without the installed dep the plugin fails with `Cannot find package '@opencode/plugin'`, visible only in the server log.

The uniform `skill:` prefix was verified against the live v2.0.14 registry (`skill:probe` registered correctly); it avoids all name collisions by construction, groups entries in the picker under `/skill`, and keeps provenance visible. Native `slash` / `metadata.opencode/slash` frontmatter is ignored because the v2.0.14 binary contains neither string: `Skill.Info` carries no slash field and the parser only reads `description`, `name`, and `metadata.opencode/autoinvoke`.

## Considered options

- **Bare `/<id>` names with skip-on-collision.** Rejected: needs a `ctx.command.list()` pre-check plus skip/warn logic, and still risks silently shadowing built-ins.
- **`skill/` nested prefix.** Rejected in favor of `skill:`: both avoid collisions, but the flat colon form filters better in the picker and was verified live; slash-nesting stays reserved for real command groups.
- **Generated `commands/<id>.md` shims.** Rejected: duplicates skill content or delegation text on disk per skill and needs regeneration; the plugin derives everything at runtime.
- **Top-level `slash: true` frontmatter only.** Rejected: verified no-op in v2.0.14 (kept as harmless future-proofing where already added, not as the mechanism).
