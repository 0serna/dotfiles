## Project Structure

```text
.
├── src/                         # TypeScript dotfiles installer and tests
│   ├── dotfiles-installer.ts     # CLI entry point for linking dotfiles
│   └── dotfiles-installer.test.ts # Vitest coverage for installer behavior
├── dotfiles/                    # Files linked into user config locations
│   ├── agents/                  # Shared agent configuration and skills
│   ├── opencode/                # OpenCode config, commands, agents, tools
│   └── pi/                      # Pi agent settings and prompt templates
├── openspec/                    # OpenSpec specs, changes, and validation config
└── dotfiles.json                # Link manifest consumed by the installer
```

## Repository Commands

- `npm install`: install dependencies.
- `npm run link`: link configured dotfiles from `dotfiles.json`.
- `npm test`: run the Vitest suite.
- `npm run check`: run Prettier check, ESLint, Fallow, TypeScript, and OpenSpec validation.
- `npm run format`: format repository files with Prettier.
