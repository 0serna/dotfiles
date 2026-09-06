## Repository Structure

```text
.
├── src/                  # TypeScript installer and link logic
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
- `npm run test`: run Vitest tests.
- `npm run check`: format, lint, and organize imports with Biome.
- `npm run check:fix`: apply Biome fixes and formatting.
- `npm run typecheck`: check types with TypeScript.
