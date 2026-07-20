---
name: pi-extensions
description: >-
  Build, modify, or debug Pi agent extensions. Use when the user mentions Pi
  extensions, dotfiles/pi/agent/extensions, or ExtensionAPI.
---

# Pi Extensions

Work on Pi extensions using the Pi API contract and this repo's extension idioms.

## Workflow

1. Ground the API.
   - Read the relevant Pi docs before changing behavior: `docs/extensions.md`; also read `docs/tui.md` for custom UI/footer/rendering, `docs/packages.md` for packaged extensions, and linked docs when they affect the work.

2. Ground the local idiom.
   - Inspect the in-scope extension plus nearby extensions in `dotfiles/pi/agent/extensions` that use the same Pi surface.
   - Reuse `dotfiles/pi/agent/extensions/shared/logger.ts` for JSONL logs and `dotfiles/pi/agent/extensions/shared/diagnostics.ts` for structured failures.
   - Complete when the change follows a local pattern or the deviation is intentional and stated.
3. Keep the extension shape tight.
   - Put registration and orchestration in `index.ts`; move domain logic, schemas, rendering, persistence, and API clients to focused sibling modules.
   - Keep the factory sync. Pi awaits async factories before `session_start`, so an async factory blocks the TUI until it resolves. Defer all I/O, process spawns, and network calls to `session_start` or later hooks.
   - Initialize session-bound state in `session_start`; clean timers, pollers, handles, and captured contexts in `session_shutdown`.
   - Complete when the factory is sync, no long-lived resource starts at module load, and all session resources have a shutdown path.
4. Fit Pi interaction semantics.
   - Use `ctx.hasUI` before prompting; use status keys named after the extension; make status publishing best-effort when failure is plausible.
   - For tools, provide `name`, `label`, `description`, `promptSnippet`, `promptGuidelines`, TypeBox `parameters`, execution, and rendering when user-visible output benefits from it.
   - For blocking or mutating hooks, preserve Pi's documented return shapes and mutation guarantees.
   - Complete when every UI interaction sits behind a `ctx.hasUI` guard, every status uses an extension-scoped key, and the chosen hook return shapes match the Pi docs.

5. Debug extension logs when behavior is unclear.
   - Use the extension name to inspect `~/.local/state/pi/<extension>.log`, for example `tail -n 100 ~/.local/state/pi/context.log` or `tail -f ~/.local/state/pi/quota.log`.
   - Prefer `rg 'event_name|sessionId|error' ~/.local/state/pi/<extension>.log` for targeted log search.
   - Read JSONL entries as structured records: `timestamp`, `extension`, `event`, `sessionId`, `model`, and `data`.
   - Correlate logs with UI status changes, session lifecycle events, and the exact extension code path before editing.
   - Complete when the suspected failure has a log-backed cause or logging is confirmed absent/insufficient.
6. Verify.
   - Add or update focused Vitest coverage for pure logic, lifecycle state, schemas, rendering, and error/fallback paths touched by the change.
   - Run the repository quality gate, preferably `npm run check`; use narrower tests only when the user explicitly scopes verification.
   - Complete when checks pass or any blocker is reported with the exact command and failure.

## Local standards

- Extension source in this repo lives under `dotfiles/pi/agent/extensions`.
- Multi-file extensions use `dotfiles/pi/agent/extensions/<name>/index.ts` and keep tests in `dotfiles/pi/agent/extensions/<name>/tests`.
- Persist user state under `XDG_STATE_HOME` or `~/.local/state/pi`, not in the project.
- Log event names as short snake_case strings with structured payloads.
- Stage, commit, stash, or reload Pi only when the user explicitly asks.
