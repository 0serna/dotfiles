## Communication

- Keep your answers concise and to the point. Avoid using filler words.
- Use the `question` tool whenever presenting options or decisions to the user.

## Project Management

- After finishing edits, always run the project's configured check commands when available, such as lint, format, or build.
- NEVER generate documentation files unless the user explicitly requests them.
- NEVER use stash, stage or commit without the user's explicit permission.

## Context Management

- Use `ctx_batch_execute` when running multiple commands, exploring a project, or expecting large output that needs to be searched or summarized.
- Use `ctx_execute` for a single command or script whose raw output may exceed 20 lines, especially tests, diffs, logs, API calls, or data-processing tasks.
- Use `ctx_execute_file` for large files when you only need extracted facts, counts, matches, or summaries instead of the full file content.
- Use `ctx_index` for long-lived reference material such as docs, READMEs, API references, migration guides, or skill instructions that may need precise lookup later.
- Use `ctx_search` only after content has been indexed with `ctx_index`, `ctx_fetch_and_index`, or `ctx_batch_execute`.
- Use `ctx_fetch_and_index` for web documentation or URL content that should be searchable without loading the full page into context.
- Use `ctx_stats` to inspect context usage when context size or tool-output volume matters.
- Use `ctx_doctor` to diagnose context-mode installation problems.
- Use `ctx_upgrade` only when context-mode needs updating, then run the returned command and tell the user to restart the session.
- Use `ctx_purge` only when explicitly clearing all indexed/session data is intended, because it is destructive.
- Use `ctx_insight` only when the user wants the local context analytics dashboard.
- DO NOT use context management tools for small, direct file reads, simple file searches, or small edits; prefer `read`, `glob`, `grep`, and `apply_patch` for those.
- DO NOT bring large raw outputs into the conversation when a context management tool can summarize, filter, index, or search them first.

## GitHub

- MUST prefer GitHub CLI when investigating GitHub repositories, pull requests, issues, and related metadata.
- If necessary, clone repositories to temporary directories `/tmp` to analyze them more efficiently.
