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
4. Find commands with explicit evidence in manifests, task runners, or executable scripts. If none exist, write `No useful commands detected.`
5. Suggest extra sections when constraints are not captured by the generated block; add only after user approval.
6. Create or update `AGENTS.md`. Done when the generated block is first and unrelated content is unchanged.
7. Report created/updated, tree depth, commands listed, and approved extras.

## Repository Structure

Build a markdown code-fence tree starting at `.`. Show only maintained directories that help an agent navigate the repository, such as source, tests, configuration, documentation, and automation. Exclude hidden, ignored, generated, dependency, cache, coverage, and build-output directories such as `dist`, `build`, `generated`, `vendor`, and `node_modules`. Go one level deep only when subdirectories reveal the directory's purpose; otherwise stop at the root. Annotate each directory when its purpose is non-obvious.

## Repository Commands

List explicit commands developers intentionally run from the repository root through a runner or CLI: `npm run ...`, `make ...`, `just ...`, `task ...`, or direct executable scripts when that is the public entrypoint. Keep commands for useful development, validation, build, and release workflows. Exclude dependency installation, lifecycle hooks such as `prepare`, internal helpers, and incidental scripts. Do not invent conventional commands.

## Update Rules

The generated block is always first in the file:

1. `## Repository Structure`
2. `## Repository Commands`

Find each by heading; replace from heading to next same/higher heading or EOF. Insert missing generated sections at the start. If `AGENTS.md` begins with unrelated content, move it after the generated block unchanged. When updating, detect references in preserved content that no longer apply due to structural or command changes (e.g. directory paths or script names) and correct them. Preserve all unrelated content exactly. Do not format or validate afterwards.
