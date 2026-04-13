# Dotfiles

Personal dotfiles repository for agents and tools. The `dotfiles.json` manifest links repository files to system locations.

## Commands

```
npm run link        # Link dotfiles
npm run check       # Lint and format check
npm run format      # Format code
npm run typecheck   # Type checking
npm test            # Test suite
```

## Structure

```
./
├── dotfiles.json               # Manifest
├── dotfiles/
│   ├── agents/                 # Shared configurations for agents
│   │   └── skills/             # Shared global skills
│   ├── opencode/               # OpenCode config and commands
│   └── pi/
│       ├── agent/              # Global Pi agent files
│       └── prompts/            # Global Pi prompt templates
├── src/
│   └── dotfiles-installer.ts   # Linker script
└── ...
```
