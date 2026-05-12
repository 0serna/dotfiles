## 1. Restructure the managed Pi source tree

- [x] 1.1 Move the managed Pi prompt templates from `dotfiles/pi/prompts` to `dotfiles/pi/agent/prompts`.
- [x] 1.2 Move the managed Pi extensions from `dotfiles/pi/extensions` to `dotfiles/pi/agent/extensions`.
- [x] 1.3 Confirm the remaining managed Pi files still mirror the intended split between `~/.pi/*` and `~/.pi/agent/*` without adding runtime-only paths.

## 2. Update manifest references

- [x] 2.1 Update the Pi entries in `dotfiles.json` so each source path matches the new `dotfiles/pi` layout.
- [x] 2.2 Verify the Pi manifest targets remain unchanged and still point to the same `~/.pi` and `~/.pi/agent` destinations.

## 3. Validate the repository contract

- [x] 3.1 Run the repository checks needed to confirm the moved Pi paths and updated manifest remain valid.
- [x] 3.2 Review the resulting tree to confirm `dotfiles/pi` mirrors only the shareable subset of `~/.pi`.
