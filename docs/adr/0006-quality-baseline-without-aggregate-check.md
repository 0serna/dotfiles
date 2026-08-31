# Quality baseline without a multi-tool aggregate script

`quality-baseline` establishes a **quality baseline** as individual runner targets, a pre-commit auto-fix hook, and GitHub Actions (`.github/workflows/ci.yml` when creating CI). Full verification is invoking those targets, or CI running the same list. Pre-commit stays format → auto-fix → re-stage so commits stay fast and hard to skip.

A single analyzer may own multiple concerns in one command — for example `biome check` covers format, lint, and import organization. That is still one auditable target. What stays out is a meta-script that wraps several tools (`format` + `lint` + `typecheck` in one `npm run check`), because it hides which tool failed.

## Considered options

- **Aggregate `check` script that runs multiple tools.** Rejected: one entrypoint hides which piece failed and fights the "individual commands in the runner" audit model.
- **Separate `format`, `format:check`, and `lint` when Biome already covers all three.** Rejected for Node/TS repos on Biome: extra scripts without extra signal.
- **CI-only baseline, no workflow writing in the skill.** Rejected: the skill already said full checks belong in CI while never materializing CI, so repos finished the local half and left the remote half empty.
- **Multi-CI writers (Actions + GitLab + …).** Deferred: detect other platforms and document commands; only Actions is written in v1.
