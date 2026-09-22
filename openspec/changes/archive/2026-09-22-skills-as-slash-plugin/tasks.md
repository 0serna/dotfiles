# Tasks

## 1. Plugin file

- [x] 1.1 Create `dotfiles/opencode/plugins/skills-as-slash.ts` with `Plugin.define({id: "skills-as-slash"})` registering `skill:<id>` per described skill via `ctx.command.transform`, sorted by ID; verify `npx tsc --noEmit` passes if typechecked or the file loads without syntax errors via `npx tsx --eval`
- [x] 1.2 Implement `execute` re-submitting `ctx.session.prompt({sessionID, text: prompt.text, skills: [{id}], delivery})`; verify by code review that no skill content is inlined and delivery is forwarded
- [x] 1.3 Subscribe to skill update events with `ctx.event.subscribe()` (abort on cleanup) disposing and re-adding the command registration; verify unload path aborts the subscription

## 2. Wiring

- [x] 2.1 Add `dotfiles/opencode/plugins/` → `~/.config/opencode/plugins/` entry to `dotfiles.json`; verify `npm run link` creates the symlink and `git status` shows only intended changes
- [x] 2.2 Run `npm run check`, `npm run typecheck`, `npm run test`; verify all green
- [x] 2.3 Pin `@opencode/plugin@2.0.14` in `devDependencies`, install, and verify a hermetic boot with the symlinked production layout reports `skills-as-slash` active and 22 commands (20 `skill:*` mirrors) in `/api/command`

## 3. Live verification

- [x] 3.1 Confirm `/api/command` lists `skill:commit-and-push` (and peers) after link/service reload; verify via `opencode api get /api/command`
- [x] 3.2 Confirm `/skill:commit` completes in the TUI picker and renders correctly with the `:` prefix; verify manually in the TUI
- [x] 3.3 Invoke `/skill:commit-and-push` and confirm the skill loads natively (compact reference, no pasted SKILL.md) with arguments forwarded; verify in session transcript
- [x] 3.4 Install or remove a scratch skill and confirm the mirror updates without restart; verify via `/api/command`, then remove the scratch skill
