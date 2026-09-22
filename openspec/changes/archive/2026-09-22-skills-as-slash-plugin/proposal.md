# Proposal

## Why

Skills installed under `~/.agents/skills/` (and the other V2 discovery sources) never appear in the TUI `/` picker in OpenCode v2.0.14 — verified with a screenshot (`/comm` only offers `/review`) and against the binary, which contains neither `slash` nor `opencode/slash` strings. Upstream requests (#35341, #34410, #50638) are open and assigned but unimplemented, so a minimal local plugin closes the gap now without waiting.

## What Changes

- New global V2 plugin `skills-as-slash` as a single file `dotfiles/opencode/plugins/skills-as-slash.ts`, loaded via auto-discovery.
- At setup it mirrors every skill with a `description` as a `/skill:<id>` command; executing re-submits the prompt with the skill attached natively (`skills: [{id}]`), forwarding text and delivery mode.
- On `skill.updated` events it re-registers in memory (dispose + add); no files are generated or modified at runtime.
- `dotfiles.json` gains one entry linking `dotfiles/opencode/plugins/` to `~/.config/opencode/plugins/`.

## Capabilities

### New Capabilities

- `skills-as-slash`: mirror of installed skills as in-memory `/skill:<id>` slash commands with native skill attachment and live re-registration.

### Modified Capabilities

- `opencode-config`: the managed set gains the `plugins/` directory link (directory-level link of the subdirectory, still never linking `~/.config/opencode/` itself).

## Impact

- Affected: `dotfiles/opencode/plugins/skills-as-slash.ts` (new), `dotfiles.json` (one entry), `package.json` + `package-lock.json` (`@opencode/plugin` pinned to the installed binary version), `~/.config/opencode/plugins/` symlink after `npm run link`.
- Systems: OpenCode V2 background service (plugin host), TUI `/` picker (new entries), session prompt admission (skill attachments by ID, including `autoinvoke: false` skills).
- No changes to skill files, command files, `opencode.jsonc`, or existing specs' behavior.
