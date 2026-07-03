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
4. Find commands with explicit evidence: manifests, task runners, or executable scripts. If none exist, write `No useful commands detected.`
5. Suggest extra sections when constraints are not captured by the generated block; add only after user approval.
6. Create or update `AGENTS.md`. Done when the generated block is first and unrelated content is unchanged.
7. Report created/updated, tree depth, commands listed, and approved extras.

## Repository Structure

Build a markdown code-fence tree starting at `.`. Show only directories — no files, no hidden directories. Go one level deep only when subdirectories reveal the directory's purpose; otherwise stop at the root. Annotate each directory when its purpose is non-obvious.

## Repository Commands

List explicit, useful commands from `package.json`, `Makefile`, `justfile`, `Taskfile.yml`, or `scripts/` executables. Commands may be for code, docs, publishing, validation, or automation. Omit lifecycle hooks, internal helpers, and deploy-only commands. Do not invent conventional commands.

## Update Rules

The generated block is always first in the file:

1. `## Repository Structure`
2. `## Repository Commands`

Find each by heading; replace from heading to next same/higher heading or EOF. Rename mismatched headings (e.g. `## Project Structure` → `## Repository Structure`). If missing, insert at the start. If `AGENTS.md` begins with unrelated content, move it after the generated block unchanged. Preserve all unrelated content exactly. Do not format or validate afterwards.
