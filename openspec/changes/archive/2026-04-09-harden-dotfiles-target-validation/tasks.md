## 1. Safety validation

- [x] 1.1 Add tests that reject `target: "~"` and `target: "~/"`
- [x] 1.2 Add tests that reject targets resolving inside the repository
- [x] 1.3 Add tests that keep `~/.config/...` targets working

## 2. Installer hardening

- [x] 2.1 Validate resolved targets before any filesystem removal
- [x] 2.2 Reject targets that resolve to the home directory root
- [x] 2.3 Reject targets that resolve inside the repository tree

## 3. Verification

- [x] 3.1 Run the test suite and typecheck to confirm the safety checks and existing behavior still pass
