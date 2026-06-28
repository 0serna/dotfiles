# Context pruning matrix

Tools without an explicit policy entry are excluded from all pruning mechanisms.

| Tool                      | duplicate | resolved | superseded | stale_large |
| ------------------------- | --------: | -------: | ---------: | ----------: |
| `question`                |        No |       No |         No |          No |
| `multi_tool_use.parallel` |        No |       No |         No |          No |
| `read`                    |       Yes |      Yes |        Yes |          No |
| `edit`                    |       Yes |      Yes |        Yes |         Yes |
| `write`                   |       Yes |      Yes |        Yes |         Yes |
| `bash`                    |       Yes |      Yes |         No |         Yes |
| `web_fetch`               |       Yes |      Yes |         No |         Yes |
| `web_search`              |       Yes |      Yes |         No |         Yes |

## Mechanisms

- `duplicate`: prunes later repeated normalized text.
- `resolved`: prunes an error when a later success exists for the same operation target.
- `superseded`: prunes older same-tool file results for the same target.
- `stale_large`: prunes textual results above the token threshold after the age gate.
