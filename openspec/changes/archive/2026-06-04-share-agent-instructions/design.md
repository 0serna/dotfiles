## Context

The default manifest currently links OpenCode and Pi Agent `AGENTS.md` from separate source files. The files overlap, but Pi Agent has become the preferred wording. The installer already supports multiple manifest entries pointing at the same source path, so this change can be implemented as a manifest/content layout adjustment rather than an installer feature.

`dotfiles/pi/agent/AGENTS.md` currently mirrors a Pi destination path. Moving shared content to `dotfiles/AGENTS.md` makes its cross-agent purpose explicit, but creates a deliberate exception to the existing convention that Pi targets use mirrored source paths under `dotfiles/pi`.

## Goals / Non-Goals

**Goals:**

- Keep one canonical shared `AGENTS.md` source for OpenCode and Pi Agent.
- Keep both tool-specific installed destination paths unchanged.
- Make the shared nature visible from the repository layout and manifest.
- Avoid installer changes unless tests reveal existing behavior does not support duplicate sources.

**Non-Goals:**

- Introduce templating, include directives, generated files, or content merging.
- Split tool-specific instruction fragments.
- Change either tool's discovery path or runtime behavior.

## Decisions

- Use `dotfiles/AGENTS.md` as the canonical source. This is clearer than choosing one tool's path as the original and treating the other as secondary.
- Point both manifest entries at the same source file. This relies on existing manifest semantics and avoids adding a new link abstraction.
- Remove the duplicated per-tool source files after the shared source is in place. Keeping unused copies would preserve drift risk and weaken the shared-source intent.
- Keep the root repository `AGENTS.md` separate. It documents how agents should work in this repository, while `dotfiles/AGENTS.md` is installed into external agent homes.

## Risks / Trade-offs

- Root `AGENTS.md` and `dotfiles/AGENTS.md` have similar names → Keep their roles distinct by path and manifest usage.
- The mirrored Pi source-path requirement needs an exception → Limit the exception to shared `AGENTS.md` content only.
- Existing local symlinks may still point at old source paths until relinked → The normal installer replacement behavior will refresh both destinations on the next link run.
