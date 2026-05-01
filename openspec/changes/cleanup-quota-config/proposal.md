## Why

`experimental.quotaToast` in `opencode.jsonc` is legacy — opencode-quota v3.5.0 uses a dedicated sidecar config (`opencode-quota/quota-toast.json`). The sidecar has additional settings (`formatStyle`, `percentDisplayMode`) not present in the legacy block, and it isn't tracked in the dotfiles repo, so fresh installs via `npm run link` get the redundant legacy block but miss the actual config file.

## What Changes

- **Remove** `experimental.quotaToast` block from `dotfiles/opencode/opencode.jsonc`
- **Add** `dotfiles/opencode/opencode-quota/quota-toast.json` to the repository
- **Add** manifest entry in `dotfiles.json` to symlink `opencode-quota/` to `~/.config/opencode/opencode-quota/`

## Capabilities

### New Capabilities

None — this is a config maintenance change within existing dotfile infrastructure.

### Modified Capabilities

None — no spec-level behavior changes.

## Impact

- `dotfiles/opencode/opencode.jsonc`: removed `experimental` block
- `dotfiles/opencode/opencode-quota/quota-toast.json`: new file (mirrors current live config)
- `dotfiles.json`: new entry for `opencode-quota/` directory
- `~/.config/opencode/opencode-quota/`: becomes a symlink to the repo (was a local-only directory)
