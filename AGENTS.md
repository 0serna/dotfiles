## Repository Structure

```text
.
├── src/                  # TypeScript installer and link logic
├── dotfiles/             # Files linked into user config locations
│   ├── agents/           # Sharable agent skills
│   ├── codex/            # Codex configuration
│   ├── opencode/         # OpenCode commands, agents, plugins & tools
│   └── pi/               # Pi agent extensions, prompts & settings
├── openspec/             # OpenSpec specifications and change archive
│   ├── specs/            # Living specifications
│   └── changes/          # Active and archived changes
│       └── archive/      # Completed changes
└── scripts/              # Local automation
```

## Repository Commands

- `npm install`: install dependencies.
- `npm test`: run the Vitest suite.
- `npm run check`: run ESLint, TypeScript, and OpenSpec validation.
- `npm run format`: format repository files with Prettier.
- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm run sync-pi-settings`: sync Pi agent settings.
