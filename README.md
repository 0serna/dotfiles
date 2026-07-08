# Dotfiles

Personal configuration for AI coding tools and terminal workflows. This repository keeps the source files under `dotfiles/` and uses `dotfiles.json` to link them into the expected locations in `$HOME`.

## Setup

Requires Node.js `>=22.12.0`.

```bash
npm install
npm run link
```

`npm run link` reads `dotfiles.json` and creates or updates the configured links, for example `~/.config/opencode`, `~/.codex`, `~/.pi/agent`, and `~/.agents`.

## Commands

```bash
npm run link              # Link dotfiles into $HOME
npm run check             # Run tests, lint, typecheck, and OpenSpec validation
```

## Structure

```text
.
├── dotfiles.json   # Link manifest: source files and target locations
├── dotfiles/       # Configurations that are linked into $HOME
├── src/            # TypeScript linker implementation
├── scripts/        # Local automation
├── docs/adr/       # Architecture decision records
└── openspec/       # Specs and change proposals
```
