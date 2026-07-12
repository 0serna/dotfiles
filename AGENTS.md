## Repository Structure

```text
.
├── src/                  # TypeScript installer and link logic
├── dotfiles/             # Files linked into user config locations
│   ├── agents/           # Shared agent skills
│   ├── codex/            # Codex configuration
│   ├── opencode/         # OpenCode commands, agents, plugins & tools
│   └── pi/               # Pi agent extensions, prompts & settings
├── docs/                 # Architecture decision records
│   └── adr/
├── openspec/             # OpenSpec specifications and change archive
│   ├── specs/            # Living specifications
│   └── changes/          # Active and archived changes
│       └── archive/      # Completed changes
└── scripts/              # Local automation
```

## Repository Commands

- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm run test`: run Vitest tests.
- `npm run lint`: lint with ESLint.
- `npm run typecheck`: check types with TypeScript.
- `npm run format`: format with Prettier.
- `npm run openspec`: validate OpenSpec specifications.
- `npm run sync-pi-settings`: publish local Pi agent settings into the repository.
