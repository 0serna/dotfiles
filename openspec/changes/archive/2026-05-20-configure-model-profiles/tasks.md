## 1. State Model and Validation

- [x] 1.1 Replace active-profile-only persisted state with full profile configuration state.
- [x] 1.2 Add schema parsing that distinguishes missing, invalid, and valid configuration states.
- [x] 1.3 Validate fixed profiles and fixed routes are complete before enabling routing.
- [x] 1.4 Resolve configured model IDs against `ctx.modelRegistry.getAvailable()`.
- [x] 1.5 Validate configured thinking levels against each route model's supported levels via `getSupportedThinkingLevels(model)`.
- [x] 1.6 Track disabled-routing state and the warning-once-per-session flag.

## 2. Routing Behavior

- [x] 2.1 Skip session-start default activation when configuration is missing or invalid.
- [x] 2.2 Skip slash-command temporary routing when configuration is missing or invalid.
- [x] 2.3 Skip post-route default restore when configuration is missing or invalid.
- [x] 2.4 Use persisted valid profile configuration for default, light, and heavy routes.
- [x] 2.5 Preserve profile activation behavior by applying the selected profile default immediately.
- [x] 2.6 Emit missing/invalid configuration warnings once per session.
- [x] 2.7 Publish `model-profile` footer status for valid, setup, invalid, and failed states.
- [x] 2.8 Keep model-profile status unchanged during temporary slash-command routing.

## 3. Profile Manager TUI

- [x] 3.1 Replace the simple `/model-profile` selector with a custom TUI that visually follows Pi select styling.
- [x] 3.2 Show fixed profiles with the active profile visually marked.
- [x] 3.3 Support Enter to activate the selected profile and Space to edit the selected profile.
- [x] 3.4 Implement profile editing for `default`, `light`, and `heavy` route model/thinking fields.
- [x] 3.5 Source model choices from Pi's available model list.
- [x] 3.6 Source thinking-level choices from the selected model's supported thinking levels.
- [x] 3.7 Show profile status, keyboard legends, and route editor framing in the custom TUI.
- [x] 3.8 Avoid warning notifications when `/model-profile` opens in setup or repair mode; rely on TUI state instead.

## 4. Setup and Repair Flows

- [x] 4.1 Open `/model-profile` in setup mode when configuration is missing.
- [x] 4.2 Show fixed profiles and routes with `[unset]` values in setup mode.
- [x] 4.3 Open `/model-profile` in repair mode when configuration is invalid.
- [x] 4.4 Show recoverable invalid configuration values and visibly mark invalid or missing fields.
- [x] 4.5 Prevent saving incomplete or invalid drafts.
- [x] 4.6 Persist the draft only when the full configuration is complete and valid.
- [x] 4.7 Refresh the active profile default after saving edits to the active profile.
- [x] 4.8 Save edits to inactive profiles without changing the active profile or current model.
- [x] 4.9 Suppress informational notifications for successful profile activation and save; update footer status instead.

## 5. Verification

- [x] 5.1 Run TypeScript checking for the extension changes.
- [x] 5.2 Run the repository quality gate.
- [x] 5.3 Manually verify missing, invalid, setup, repair, activate, and edit/save profile flows in Pi if available.
