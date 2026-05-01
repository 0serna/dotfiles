## Context

`experimental.quotaToast` in `opencode.jsonc` is a legacy config block from opencode-quota pre-v3. The plugin now reads from a dedicated sidecar file `opencode-quota/quota-toast.json` located next to `opencode.jsonc`. Our dotfiles repo tracks `opencode.jsonc` via symlink but has no entry for the sidecar directory, so the sidecar config is missing on fresh installs.

Current state of `~/.config/opencode/`:

```
~/.config/opencode/
├── opencode.jsonc        ← symlink → dotfiles (has dead experimental.quotaToast)
├── opencode-quota/
│   └── quota-toast.json  ← NOT in dotfiles (local-only)
├── tui.jsonc             ← symlink → dotfiles (has @slkiser/opencode-quota ✅)
└── node_modules/
```

## Goals / Non-Goals

**Goals:**

- Remove the redundant `experimental.quotaToast` block from `opencode.jsonc`
- Track `opencode-quota/quota-toast.json` in dotfiles so it's present on fresh installs
- Maintain identical runtime behavior — no change to what the plugin reads

**Non-Goals:**

- Not changing the contents or schema of `quota-toast.json`
- Not modifying the installer source code (only config files and manifest)
- Not adding `--sync-legacy-config` flag (we want to move away from legacy)

## Decisions

1. **Directory symlink over file symlink** — The `opencode-quota/` directory will be symlinked as a whole (`dotfiles/opencode/opencode-quota/` → `~/.config/opencode/opencode-quota/`). The plugin does not write state files to this directory (uses in-memory/SQLite tracking), so there's no risk of losing runtime state. A directory symlink is cleaner and future-proof if more config files are added here.

2. **Remove, not deprecate** — `experimental.quotaToast` is removed outright rather than left as a commented-out placeholder. If someone reads the config, they should see only active settings.

3. **No spec file needed** — This is a config maintenance change within the existing dotfiles infrastructure, not a new capability. No spec-level requirements are added or modified.

## Risks / Trade-offs

| Risk                                                                                                                              | Mitigation                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| If a future opencode-quota version writes state to `opencode-quota/`, the dir symlink would prevent it persisting across machines | Acceptable — state should go elsewhere. Monitor upstream changes. |
| The `quota-toast.json` values were chosen during exploration and may need tuning later                                            | Config is version-controlled; easy to update.                     |
