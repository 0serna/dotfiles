---
name: agents-md
disable-model-invocation: true
description: Create or maintain AGENTS.md repository context.
---

# AGENTS.md

Create or maintain root `AGENTS.md`. Compile the generated block first, then preserve every unrelated section exactly.

## Workflow

1. Load `templates/agents-md-example.md` for heading order, fence style, and bullet style.
2. Read `AGENTS.md` if it exists; separate content to preserve from content to replace.
3. Map structure from actual files and directories. Render per the Repository Structure spec below.
4. Identify the general project stack from manifests, lockfiles, config files, toolchain files, and framework conventions. Render per the Repository Stack spec below.
5. Find commands with explicit evidence: manifests, task runners, or executable scripts. If none exist, write `No useful commands detected.`
6. Suggest extra sections when constraints are not captured by the generated block; add only after user approval.
7. Create or update `AGENTS.md`. Done when the generated block is first and unrelated content is unchanged.
8. Report created/updated, tree depth, stack items listed, commands listed, and approved extras.

## Repository Structure

Build a markdown code-fence tree starting at `.`. Show only directories — no files, no hidden directories. Respect `.gitignore` rules to exclude ignored directories from the tree. Go one level deep only when subdirectories reveal the directory's purpose; otherwise stop at the root. Annotate each directory when its purpose is non-obvious.

## Repository Stack

List only the relevant general stack: primary languages, runtime, package manager, main framework or platform, test framework, build tool, formatter/linter, database, infrastructure, and deployment target when clearly evidenced. Keep it concise: one bullet per category, omit categories with no explicit evidence, and do not list individual libraries or every dependency. Prefer `Category: tool1, tool2` bullets. If no useful stack is detected, write `No useful stack detected.`

## Repository Commands

List explicit, useful commands invocable from the repository root through a runner or CLI: `npm run ...`, `make ...`, `just ...`, `task ...`, or direct executable scripts when that is the intended public entrypoint. Commands may be for code, docs, publishing, validation, or automation. Omit lifecycle hooks, internal helpers, deploy-only commands, and descriptions of `scripts/` contents that are not root-level commands. Do not invent conventional commands.

## Update Rules

The generated block is always first in the file:

1. `## Repository Structure`
2. `## Repository Stack`
3. `## Repository Commands`

Find each by heading; replace from heading to next same/higher heading or EOF. Rename mismatched headings (e.g. `## Project Structure` → `## Repository Structure`, `## Tech Stack` → `## Repository Stack`). If missing, insert at the start. If `AGENTS.md` begins with unrelated content, move it after the generated block unchanged. When updating, detect references in preserved content that no longer apply due to structural, stack, or command changes (e.g. directory paths, script names, tool names) and correct them. Preserve all unrelated content exactly. Do not format or validate afterwards.
