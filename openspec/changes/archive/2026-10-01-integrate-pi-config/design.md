# Design

## Context

See `proposal.md` for motivation. The existing manifest supports individual file links and multiple targets for one source. `linkEntry` removes the declared target before creating its symlink, so linking an entire agent or extensions directory would delete unmanaged contents.

The installed Pi 1.0.0 documentation identifies `~/.pi/agent` as the default agent directory, loads global instructions there, and supports `~/.agents/skills/` directly. The current global settings contain `lastChangelogVersion`, `defaultProvider`, `defaultModel`, `defaultProjectTrust`, and `deviceId`. The three existing `orca-*.ts` extensions belong to Orca, as confirmed by the user.

ADR 0008 already establishes granular configuration links to preserve unmanaged agent data. This integration reuses that approach rather than changing the linker or introducing a new architecture. Existing OpenCode specifications are not used as a Pi contract and remain outside this change.

A design document is warranted because incorrect link granularity can destroy credentials and Orca-owned files, and adopting the existing mutable settings file requires a migration plan.

## Goals / Non-Goals

Goals:

- Preserve ownership boundaries through explicit manifest targets.
- Adopt the existing settings without filtering or adding preferences.
- Validate installation against temporary home directories, not the active Pi installation.

Non-goals:

- Automatic discovery or installation of every repository extension.
- Per-machine settings overlays, secret management, or synchronization services.
- Redirecting `PI_CODING_AGENT_DIR`, changing shared skills, or implementing an extension.

## Decisions

### Use two initial file-level links

Add only these Pi targets to `dotfiles.json`:

| Source | Target |
| --- | --- |
| `dotfiles/pi/settings.json` | `~/.pi/agent/settings.json` |
| `dotfiles/AGENTS.md` | `~/.pi/agent/AGENTS.md` |

Keep `~/.pi/agent` and its `extensions/` subdirectory as real directories. Retain all existing manifest entries, including the other global instruction targets. No separate `dotfiles/pi/AGENTS.md` is needed.

Linking the entire agent directory is rejected because it would remove local authentication, installation state, and sessions. Copying the shared instruction file is rejected because it would create a second source to maintain.

### Adopt the complete existing settings

Copy the settings available at implementation time into `dotfiles/pi/settings.json` before replacing the installed target. Preserve every field and value, including the accepted machine identity and changelog version. JSON formatting may follow repository tooling, but no settings are stripped or added. Do not construct the file from a subset quoted in this plan.

The installed Pi settings storage uses `writeFileSync` on the settings path, so its writes follow a file symlink. Changes from `/settings`, model selection, package management, or Pi updates can therefore change the repository file. This is an expected consequence of the user's decision to version the complete settings.

A filtered settings template or generated per-machine overlay is rejected because the user explicitly chose to version the current configuration as-is.

### Reserve the extension location without linking the shared directory

Keep `dotfiles/pi/extensions/` in Git using an empty `.gitkeep`. Do not link `.gitkeep`, create a demo extension, or add an initial extensions manifest target.

Future single-file personal extensions will each get an explicit entry such as `dotfiles/pi/extensions/my-extension.ts` to `~/.pi/agent/extensions/my-extension.ts`. Multi-file packaging can be decided when an actual extension needs it; it does not require a loader or dependencies now.

Linking the complete extensions directory is rejected because Orca owns files in it. Automatically scanning the directory would require installer behavior outside the agreed scope. Explicit entries reuse the current manifest and let users see exactly which files installation replaces.

### Exclude Orca extensions narrowly

Add `/dotfiles/pi/extensions/orca-*` to the root `.gitignore`. It covers the current naming convention without hiding unrelated personal extensions or all Pi files. Do not copy the existing Orca extensions into the repository and do not add any Orca targets to the manifest.

An ignore rule is a Git safeguard, not an installer safeguard. Preserving Orca files depends on granular manifest entries and regression tests.

### Reuse shared skills without another link

Pi's native discovery of `~/.agents/skills/` already supplies the repository's shared skills. Keep that manifest entry and its resources unchanged. Do not add `dotfiles/pi/skills/`, `~/.pi/agent/skills` links, or a `skills` setting.

## Risks / Trade-offs

- The linker replaces existing managed targets without backups. Copy settings into the repository first and save temporary backups outside the repository before applying links to a real home directory.
- Pi writes through the settings link and can dirty the checkout. Document this behavior and review settings diffs before committing, particularly if future settings contain sensitive values.
- Versioning `deviceId` shares an identity between machines, and `lastChangelogVersion` may change after upgrades. Both are accepted trade-offs; do not silently filter them.
- Preserving `defaultProjectTrust: "always"` retains automatic trust behavior. This change does not strengthen or weaken that policy intentionally.
- A future whole-directory extension link could erase Orca files. Add a default-manifest guard and an isolated coexistence test for a personal extension file.
- Links target the default agent directory only. An environment override requires a separate decision, not an inferred target change.

## Migration plan

1. During implementation, capture the current global settings before any target replacement. Do not read or copy authentication files.
2. Add the repository files, narrow ignore rule, two manifest entries, tests, and documentation.
3. Verify the new links using `DotfilesInstaller` with a temporary home directory. Seed unmanaged sentinel files and run installation twice. Test a personal extension with a fixture only, without adding a production extension.
4. Run the repository test, formatting, and type-check commands. Review the manifest for forbidden directory, runtime-data, Orca, and skills targets.
5. If deploying to the real home directory, back up existing managed targets outside Git first, run `npm run link`, then restart Pi or run `/reload`. Verify the links and that the Orca extension files remain unchanged.
6. To roll back a real-home deployment, remove only the two Pi symlinks and restore their backups, or restore settings from the repository snapshot if no backup exists. Remove the two Pi manifest entries and integration files if reverting the repository change. Never remove `~/.pi/agent` or its extensions directory.
