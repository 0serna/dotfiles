---
name: agents-md
description: >-
  Create or maintain repository context in AGENTS.md. Use when repository
  structure or developer commands change, or when another skill needs to
  document verified commands.
---

# AGENTS.md

Maintain the generated block, and nothing else in it. The block is always first, in this order: `## Repository Structure`, then `## Repository Commands`. Follow the style of [templates/agents-md-example.md](templates/agents-md-example.md).

## Repository Structure

Fenced tree starting at `.`. Show only maintained directories that help navigation. Exclude hidden, ignored, generated, dependency, cache, coverage, and build output. Go one level deep only when subdirectories reveal the directory's purpose. Annotate directories whose purpose is not obvious.

## Repository Commands

List commands developers run from the root through a runner or CLI, including delegated scripts. Exclude lifecycle hooks (`prepare`, `preinstall`, and similar). Every command needs evidence in a manifest, task runner, or executable script. Do not invent commands. If none exist, write `No useful commands detected.`

## Update Rules

Find each generated heading. Replace it up to the next same or higher heading. Insert a missing section at the start. Move unrelated leading content after the block unchanged, and correct references there that no longer apply. Preserve all other content exactly.

Done when the block is first, every command has evidence, and content outside the block is unchanged.
