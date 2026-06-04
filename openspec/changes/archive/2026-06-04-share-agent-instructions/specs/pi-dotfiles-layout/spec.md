## MODIFIED Requirements

### Requirement: Repository mirrors the shareable Pi configuration layout

The repository SHALL store managed Pi configuration under `dotfiles/pi` using the same path structure as the shareable subset of `~/.pi`, except the shared agent instructions installed to `~/.pi/agent/AGENTS.md` SHALL use `dotfiles/AGENTS.md` as their canonical source.

#### Scenario: Inspect the managed Pi root layout

- **WHEN** the repository-managed Pi files are inspected
- **THEN** files destined for `~/.pi/*` appear at matching relative paths under `dotfiles/pi`
- **AND** files destined for `~/.pi/agent/*` appear at matching relative paths under `dotfiles/pi/agent`, except `~/.pi/agent/AGENTS.md`
- **AND** shared agent instructions destined for `~/.pi/agent/AGENTS.md` appear at `dotfiles/AGENTS.md`
