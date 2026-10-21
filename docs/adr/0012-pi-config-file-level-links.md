# Pi global configuration uses explicit file-level links

Pi keeps settings, credentials, sessions, and Orca-owned extensions in `~/.pi/agent`. We version `settings.json` as-is and link it, plus the shared `AGENTS.md`, with one manifest entry per file. The agent directory and `extensions/` stay real directories. Each personal extension gets an explicit entry, and `orca-*` files stay unmanaged and ignored by Git. This extends ADR 0008 to Pi: never link a directory that mixes managed and unmanaged files.

## Considered options

- **Link `dotfiles/pi` to `~/.pi/agent` as a directory.** Rejected: the linker removes the target first, taking credentials, sessions, and Orca extensions with it.
- **Link `~/.pi/agent/extensions` as a directory.** Rejected: Orca owns files there, and the link would erase them.
- **Filter settings or generate a per-machine overlay.** Rejected: the user chose to version the current configuration as-is, including `deviceId` and `lastChangelogVersion`.

## Consequences

- Pi writes settings through the symlink with `writeFileSync`. Changing the model or trust policy in the TUI dirties the checkout; review the diff before committing.
- `deviceId` is shared between machines, and `lastChangelogVersion` changes after upgrades.
- Without a backup before the first `npm run link`, rollback is manual.
