## Repository Structure

```text
.
├── src/                          # TypeScript installer and link logic
│   ├── dotfiles-installer.ts      # CLI entry point
│   ├── dotfiles-installer.test.ts # Vitest coverage
│   ├── linker.ts                  # Symlink management
│   ├── manifest.ts                # Dotfiles manifest parsing
│   └── paths.ts                   # Path resolution utilities
├── dotfiles/                     # Files linked into user config locations
│   ├── agents/skills/            # Sharable agent skills
│   ├── opencode/                 # OpenCode commands, agents, plugins & tools
│   ├── pi/agent/                 # Pi agent extensions, prompts & settings
│   └── rtk/                      # RTK configuration
├── openspec/                     # OpenSpec specifications and change archive
│   ├── specs/                    # Living specifications
│   └── changes/archive/          # Completed changes
├── scripts/                      # Local automation
│   ├── check.sh                  # Quality gate (eslint, tsc, fallow, openspec)
│   └── publish-pi-settings.sh    # Pi agent settings sync
└── dotfiles.json                 # Link manifest consumed by the installer
```

## Repository Commands

- `npm install`: install dependencies.
- `npm test`: run the Vitest suite.
- `npm run check`: run ESLint, TypeScript, Fallow, and OpenSpec validation.
- `npm run format`: format repository files with Prettier.
- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm run sync-pi-settings`: sync Pi agent settings to the target config location.
