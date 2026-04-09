# Dotfiles

Generic dotfiles repository for [OpenCode](https://opencode.ai/docs) and other tools. The `dotfiles.json` manifest links repo files into system locations.

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
dotfiles/
└── opencode/
    ├── opencode.jsonc  # https://opencode.ai/docs/config/#server
    ├── tui.jsonc       # https://opencode.ai/docs/config/#tui
    ├── AGENTS.md       # https://opencode.ai/docs/rules/
    └── commands/       # https://opencode.ai/docs/commands/
dotfiles.json          # Manifest
src/
└── installer.ts       # Linker script
```
