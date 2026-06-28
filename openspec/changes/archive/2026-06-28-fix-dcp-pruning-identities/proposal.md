## Why

DCP context pruning currently treats some tool results as equivalent using overly broad targets, such as considering `read` calls to the same file equivalent even when they read different line ranges. This can remove useful context and misclassify unrelated operations as superseded or resolved.

## What Changes

- Refine pruning identities so internal decisions use semantic operation keys instead of display targets.
- Treat `read` calls as the same operation only when path, offset, and limit match.
- Remove `superseded` pruning for `edit` results because separate edits to the same file do not replace each other.
- Keep `write` superseding earlier writes to the same path because writes replace full file contents.
- Keep `duplicate` as a global text-based mechanism independent from semantic operation identity.
- Update tests and pruning documentation to reflect the stricter behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: Context pruning identity rules for `read`, `edit`, `write`, `resolved`, `superseded`, and `duplicate` are refined to avoid pruning distinct operations.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/metadata.ts`, `dotfiles/pi/agent/extensions/context/prune.ts`, context pruning tests, and pruning matrix documentation.
- No public API or dependency changes.
- Expected behavior change: fewer unsafe `superseded`/`resolved` prunes for partial reads and independent edits, while duplicate text pruning remains available.
