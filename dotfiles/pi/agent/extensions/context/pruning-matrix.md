# Context pruning matrix

- Tools without an explicit policy entry are excluded from all pruning mechanisms.
- DCP applies the first enabled mechanism in order: `superseded` → `stale_large`.
- Thresholds: `PRUNE_TOKEN_THRESHOLD = 500` tokens, `STALE_LARGE_MIN_AGE = 25`.

| Tool                      | superseded | stale_large |
| ------------------------- | ---------: | ----------: |
| `question`                |         No |          No |
| `multi_tool_use.parallel` |         No |          No |
| `read`                    |        Yes |          No |
| `write`                   |        Yes |         Yes |
| `edit`                    |         No |         Yes |
| `bash`                    |         No |         Yes |
| `web_fetch`               |         No |         Yes |
| `web_search`              |         No |         Yes |

## Mechanisms

- `superseded`: prunes older result when a later file operation targets the same semantic operation identity.
- `stale_large`: prunes textual results whose estimated size is greater than `500` tokens and that are older than `25` DCP-ageable tool results.
