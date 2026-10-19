# Tasks

## 1. Shared instruction

- [x] 1.1 Add the `## Context usage` section to `dotfiles/AGENTS.md` with the final-answer rule and its exclusions; verify `grep -A4 '^## Context usage' dotfiles/AGENTS.md` shows both rules.

## 2. OpenCode adapter

- [x] 2.1 Create `dotfiles/opencode/plugins/context-report/package.json` with name `local-context-report`, `"type": "module"`, and `"exports": { ".": "./index.ts" }`; verify it parses with `node -e "JSON.parse(require('fs').readFileSync('dotfiles/opencode/plugins/context-report/package.json'))"`.
- [x] 2.2 Implement `usage.ts` with the token total and last-step selection after the latest compaction, and `index.ts` with `Plugin.define` and the async `context` hook reading `ctx.session.context`; verify `npm run typecheck` includes both files without errors.
- [x] 2.3 Add `src/opencode/context-report.test.ts` covering the token total, last-step selection, the compaction boundary, and the appended note shape; verify `npx vitest run src/opencode/context-report.test.ts` passes.

## 3. Pi adapter

- [x] 3.1 Create `dotfiles/pi/extensions/context-report.ts` with the compaction flag and the `context` handler, and remove `dotfiles/pi/extensions/.gitkeep`; verify the file exports a default factory with `grep 'export default function' dotfiles/pi/extensions/context-report.ts`.
- [x] 3.2 Add the file-level entry `dotfiles/pi/extensions/context-report.ts` → `~/.pi/agent/extensions/context-report.ts` to `dotfiles.json`; verify `node -e` reads the manifest and finds that target.
- [x] 3.3 Update `src/installer/dotfiles-installer.test.ts` for the new Pi entry, the extension directory contents, and the Pi-source filter; verify `npx vitest run src/installer/dotfiles-installer.test.ts` passes.
- [x] 3.4 Smoke-test with `pi --extension ./dotfiles/pi/extensions/context-report.ts` on a short turn; verify the final answer ends with a `context: <n>k` line and an intermediate tool-call message has none.

## 4. Integration

- [x] 4.1 Run `npm run link`; verify `readlink -f ~/.pi/agent/extensions/context-report.ts` and `readlink -f ~/.config/opencode/plugins/context-report/index.ts` resolve into the repository, and that existing `~/.pi/agent/extensions/orca-*.ts` files are unchanged.
- [x] 4.2 Run `npm run check`, `npm run typecheck`, and `npm run test`; verify all three pass.
- [x] 4.3 In T3 Code, run one completed turn on Pi and one on OpenCode and confirm each final answer ends with `context: <n>k`; verify a turn that ends with a tool call has no line.
- [x] 4.4 Confirm `git diff` shows no change to the compaction settings in `dotfiles/pi/settings.json` or `dotfiles/opencode/opencode.jsonc`.
