# Tasks

## 1. Rename slash registration

- [x] 1.1 Change the slash name from `copy-last` to `last` in the copy-last TUI plugin and verify `/last` appears in the TUI command palette with the "Copy last assistant response" title
- [x] 1.2 Verify `/copy-last` no longer appears in the palette and the built-in `/copy` (session transcript) is untouched

## 2. Verification

- [x] 2.1 Run `npm run test` and `npm run typecheck` and verify both pass
- [x] 2.2 Invoke `/last` in an active session with a completed assistant response and verify the latest response is copied and a success toast is shown
