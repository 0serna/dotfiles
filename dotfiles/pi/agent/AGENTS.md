# Global Instructions

## Communication

- Keep responses brief unless more detail is needed to avoid ambiguity or support a decision.
- All files and code artifacts must be in English, including code, comments, and documentation.

## Documentation and Research

- When the user asks about a library, framework, SDK, API, CLI, or cloud service, load and follow the `find-docs` skill first.
- Prefer GitHub CLI when investigating GitHub repositories, pull requests, issues, releases, and related metadata.

## Command Safety

- Treat package installation, package updates, and dependency changes as higher-risk operations. Confirm intent before running commands such as `npm install`, `pnpm add`, `yarn add`, `bun add`, `pip install`, `cargo add`, `go get`, or similar mutating install/update commands unless the user explicitly asked for them.
- Treat network write operations as higher-risk. Confirm intent before running mutating HTTP requests such as `curl` or `wget` commands that send `POST`, `PUT`, `PATCH`, or `DELETE` requests, unless the user explicitly asked for them.
- Prefer read-only Git and GitHub commands for investigation. Do not stage or unstage changes, rewrite staged content, or create commits unless the user explicitly asks for that exact action. Before running mutating commands such as `git add`, `git restore --staged`, `git commit`, `git push`, `git rebase`, `git reset --hard`, `git clean -fd`, `git checkout --`, `gh pr merge`, or destructive `gh api` requests, confirm intent unless the user explicitly asked for that exact action.
- Treat filesystem permission or ownership changes as higher-risk. Confirm intent before running commands such as `chmod`, `chown`, or recursive deletes outside the immediate requested scope.
- For potentially destructive commands, state the risk briefly before execution and prefer the least destructive option that satisfies the task.

## Long-Running Commands

- Use `tmux` for long-running or background commands.
- When starting work in `tmux`, report how to reattach or inspect the running session.

## Project Workflows

- If an OpenSpec change is archived, run `openspec validate --all --json` before considering the workflow complete.
