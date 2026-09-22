# Design

## Context

See proposal.md (Why). Verified constraints: OpenCode v2.0.14 `Skill.Info` carries no slash field and the parser reads only `description`, `name`, `metadata.opencode/autoinvoke`; the prompt payload accepts native skill attachments (`skills: [{id}]`, `mention` optional); `~/.config/opencode/plugins/` auto-discovers single `.ts` files and package dirs; `ctx.command.transform` + registration `dispose()` and `skill.updated` events enable fully in-memory re-registration. The repo links `dotfiles/agents` as a dir already, and `~/.config/opencode/` itself is never linked (ADR 0008).

## Goals / Non-Goals

- Goals: one `/skill:<id>` command per described skill; native skill loading (compact reference, args forwarded, delivery preserved); live mirror updates; zero generated files.
- Non-Goals: honoring `slash: false` opt-outs (invisible to the plugin in v2.0.14); per-skill agent/model overrides; Desktop-specific UI work; publishing the plugin as a package.

## Decisions

- **Single-file plugin** (`skills-as-slash.ts`, `Plugin.define({id: "skills-as-slash"})`) over package dir: no build step; its one runtime import is satisfied via the repo's `node_modules` (next point).
- **Runtime dep `@opencode/plugin@2.0.14` pinned in `devDependencies` over manual install into the config dir**: the v2.0.14 loader resolves the plugin's `import { Plugin } from "@opencode/plugin"` by walking up from the file's real path, reaching repo-root `node_modules`; verified on a hermetic boot with the production symlinked layout (`active`, 22 commands). Without it the plugin fails with `Cannot find package '@opencode/plugin'`, visible only in the server log. Pinned exact (no caret) to the installed binary; bump together with the opencode version.
- **Auto-discovery over explicit `plugins` entry**: no `opencode.jsonc` edits; the `dotfiles.json` dir link plus the pinned dep are the only wiring.
- **Uniform `skill:` prefix over bare names**: verified live in the v2.0.14 registry; removes collision handling entirely and groups entries under `/skill`.
- **Re-submit with attached skill over content inlining**: uses `ctx.session.prompt({sessionID, text: prompt.text, skills: [{id}], delivery})`; avoids pasting full `SKILL.md` (the complaint in #34410) and works for `autoinvoke: false` skills via explicit ID.
- **Dispose + re-add on `skill.updated`** (cleanup via `AbortController` on unload): transform callbacks capture snapshots, so `command.reload()` alone cannot pick up list changes.
- **Sorted-by-ID registration**: deterministic order regardless of registry enumeration.

## Risks / Trade-offs

- [Upstream #35341 lands natively] → plugin becomes redundant; mitigation: single small file, trivial to delete; prefix makes its entries identifiable.
- [`:` rendering in TUI picker unverified headlessly] → mitigation: registry acceptance verified live; manual check is a task step before merge.
- [Skill permission `deny` rules] → command attaches but model cannot load; mitigation: documented limitation, default config allows `*`.
- [Command name with `:` vs future upstream bare names] → mitigation: prefix is a one-line change.
- [Install skipping devDependencies] → `npm ci --omit=dev` (or any `--omit=dev`) silently disables the plugin with only a server-log error; mitigation: fresh-machine setup always runs full `npm install`, and the dep is pinned so a mismatch fails loudly at import time.
- [Background service with `OPENCODE_CONFIG_DIR` override] → the service scans `<override>/plugins` instead of `~/.config/opencode/plugins` and never sees the mirror; mitigation: run the service with a clean env (`env -u OPENCODE_CONFIG_DIR opencode service restart`), which also restores the managed `opencode.jsonc`/`cli.json` into effect.

## Migration Plan

1. Add file + `dotfiles.json` entry, pin `@opencode/plugin`, run `npm install`, then `npm run link`.
2. Service picks up the plugin via file watching (else `opencode service restart`); verify `/skill:commit-and-push` in `/api/command` and the TUI picker. If the service runs with an `OPENCODE_CONFIG_DIR` override (e.g. Orca-managed shells), restart it clean instead: `env -u OPENCODE_CONFIG_DIR opencode service restart`.
3. Rollback: remove entry, re-run link, delete `~/.config/opencode/plugins` symlink if empty.

## Open Questions

None load-bearing. Minor: whether to also mirror description-less skills (currently skipped per spec).
