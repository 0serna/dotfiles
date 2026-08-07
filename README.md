# Dotfiles

Configs and skills for Pi, OpenCode, and Codex. A TypeScript linker reads `dotfiles.json` and symlinks them into `$HOME`.

## What's in here

| Area                | Path                      | Role                                                             |
| ------------------- | ------------------------- | ---------------------------------------------------------------- |
| Linker              | `src/`, `dotfiles.json`   | Symlinks repo files to home paths from the manifest              |
| Shared skills       | `dotfiles/agents/`        | Skills linked to `~/.agents`                                     |
| Shared instructions | `dotfiles/AGENTS.md`      | Agent rules linked into OpenCode, Codex, and Pi                  |
| OpenCode            | `dotfiles/opencode/`      | Config and TUI settings (`~/.config/opencode`)                   |
| Codex               | `dotfiles/codex/`         | Config (`~/.codex`)                                              |
| Pi                  | `dotfiles/pi/`            | Settings, keybindings, and TypeScript extensions (`~/.pi/agent`) |
| Domain docs         | `CONTEXT.md`, `docs/adr/` | Vocabulary and ADRs, mostly for Pi extensions                    |

Most of the custom TypeScript is in Pi extensions: quota, auto-continue, model routing, TUI footer, web tools, and related pieces. OpenCode and Codex get the same shared skills and `AGENTS.md` through that linker.

## Layout

```text
dotfiles.json     # link manifest
dotfiles/
  agents/         # shared skills → ~/.agents
  AGENTS.md       # shared instructions (OpenCode, Codex, Pi)
  opencode/       # → ~/.config/opencode
  codex/          # → ~/.codex
  pi/             # → ~/.pi/agent
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
npm run lint
npm run typecheck
```
