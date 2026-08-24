# Quality baseline without an aggregate check script

`quality-baseline` establishes a **quality baseline** as individual runner targets, a pre-commit auto-fix hook, and GitHub Actions (`.github/workflows/ci.yml` when creating CI). It skips aggregate scripts such as `npm run check`. Full verification is invoking those targets, or CI running the same list. Pre-commit stays format → auto-fix → re-stage so commits stay fast and hard to skip.

## Considered options

- **Aggregate `check` script + CI calls it.** Rejected: other skills already drifted toward inventing `npm run check`; one entrypoint hides which piece failed and fights the "individual commands in the runner" audit model.
- **CI-only baseline, no workflow writing in the skill.** Rejected: the skill already said full checks belong in CI while never materializing CI, so repos finished the local half and left the remote half empty.
- **Multi-CI writers (Actions + GitLab + …).** Deferred: detect other platforms and document commands; only Actions is written in v1.
