# Context pruning matrix

Tools without an explicit policy entry are excluded from all pruning mechanisms.

| Tool                      | duplicate | resolved | superseded | stale_large |
| ------------------------- | --------: | -------: | ---------: | ----------: |
| `question`                |        No |       No |         No |          No |
| `multi_tool_use.parallel` |        No |       No |         No |          No |
| `read`                    |        No |      Yes |        Yes |         Yes |
| `write`                   |        No |      Yes |        Yes |         Yes |
| `edit`                    |        No |      Yes |         No |         Yes |
| `bash`                    |       Yes |      Yes |         No |         Yes |
| `web_fetch`               |       Yes |      Yes |         No |         Yes |
| `web_search`              |       Yes |      Yes |         No |         Yes |

## Mechanisms

- `duplicate`: prunes older repeated normalized text globally for non-file tools that allow it.
- `resolved`: prunes an error when a later success exists for the same semantic operation identity.
- `superseded`: prunes an older result when a later operation truly replaces it by tool-specific semantic identity.
- `stale_large`: prunes textual results above the token threshold after the age gate.
