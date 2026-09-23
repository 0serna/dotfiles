# Tasks

## 1. Verify the V2 CLI plugin surface

- [x] 1.1 Verify the local CLI plugin layout, command registration, active-session route, and message API against the installed OpenCode runtime; confirm the plugin loads from the managed global config directory and `/copy-last` appears in the TUI command palette.

## 2. Implement response selection and normalization

- [x] 2.1 Implement active-session lookup and selection of the newest completed final assistant response, excluding reasoning, tool activity, intermediate messages, and child-session output; add focused tests for these cases and for missing-session/no-response behavior.
- [x] 2.2 Implement the dependency-free Markdown-to-plain-text normalizer for the agreed headings, paragraphs, lists, code, links, and tables; add tests that verify the expected output for each format.

## 3. Integrate clipboard and command feedback

- [x] 3.1 Add an OSC 52 renderer helper that checks runtime support and handles rejected writes without crashing; verify supported and unsupported paths with a test double.
- [x] 3.2 Register `/copy-last` as a local CLI command, wire response selection, normalization, clipboard output, and success/error toasts; verify the command does not submit a model prompt and leaves the clipboard unchanged on failure.
- [x] 3.3 Verify OpenCode auto-discovers the globally linked local plugin without a `cli.json` entry and recognizes `/copy-last` in an active session.

## 4. Verify repository integration

- [x] 4.1 Run `npm run test`, `npm run check`, and `npm run typecheck`; verify the plugin config parses and a TUI smoke test copies a response through a terminal that supports OSC 52.
