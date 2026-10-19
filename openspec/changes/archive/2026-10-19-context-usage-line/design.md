# Design

## Context

See `proposal.md` for motivation and `specs/context-report/spec.md` for the behavior contract.

The repository already links:

- `dotfiles/opencode/plugins/` to `~/.config/opencode/plugins/` as a directory.
- Individual files under `dotfiles/pi/` with file-level entries in `dotfiles.json`.

Pi 1.3.0 exposes `on("context", handler)` with a mutable `messages` transcript and `ctx.getContextUsage(): { tokens: number | null } | undefined`. OpenCode 2.0.14 exposes `ctx.session.hook("context", cb)` with a mutable `SessionContext.messages` and `ctx.session.context({ sessionID })` for the persisted session messages.

## Goals / Non-Goals

**Goals:**

- One note format and one user-visible line across Pi and OpenCode.
- Keep the request's cached prefix unchanged by appending the note last.
- Keep both adapters small and dependency-free.

**Non-Goals:**

- Detecting or repairing missed `context:` lines.
- Configuring a 300k compaction threshold.
- Rendering TUI widgets or footers.
- Adding a note for Codex, which has no adapter here.

## Decisions

### The model writes the line

The note is a normal user message at the end of the request. The model reads it and writes the final `context: <n>k` line as assistant text. This is the only signal T3 Code renders, and it keeps the harness free of transcript rewriting. Repairing missed lines is deferred until the miss rate is known.

### The note is request-local and appended last

Both adapters add the note after the existing transcript, never in the system prompt and never in persisted session history. The cached prefix stays intact, and the note never appears in later turns.

Format: `status: <tokens>` with an integer token count.

### Pi: transform the `context` event

Create `dotfiles/pi/extensions/context-report.ts`:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let compacting = false;

  pi.on("session_before_compact", () => {
    compacting = true;
  });
  pi.on("session_compact", () => {
    compacting = false;
  });
  pi.on("session_compact_failed", () => {
    compacting = false;
  });

  pi.on("context", (event, ctx) => {
    const tokens = ctx.getContextUsage()?.tokens;
    if (compacting || tokens == null) return;
    return {
      messages: [
        ...event.messages,
        { role: "user" as const, content: `status: ${tokens}`, timestamp: Date.now() },
      ],
    };
  });
}
```

The import is type-only, so the extension needs no runtime dependency. The extension stays out of the repository `tsconfig` include list, as the existing Pi settings do; `jiti` loads it directly. Add a file-level link from `dotfiles/pi/extensions/context-report.ts` to `~/.pi/agent/extensions/context-report.ts`.

### OpenCode: read the last completed step from the session context

Create `dotfiles/opencode/plugins/context-report/` with:

- `usage.ts`: pure helpers. `totalTokens` sums input, output, reasoning, cache reads, and cache writes. `lastStepTokens` returns the total of the last assistant step after the latest compaction message. `statusNote` builds the request message.
- `index.ts`: `Plugin.define` setup that registers the async `context` hook.

```ts
await ctx.session.hook("context", async (request) => {
  const messages = await ctx.session.context({
    sessionID: request.sessionID,
  });
  const tokens = lastStepTokens(messages);
  if (tokens == null) return;
  request.messages.push(statusNote(tokens));
});
```

The event-based approach was rejected: `session.step.ended` arrived after the next request's `context` hook, so the note was always one request late. Reading the persisted session context inside the hook gives the last completed step synchronously. `lastStepTokens` starts after the latest `compaction` message, so a pre-compaction number never survives.

The manifest links this plugin directory as its own entry, matching `copy-last` and `skills-as-slash`. Its `package.json` exports `index.ts` as the server entrypoint.

### The shared rule lives in AGENTS.md

`dotfiles/AGENTS.md` is linked to Pi, OpenCode, and Codex. Add a `## Context usage` section:

```text
- When a request ends with a `status: <tokens>` note, end the final answer of the turn with one line: `context: <n>k`, where `n` is tokens divided by 1000 and rounded to the nearest integer.
- Write the line only in the final answer: not in intermediate messages, not when the turn ends with a tool call, and not when the turn fails.
```

Codex never receives a note, so the rule stays dormant there.

## Risks / Trade-offs

- The model can omit or misformat the line → accept for the first version and measure the miss rate before adding detection.
- A model could echo the note itself → keep the note format distinct from the requested output (`status:` vs `context:`).
- OpenCode's number lags one step → acceptable for a human decision signal.
- A compaction request could include the note → Pi gates on `session_before_compact`; OpenCode ignores assistant steps before the latest `compaction` message.
- The Pi extension is not typechecked by the repository → keep it minimal and smoke-test it with `pi --extension`.
