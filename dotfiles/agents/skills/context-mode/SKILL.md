---
name: context-mode
description: Use context-mode MCP tools to keep long command output, logs, docs, API responses, and large file analysis out of the main context window. Use this skill whenever a task may produce more than 20 lines of output, needs counting/filtering/parsing/comparing data, involves multiple CLI/API/doc fetches, or would otherwise require reading raw logs or large files into context.
---

# Context Mode

Use this skill to route work through context-mode so the assistant gets concise answers without flooding the context window. These routing rules are mandatory: gather and process data in the sandbox, then return only the result needed for the current decision.

## Core Rule

When a task requires analyzing, counting, filtering, comparing, searching, parsing, or transforming data, write code that performs the analysis and prints only the answer. Program the analysis; do not read raw data into context and compute the answer manually.

Prefer JavaScript with Node.js built-ins (`fs`, `path`, `child_process`). Use `try/catch`, handle `null` and `undefined`, and avoid npm dependencies unless the project already requires them.

## Tool Routing

Use this routing order:

1. `context-mode_ctx_search(sort: "timeline")` to recover prior indexed context after resuming a session before asking the user to repeat details.
2. `context-mode_ctx_batch_execute` to run several gather commands, auto-index their output, and search the indexed results in one call.
3. `context-mode_ctx_search` for follow-up questions against already indexed material. Batch all related questions in one `queries` array.
4. `context-mode_ctx_execute` for sandboxed processing where only stdout should enter context.
5. `context-mode_ctx_execute_file` for logs, data files, generated reports, or large source files that should be processed without loading full contents into context.
6. `context-mode_ctx_fetch_and_index` for web pages and documentation. Fetch, index, then search instead of reading raw HTML or long markdown.
7. `context-mode_ctx_index` for local docs or references you may need to search repeatedly.

## Blocked Routes

Do not attempt these routes. If blocked, do not retry the same path.

- Do not use shell `curl` or `wget`. Use `context-mode_ctx_fetch_and_index` for web pages/docs, or `context-mode_ctx_execute` with JavaScript only when a compact HTTP result must be fetched and printed.
- Do not use inline HTTP from normal shell or file reads, such as `fetch('http')`, `requests.get`, `requests.post`, `http.get`, or `http.request`. Use `context-mode_ctx_execute` so only stdout enters context.
- Do not use direct web fetching for docs or large pages. Use `context-mode_ctx_fetch_and_index`, then `context-mode_ctx_search`.

## Shell Output

If a command may produce more than 20 lines, do not send raw output through a normal shell tool unless the command is one of the allowed shell routes below.

Use normal shell only for:

- Git writes and state checks requested by the workflow.
- File mutations such as `mkdir`, `rm`, `mv`, and similar operations.
- Package installation commands such as `npm install` or `pip install`.
- Short directory checks such as `ls` when required before creating files or directories.

For everything else that may be long, use `context-mode_ctx_execute`, `context-mode_ctx_execute_file`, or `context-mode_ctx_batch_execute` and print a concise summary.

For file reading, use normal file tools when reading to edit. When reading to analyze, summarize, extract, count, or compare, use `context-mode_ctx_execute_file`.

For grep/search with large results, use sandboxed shell through `context-mode_ctx_execute` and print only the relevant summary.

## Think In Code

When processing command output or file contents, do not read the raw data into context and reason over it manually. Program the analysis instead.

Good pattern:

```js
try {
  const { execSync } = require("child_process");
  const output = execSync("git log --oneline -50", { encoding: "utf8" });
  const featCount = output
    .split("\n")
    .filter((line) => line.includes("feat")).length;
  console.log(`feat commits in last 50: ${featCount}`);
} catch (error) {
  console.log(`failed: ${error.message}`);
}
```

Bad pattern:

```text
Run a verbose command, paste all output into context, then count or compare it manually.
```

## Batch Work

Prefer `context-mode_ctx_batch_execute` when collecting several independent facts, especially from network/API commands. Include all commands and all search questions in the same call.

Use concurrency intentionally:

- Use `concurrency: 4-8` for I/O-bound work such as GitHub API calls, `curl`, DNS, cloud queries, Docker inspect, or multi-URL fetches.
- Use `concurrency: 1` for CPU-bound or stateful work such as tests, builds, linting, commands that share ports, commands that share lock files, or commands mutating the same repository.
- Cap concurrent `gh` calls at `4` to avoid GitHub API rate-limit pressure.

Add a processing command when the gathered data needs counting, filtering, comparison, or transformation. The processing command should print only the final answer.

## Web And Docs

For documentation and web research, prefer indexing before reading:

1. Use `context-mode_ctx_fetch_and_index` for one URL, or `requests` with concurrency for multiple URLs.
2. Use `context-mode_ctx_search` to retrieve only the relevant sections.
3. Cite or summarize the searched sections without pulling the full page into context.

Use `context-mode_ctx_index` for large local markdown, README files, API references, migration guides, and skill instructions that you may need to query repeatedly.

## Large Files

Use `context-mode_ctx_execute_file` for logs, JSON, CSV, XML, build output, test output, and large source files when you need extracted facts rather than the whole file.

Examples of good outputs:

- `3 failing tests: auth-login, billing-proration, invoice-pdf`
- `largest bundle grew by 42 KB: dashboard.js`
- `12 rows missing customer_id; first bad row: 184`

## Reporting Style

Report results tersely and concretely. Drop filler, pleasantries, hedging, and unnecessary articles. Fragments are acceptable when clear. Auto-expand only for security warnings, irreversible actions, or user confusion.

```text
[thing] [action/status]. [reason]. [next step].
```

Examples:

- `Test output summarized. 2 failures share the same missing fixture. Updating fixture path next.`
- `Docs indexed. Relevant API section found under "Streaming responses". Applying that pattern.`
- `Log processed. 418 errors all start after deploy 9f31c2. Checking config diff next.`

## Safety

- Do not use context-mode tools to bypass repository safety rules, git rules, or user approval requirements.
- Do not hide destructive operations inside processing scripts.
- Do not print secrets, full environment dumps, tokens, credentials, or raw private data into context. Extract only the minimum fact needed.
- If a command mutates files, installs packages, starts services, or changes git state, follow the normal project/tooling rules for that operation.

## Session Continuity

Skills, roles, decisions, and indexed session history persist for the whole session. After resume, search before asking the user to repeat context.

Examples:

- Decisions: `context-mode_ctx_search(queries: ["decision"], source: "decision", sort: "timeline")`
- Constraints: `context-mode_ctx_search(queries: ["constraint"], source: "constraint")`

If search returns no useful context, proceed as a fresh session.

## Context Commands

Handle these user commands directly:

- `ctx stats`: call `context-mode_ctx_stats` and display the full output verbatim.
- `ctx doctor`: call `context-mode_ctx_doctor` and display the report as a checklist.
- `ctx upgrade`: call `context-mode_ctx_upgrade`, run the returned shell command, display output as a checklist, and tell the user to restart the session.
- `ctx purge`: warn that it permanently deletes all session data, then call `context-mode_ctx_purge` with `confirm: true` only if the user confirms.

After `/clear` or `/compact`, knowledge base and session stats are preserved. Use `ctx purge` only when the user wants a fresh context-mode state.
