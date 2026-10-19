## Repository Structure

```text
.
├── src/                  # TypeScript source and tests
│   ├── agent-sudo/       # Tests for the agent-sudo helper
│   ├── installer/        # Dotfile installer and link logic
│   ├── opencode/         # Tests for OpenCode plugins
│   └── skills/           # Skill and tool updater
├── dotfiles/             # Files linked into user config locations
│   ├── agents/           # Shared agent skills
│   ├── bin/              # Local command-line helpers
│   ├── opencode/         # Global opencode.jsonc + cli.json
│   ├── pi/               # Global settings and personal extension location
│   └── systemd/          # User-level systemd configuration
└── docs/                 # Architecture decision records
    └── adr/
```

## Repository Commands

- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm run agents:update`: update globally managed skills and their CLIs, then align OpenAI/OpenCode metadata.
- Do not hand-edit derived OpenAI/OpenCode skill flags; `npm run agents:update` regenerates them.
- `npm run test`: run Vitest tests.
- `npm run check`: format, lint, and organize imports with Biome.
- `npm run check:fix`: apply Biome fixes and formatting.
- `npm run typecheck`: check types with TypeScript.
