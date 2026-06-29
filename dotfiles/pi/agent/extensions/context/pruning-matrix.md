# Context pruning matrix

- Tools without an explicit policy entry are excluded from all pruning mechanisms.
- DCP applies the first enabled mechanism in order: duplicate → resolved → superseded → stale_large

| Tool                      | duplicate | resolved | superseded | stale_large |
| ------------------------- | --------: | -------: | ---------: | ----------: |
| `question`                |        No |       No |         No |          No |
| `multi_tool_use.parallel` |        No |       No |         No |          No |
| `read`                    |        No |       No |        Yes |          No |
| `write`                   |        No |       No |        Yes |         Yes |
| `edit`                    |        No |       No |         No |         Yes |
| `bash`                    |       Yes |      Yes |         No |         Yes |
| `web_fetch`               |       Yes |       No |         No |         Yes |
| `web_search`              |        No |       No |         No |         Yes |

## Mechanisms

- `duplicate`: prunes older repeated normalized text (non-file tools)
- `resolved`: prunes error when later success exists (same operation identity)
- `superseded`: prunes older result when later operation replaces it (tool-specific identity)
- `stale_large`: prunes large textual results after age gate
