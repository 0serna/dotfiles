## 1. Auth Source

- [x] 1.1 Replace OpenCode auth-file discovery and parsing in `dotfiles/pi/agent/extensions/codex-quota.ts` with Pi `openai-codex` token resolution through the extension context.
- [x] 1.2 Ensure token resolution delegates refresh behavior to Pi auth storage and does not implement OAuth refresh inside the extension.
- [x] 1.3 Remove the `ChatGPT-Account-Id` usage header and any now-unused auth file types/helpers/imports.

## 2. Status and Fetch Behavior

- [x] 2.1 Publish `codex auth missing` when Pi Codex authentication cannot provide a usable access token.
- [x] 2.2 Add a single immediate retry for failed Codex usage fetches after usable authentication is available.
- [x] 2.3 Preserve the existing last-known/cached quota status when both fetch attempts fail, while logging failure details.

## 3. Verification

- [x] 3.1 Verify Pi auth token resolution, no OpenCode fallback, missing-auth status, and usage request headers through focused review.
- [x] 3.2 Verify one retry and cache preservation after repeated fetch failures through focused review.
- [x] 3.3 Run the project check suite and fix any lint, type, format, spec, or test failures.
