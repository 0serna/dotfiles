## 1. Remove legacy config from opencode.jsonc

- [x] 1.1 Remove `experimental.quotaToast` block (lines 46-52) from `dotfiles/opencode/opencode.jsonc`
- [x] 1.2 Verify no trailing comma issues after removal

## 2. Add quota sidecar to dotfiles

- [x] 2.1 Create `dotfiles/opencode/opencode-quota/quota-toast.json` with current live config (enabledProviders, enableToast, showSessionTokens, formatStyle, percentDisplayMode)
- [x] 2.2 Add manifest entry to `dotfiles.json` mapping `dotfiles/opencode/opencode-quota/` → `~/.config/opencode/opencode-quota/`

## 3. Relink and verify

- [x] 3.1 Run `npm run link` to create the new symlink
- [x] 3.2 Verify `~/.config/opencode/opencode-quota/` is a symlink to the repo
- [x] 3.3 Verify opencode loads without errors (plugin finds quota-toast.json in sidecar)
- [x] 3.4 Run `npm run check` to ensure lint/format/types pass
