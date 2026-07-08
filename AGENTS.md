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

## Repository Stack

- Language: TypeScript, Bash
- Runtime: Node.js
- Package manager: npm
- Platform: Pi agent, OpenCode, Codex dotfiles
- Test framework: Vitest
- Build tool: TypeScript compiler, tsx
- Quality tools: ESLint, Prettier, OpenSpec

## Repository Commands

- `npm install`: install dependencies.
- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm run check`: run Vitest, ESLint, TypeScript, and OpenSpec validation.
- `npm run sync-pi-settings`: publish local Pi agent settings into the repository.
