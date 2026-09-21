# OpenCode global config via file-level links under dotfiles/opencode

`dotfiles/opencode/opencode.jsonc` and `dotfiles/opencode/cli.json` are the single sources for `~/.config/opencode/opencode.jsonc` and `~/.config/opencode/cli.json`. Each is linked by its own `dotfiles.json` entry as a `file` symlink. The `~/.config/opencode/` directory itself is never linked, preserving unmanaged files (`service.json`, credentials, logs).

`opencode.jsonc` preserves the current `$schema` content and adds only provider-agnostic base: `formatter: true` and full `permissions: allow` on `action: *`, `resource: *` (every tool and resource allowed without prompting). No default `model` is fixed: the current file declares none and no provider was confirmed, so inventing `provider/model` would contradict existing content. `cli.json` is minimal V2 (`$schema`, `session.permissions: autoaccept`, `session.sidebar: hide`, `tabs.enabled: false`) with no theme invented.

## Considered options

- **Link `dotfiles/opencode` -> `~/.config/opencode` as `dir`.** Rejected: `linker.ts` does `rm -rf` on the target, deleting credentials and service state.
- **Flat files `dotfiles/opencode.jsonc` / `dotfiles/cli.json`.** Rejected: pollutes `dotfiles/` root and leaves no room for future `commands/` or `skills/`.
- **Fix a default `model` now.** Deferred: no model is declared today; fixing one without provider confirmation invents behavior. Follow-up change when the provider is decided.
- **Full TUI theme and keybinds now.** Deferred: same reason, keep the base minimal and valid.
