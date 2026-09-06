# Dotfiles

Shared agent skills and local system configuration. A TypeScript linker reads `dotfiles.json` and symlinks them into `$HOME`.

## What's in here

| Area          | Path                      | Role                                                             |
| ------------- | ------------------------- | ---------------------------------------------------------------- |
| Linker        | `src/`, `dotfiles.json`   | Symlinks repo files to home paths from the manifest              |
| Shared skills | `dotfiles/agents/`        | Skills linked to `~/.agents`                                     |
| Local helpers | `dotfiles/bin/`           | Locally linked command-line helpers                              |
| Systemd       | `dotfiles/systemd/`       | User-level systemd configuration                                 |
| Domain docs   | `CONTEXT.md`, `docs/adr/` | Project vocabulary and architecture decisions                    |

The TypeScript code implements the dotfile linker; shared agent skills are linked through the same manifest.

## Layout

```text
dotfiles.json     # link manifest
dotfiles/
  agents/         # shared skills → ~/.agents
  bin/            # → ~/.local/bin
  systemd/        # → ~/.config/systemd/user
src/              # TypeScript linker
docs/adr/         # architecture decisions
CONTEXT.md        # domain vocabulary
```

## Setup

Node.js `>=22.12.0`.

```bash
npm install
npm run link
```

```bash
npm test
npm run check
npm run typecheck
```
