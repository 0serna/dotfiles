# Dotfiles

Shared agent skills and local system configuration. A TypeScript linker reads `dotfiles.json` and symlinks them into `$HOME`.

## What's in here

| Area          | Path                      | Role                                                             |
| ------------- | ------------------------- | ---------------------------------------------------------------- |
| Linker        | `src/`, `dotfiles.json`   | Symlinks repo files to home paths from the manifest              |
| Shared skills | `dotfiles/agents/`        | Skills linked to `~/.agents`                                     |
| Local helpers | `dotfiles/bin/`           | Locally linked command-line helpers                              |
| OpenCode      | `dotfiles/opencode/`      | Global `opencode.jsonc` + `cli.json` → `~/.config/opencode/`     |
| Pi            | `dotfiles/pi/`            | Global settings and future personal extensions for `~/.pi/agent/` |
| Domain docs   | `GLOSSARY.md`, `docs/adr/` | Project vocabulary and architecture decisions                    |

The TypeScript code implements the dotfile linker; shared agent skills are linked through the same manifest.

## Layout

```text
dotfiles.json     # link manifest
dotfiles/
  agents/         # shared skills → ~/.agents
  bin/            # → ~/.local/bin
  opencode/       # opencode.jsonc + cli.json → ~/.config/opencode/
  pi/             # settings.json + future personal extensions
src/              # TypeScript linker
docs/adr/         # architecture decisions
GLOSSARY.md        # domain vocabulary
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
