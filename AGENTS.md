## Repository Structure

```text
.
├── src/                  # TypeScript source and tests
│   ├── agent-sudo/       # Tests for the agent-sudo helper
│   ├── installer/        # Dotfile installer and link logic
│   └── skills/           # Skill metadata updater
├── dotfiles/             # Files linked into user config locations
│   ├── agents/           # Shared agent skills
│   ├── bin/              # Local command-line helpers
│   └── systemd/          # User-level systemd configuration
├── docs/                 # Architecture decision records
│   └── adr/
└── scripts/              # Local automation
```

## Repository Commands

- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm run skills:update`: update globally managed skills and align their OpenAI metadata.
- `npm run test`: run Vitest tests.
- `npm run check`: format, lint, and organize imports with Biome.
- `npm run check:fix`: apply Biome fixes and formatting.
- `npm run typecheck`: check types with TypeScript.
