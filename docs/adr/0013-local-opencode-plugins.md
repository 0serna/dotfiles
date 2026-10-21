# Local OpenCode plugins are symlinked source with a pinned runtime dependency

Slash commands and hooks come from local plugins in `dotfiles/opencode/plugins/`, linked as a directory into `~/.config/opencode/plugins/`. Plugin code is plain TS/TSX loaded by auto-discovery, with no build step. Each plugin imports `@opencode/plugin` at runtime, resolved from the repository's `node_modules` by walking up from the symlinked real path. `@opencode/plugin` is pinned exactly to the installed OpenCode version and must move with it. Local actions such as clipboard writes run in a CLI plugin; server plugins are reserved for work that must submit prompts or read session state.

## Considered options

- **Build and install each plugin as a package.** Rejected: adds a build step and a publishing path for a handful of files the user owns.
- **Install `@opencode/plugin` inside the config directory.** Rejected: config state leaves the repo and drifts per machine.
- **Use a server plugin for `/last`.** Rejected: clipboard access belongs to the local TUI and must work when the TUI is connected to a remote server; a server plugin also re-enters the prompt-submission path.
- **Use `xclip`, `xsel`, or `wl-copy` for the clipboard.** Rejected: none is installed, and it would couple the plugin to the host.

## Consequences

- `npm ci --omit=dev`, or an OpenCode upgrade without bumping the pin, disables plugins with only a server-log error.
- `~/.config/opencode/` is never linked, but `plugins/` is: it contains only repository files.
- Imports depend on the symlink resolving to the checkout. Copying a plugin instead of linking it breaks resolution.
