## 1. Profile List Navigation

- [x] 1.1 Update the profile list result/action model so `Enter` returns an edit action and activation is represented by an explicit activation action.
- [x] 1.2 Add `Space` key handling in the profile list for activation when configuration is valid.
- [x] 1.3 Handle `Space` when configuration is missing or invalid by returning no activation attempt and showing a concise warning.
- [x] 1.4 Update command handling so activation still persists the selected active profile, activates its low route, publishes status, and shows concise success feedback only on successful explicit activation.

## 2. Profile List Text and Status

- [x] 2.1 Replace per-profile setup/repair row tags with a single global contextual status line for valid, missing, and invalid configuration states.
- [x] 2.2 Update profile row labels to show only the profile name and active marker when applicable.
- [x] 2.3 Update profile-list key hints so valid configuration shows `Enter edit • Space activate • Esc close` and missing/invalid configuration shows only edit and close actions.

## 3. Route Editor Text and Prompts

- [x] 3.1 Update the route editor heading and guidance to compact English wording for configuring the selected profile.
- [x] 3.2 Update route editor key hints so `Esc` explicitly communicates save-and-return behavior.
- [x] 3.3 Update incomplete-save warning text to be concise and list routes that must be completed.
- [x] 3.4 Update model and thinking selection prompts while preserving the existing `model -> thinking` sequence.

## 4. Verification

- [x] 4.1 Run the relevant automated checks for the repository.
- [x] 4.2 Validate the OpenSpec change for `improve-profiles-flow`.
- [x] 4.3 Manually review the resulting `/profiles` flow against the accepted decisions: edit-first list, explicit activation, global status messaging, compact English text, and unchanged routing/persistence semantics.
