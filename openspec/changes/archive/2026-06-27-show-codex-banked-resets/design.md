## Context

The Pi quota extension already fetches Codex quota data from `https://chatgpt.com/backend-api/wham/usage`, parses quota windows and remaining credits, and publishes a compact combined status for the footer. Codex now includes banked rate-limit reset credits in that same usage response under `rate_limit_reset_credits.available_count` when the backend provides the data.

The footer must keep using Pi's existing Codex authentication and current read-only polling flow. The reset count is informational only; redeeming a reset is out of scope.

## Goals / Non-Goals

**Goals:**

- Parse the banked reset count from the existing Codex usage response.
- Preserve the distinction between banked resets and remaining credits.
- Display banked resets as a compact `R<n>` segment before `C<n>`.
- Show explicit zero values when reported by the backend.
- Avoid inventing reset data when the backend omits the field.

**Non-Goals:**

- Redeem or consume banked resets.
- Display expiration dates, eligibility, or reset history.
- Add new API calls, credentials, configuration, or dependencies.
- Change OpenCode Go quota behavior.

## Decisions

- Use the existing Codex usage endpoint instead of adding an app-server dependency. The required count is available in the current response shape, and the extension already authenticates and polls that endpoint.
- Store the reset count as a separate optional Codex quota field, not as part of `remainingCredits`. Banked resets and credits have different meaning and should not be merged.
- Treat an absent or null `rate_limit_reset_credits` object as unavailable data, not as zero. This preserves the distinction between `0 resets available` and `backend did not provide reset-credit state`.
- Render `R<n>` before `C<n>` using accent styling when `n > 0` and dim styling for `R0`. This keeps available resets visible without treating explicit zero as positive capacity.
- Do not derive expiration or eligibility from the count. Current evidence only supports a count field.

## Risks / Trade-offs

- Non-public endpoint shape changes → Keep parsing optional and omit the segment when data is missing.
- `null` may mean ineligible, unavailable, or rollout incomplete → Do not surface a misleading status; omit the segment.
- Compact `R<n>` may be terse → It matches the existing footer style and avoids expanding the status line.
- Accent styling can draw attention → Apply it only when resets are actually available; keep `R0` dim.
