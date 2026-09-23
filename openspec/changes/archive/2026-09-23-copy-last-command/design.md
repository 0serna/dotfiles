# Design

## Context

The global OpenCode CLI configuration and plugins directory are already managed through `dotfiles.json`. The existing `skills-as-slash` plugin registers server-side commands that resubmit prompts, which is not appropriate for a local clipboard action. OpenCode V2 supports local CLI plugins with slash commands and access to session message data.

## Goals / Non-Goals

**Goals:**

- Make `/copy-last` available in the user's globally configured OpenCode TUI.
- Copy only the latest completed, user-visible assistant response from the active session.
- Convert common Markdown to readable plain text without adding a runtime dependency.
- Report success and expected failure cases in the TUI.

**Non-Goals:**

- Add a keyboard shortcut, command arguments, or multi-message copying.
- Copy user prompts, reasoning, tool activity, or child-session output.
- Implement a complete Markdown parser or support every Markdown extension.
- Send a model prompt or modify session history.

## Decisions

### Use a global CLI-only plugin

Place the plugin in a dedicated subdirectory under `dotfiles/opencode/plugins/`. OpenCode discovers its TUI entrypoint through the existing global plugins-directory link without a `cli.json` entry. This keeps clipboard access in the local TUI process, including when the TUI is connected to a remote OpenCode server. A server plugin command was rejected because it runs on the server side and can follow the prompt-submission path used by existing server commands.

Resolve the active session from the current CLI route. Read assistant messages in descending order from the connected server and paginate backward until finding the newest completed assistant response with user-visible text, skipping tool-continuation messages and internal content. The TUI message cache only covers a window of long sessions; session context may omit earlier responses after compaction. Verify the exact message ordering and completion fields against the installed OpenCode runtime before implementation.

### Normalize common Markdown locally

Use a small, isolated normalizer rather than adding a Markdown package. The repository has no existing Markdown-to-text parser, and OpenCode's V2 documentation does not specify dependency resolution for extra packages in discovered local plugins. The normalizer will handle common headings, blockquotes, emphasis, inline code, fenced code, links, lists, and pipe-delimited tables according to the spec. Code indentation and content remain intact; tables retain pipe separators.

A full Markdown parser was considered but would add dependency installation and resolution work for a global local plugin. Uncommon or nested Markdown constructs may be best-effort rather than rendered perfectly.

### Write through the terminal's OSC 52 clipboard path

Use the CLI renderer's OSC 52 clipboard support so the TUI can send copied text to the terminal client without relying on `xclip`, `xsel`, or `wl-copy`. OpenTUI documents OSC 52 clipboard output, and the installed OpenCode 2.0.15 runtime contains renderer support. OpenCode's plugin documentation does not guarantee this renderer method as a stable plugin API, so isolate the call, check runtime support and its return value, and show an error toast when unsupported.

A host-specific clipboard utility was rejected because none is installed on the current X11 host and it would couple the plugin to an OS utility. A clipboard package was rejected because arbitrary dependency loading for discovered local plugins is not documented.

### Keep invocation and feedback local

The slash command reads current session state and copies the selected text directly; it does not submit a user prompt or add synthetic history. Show a success toast when the renderer accepts the OSC 52 write. Show an error toast if there is no active session, no completed final response, or the renderer cannot send the clipboard sequence.

## Risks / Trade-offs

- **Renderer API can change between OpenCode releases** → Isolate clipboard access behind a small helper, verify against the installed runtime, and fail with a toast rather than crashing the TUI.
- **OSC 52 support varies by terminal and may not confirm that the clipboard changed** → Check the renderer's support/result signals and only report success when it accepts the sequence; document that terminal policy still controls receipt.
- **A local normalizer cannot cover all Markdown dialects** → Keep its supported cases explicit, preserve unknown text conservatively, and add focused tests for agreed formats.
- **OpenCode binary and local plugin types are on different patch versions (2.0.15 and 2.0.14)** → Confirm the route and message APIs against the runtime before relying on type declarations.

## Migration Plan

Add the plugin directory to the already-linked global plugins directory and include that directory in TypeScript checks. No session data migration is required. To roll back, remove the plugin directory.
