---
name: readme
description: Rewrite a repository README so a technical reader can see what is in it.
disable-model-invocation: true
---

# README

Rewrite or create `README.md` so a technical reader can see what this repository actually contains, without touring every subsystem.

## Constraints

- Short: opening, inventory, layout, setup. Cut anything that restates the tree.
- Concrete: name real paths, tools, and mechanisms. A sentence that could sit on any other repo is filler — cut or replace it.
- Balanced: give each first-class area weight proportional to the work in the tree, not to whichever folder you opened first.
- Diagrams are optional. Add one only when a mapping or runtime relationship is hard to see in prose or a tree; delete it if the layout section already carries the same information.
- Language: English unless the user names another.
- Do not invent features, metrics, or claims absent from the repo.

## Workflow

1. Ground in the repo.
   - Read the current `README.md` if any.
   - Inspect the tree: manifests (`package.json`, lockfiles, link/install configs), top-level dirs, ADRs, domain/context docs, and main entrypoints.
   - List the first-class areas a stranger should know about.
   - Complete when you can name each area, its path, and one concrete sentence of what it does — from evidence in the tree, not guesswork.

2. Draft the README.
   - Opening: what the repo is and the one mechanism that ties it together (linker, app entry, monorepo root, etc.).
   - Inventory: a table or short list of areas with path and role.
   - One paragraph on where custom work concentrates, without burying the other areas.
   - Layout: a compact text tree; put destinations or purposes in comments when that clarifies installs or boundaries.
   - Setup: only the commands needed to install and verify.
   - Complete when a reader who never opens another file can answer: what is this, what was built, how do I run it.

3. Balance check.
   - Re-read for overweight sections (one tool or module dominating).
   - Re-read for missing first-class areas from step 1.
   - Complete when every area from step 1 appears, and no single area eats the opening or the inventory.

4. Slop pass via sub-agent.
   - Write the balanced draft to `README.md` first (the sub-agent edits that file; it does not see this conversation).
   - Spawn one sub-agent whose only job is the `no-ai-slop` skill in edit mode on `README.md`. Include in its prompt: the absolute path to `README.md`, that the audience is a technical reader of this repo, and that it must apply `no-ai-slop` edit mode and write the result back to that path.
   - Do not run the slop pass yourself — keep drafting context out of the edit.
   - Complete when the sub-agent has updated `README.md` and returned a short What changed list.

5. Hand back.
   - Point at `README.md` and summarise what changed in a few bullets (drafting choices plus the sub-agent's What changed).
   - Ask at most one follow-up, and only if something real is still open (language, depth on one area, diagram).
