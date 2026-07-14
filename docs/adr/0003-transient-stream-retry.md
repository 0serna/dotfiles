# Transient stream retry for streaming failures

When a provider returns `stopReason: "error"` with `errorMessage: "Streaming response failed"`, the quota extension retries once with the same account by sending `sendUserMessage("continue")`. If the retry also fails, the extension does not intervene and lets Pi handle the error naturally.

We considered treating streaming failures like quota exhaustion (immediate rotation + continue), but rejected that because streaming failures are transient errors — rotating accounts would burn through accounts unnecessarily when the problem is the connection or server, not the account. A single retry is enough to distinguish a transient hiccup from a persistent failure; if the second attempt also fails, the issue is likely not account-specific and rotation would not help.
