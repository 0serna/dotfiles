## Context

The extension currently separates route declarations from route configuration: `routes.ts` maps each token to `cheap` or `auxiliar`, while `profiles.json` stores the two shared model routes. Runtime validity is global, so one missing or unusable shared route disables every routed command. The `/profile` editor exposes the shared categories rather than the commands users intend to configure.

The extension also owns manual model/thinking preference persistence. That concern remains separate and retains its current lifecycle. `/compact` remains special because Pi emits `session_before_compact` instead of an `input` event, but it participates in the same editable route catalog.

## Goals / Non-Goals

**Goals:**

- Make each declared token an independently configurable model route.
- Show the declared tokens directly in a renamed `/model-routes` editor.
- Permit partial configuration and isolate absent or unusable routes.
- Keep persisted state canonical by omitting unset routes and removing undeclared entries.
- Preserve temporary routing, manual-selection restoration, and compaction fallback semantics.
- Remove profile terminology and legacy route-schema code.

**Non-Goals:**

- Reusable route groups, aliases, or stable IDs separate from visible tokens.
- Runtime migration from `profiles.json` or a `/profile` compatibility alias.
- Separating manual and automatic compaction configuration.
- Changing `manual-preferences.json` or selection-transition behavior.

## Decisions

### Persist configuration by route token

Use a partial record keyed directly by declared tokens, with each value containing `model` and `thinkingLevel`. Missing keys mean `[unset]`. The visible token is both route identity and persisted key, avoiding another indirection layer. Renaming a token therefore retires the old route and introduces a new unset route.

Alternative: stable internal route IDs. Rejected because they recreate indirection without a demonstrated need.

### Keep a simple declared-token catalog

The code-owned catalog lists route tokens in UI order. Input routes are matched by their first input token. `/compact` remains a literal special case handled by `session_before_compact`; it is not assigned an additional trigger-kind abstraction.

Alternative: metadata declaring `input` or `compaction`. Rejected as unnecessary for the single special route.

### Validate and activate routes independently

Loading produces a usable configuration catalog rather than one global valid/invalid result. Missing or unusable entries do not disable valid entries. Invoking an unusable input route warns and continues with the active model; unusable compact routing warns and allows Pi's native compaction.

A parseable catalog is sanitized at session start and rewritten when its canonical representation changes:

- undeclared keys are removed;
- malformed values, unknown models, and unsupported thinking levels become unset;
- routes whose known model only lacks credentials are retained because credential availability can be transient.

An unreadable or unparsable file is never overwritten automatically. Routing is disabled and the user is warned so the original evidence remains recoverable.

### Keep editing partial and explicit

`/model-routes` lists every declared token. Editing selects an available model and then one of that model's supported thinking levels. The user can explicitly unset a route, and saving is allowed with any number of unset routes. Saving writes only configured declared routes and never activates one.

### Rename the capability without compatibility shims

Move the extension directory to `model-routing`, register only `/model-routes`, and store automatic route configuration in `model-routes.json`. Keep `manual-preferences.json` unchanged because its name and domain remain accurate.

No runtime code reads `profiles.json`, understands `cheap`/`auxiliar`, or registers `/profile`.

## Risks / Trade-offs

- [Renaming a route loses its association] → Treat token changes explicitly as remove/add and expose the new token as unset.
- [Startup sanitization could destroy transiently unavailable configuration] → Retain known models when only authentication is unavailable; do not overwrite unreadable files.
- [Partial configuration can route some commands but not others] → Show `[unset]` clearly and warn only when an unusable route is invoked.
- [Breaking command, path, and schema changes disrupt existing installations] → Perform one explicit manual local migration and verify the new file before deleting the old one.
- [`/compact` remains a code special case] → Keep the special handling localized to the compaction hook and cover it with focused tests.

## Migration Plan

1. Move the extension source from `profiles/` to `model-routing/` and switch runtime state to `model-routes.json`.
2. Manually create `model-routes.json` by expanding each current `cheap` or `auxiliar` value onto every token mapped to that category.
3. Validate the new file and run the extension test and repository quality suites.
4. Remove the old `profiles.json` only after the new configuration is verified.
5. Roll back by restoring the previous extension directory and retained old file before step 4, or by reconstructing `profiles.json` from the known two previous values afterward.

## Open Questions

None.
