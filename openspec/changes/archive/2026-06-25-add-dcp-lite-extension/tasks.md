## 1. Extension Structure

- [x] 1.1 Create `dotfiles/pi/agent/extensions/dcp/` with `index.ts` entry point and helper modules.
- [x] 1.2 Wire `session_start` to initialize `createExtensionLogger(ctx, "dcp")` without registering commands, tools, prompts, or notifications.
- [x] 1.3 Wire the `context` event to call the DCP pruning workflow and return original messages on failure.

## 2. Metadata Extraction

- [x] 2.1 Implement helpers to extract text content from supported `toolResult` shapes without reading or logging full content externally.
- [x] 2.2 Implement helpers to identify matching tool call metadata, including tool name and truncated target from assistant `toolCall` blocks.
- [x] 2.3 Implement normalized content hashing and rough token estimation utilities.
- [x] 2.4 Implement file-operation, command/listing/search, and error/success classification helpers.

## 3. Pruning Rules

- [x] 3.1 Implement recent-message protection for the last 20 messages.
- [x] 3.2 Implement duplicate-output detection for non-recent `toolResult` messages.
- [x] 3.3 Implement resolved detection based on later successful results for the same operation.
- [x] 3.4 Implement superseded file-operation detection for read/write/edit results targeting the same file.
- [x] 3.5 Implement stale large command/listing/search detection above a 2000-token estimate.

## 4. Stubbing and Logging

- [x] 4.1 Implement informational stubs containing reason, tool name, and truncated target.
- [x] 4.2 Replace only eligible `toolResult` content while leaving user and assistant messages unchanged.
- [x] 4.3 Log `context_pruned` entries with processed count, stubbed count, protected recent count, reason counts, and truncated target metadata.
- [x] 4.4 Ensure logs never include full original tool result content.

## 5. Verification

- [x] 5.1 Add Vitest coverage for duplicate, resolved, superseded, large-output, recent-protection, and fail-open behavior.
- [x] 5.2 Add tests confirming no tools, commands, prompt injection, user messages, or assistant messages are modified.
- [x] 5.3 Run `npm test` and fix failures.
- [x] 5.4 Run `npm run check` and fix all reported issues.
