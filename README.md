# OpenCode Config

Centralized configuration for [OpenCode](https://opencode.ai/docs). Automatically syncs `opencode/` assets to `~/.config/opencode/`

## Commands

```
npm run setup       # Install configuration
npm run check       # Lint and format check
npm run format      # Format code
npm run typecheck   # Type checking
npm test            # Test suite
```

## Structure

```
opencode/
├── opencode.jsonc  # https://opencode.ai/docs/config/
├── AGENTS.md       # https://opencode.ai/docs/rules/
├── agents/         # https://opencode.ai/docs/agents/
├── commands/       # https://opencode.ai/docs/commands/
└── skills/         # https://opencode.ai/docs/skills/
src/
└── installer.ts    # Setup script
```
