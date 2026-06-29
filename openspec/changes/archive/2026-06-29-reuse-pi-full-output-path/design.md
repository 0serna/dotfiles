## Context

The context extension prunes eligible `toolResult` messages by replacing their text with a compact DCP stub and saving recoverable content under `/tmp/pi-dcp/<sessionId>/`. Pi's built-in `bash` tool already truncates very large command output at execution time and includes a textual marker such as `Full output: /tmp/pi-bash-<id>.log` when the complete output was written to a temp file.

When DCP later prunes that already-truncated result, creating a DCP-owned copy preserves only the truncated context text plus the marker. The agent must then discover the Pi full-output path by first opening the DCP file. Reusing the existing full-output path makes the DCP stub a direct recovery pointer.

## Goals / Non-Goals

**Goals:**

- Prefer an existing Pi bash `Full output:` recovery path when DCP prunes a bash result that contains one.
- Fall back to DCP-owned externalization when no reusable full-output path is available.
- Preserve the current pruning policy, token threshold, age gate, and non-saving-stub guard.
- Keep DCP-owned file permissions private while leaving reused files unchanged.

**Non-Goals:**

- Do not change Pi's built-in truncation behavior or temp-file naming.
- Do not harden permissions on files created by Pi.
- Do not introduce a broad artifact registry or cleanup system.
- Do not require `saved=` to always identify a byte-for-byte copy of the exact replaced text.

## Decisions

1. **Treat `saved=` as the best recovery path.**
   - DCP stubs should point to the most useful available source for recovering pruned content.
   - Alternative considered: always point to a DCP-owned copy of the exact replaced text. Rejected because it preserves a less useful truncated copy when Pi's full output is already available.

2. **Detect reusable paths from Pi bash `Full output:` markers.**
   - The implementation scans candidate bash text for a `Full output: <path>` marker, extracts paths from Pi's bracketed marker format, and verifies that the referenced `/tmp/pi-bash-*.log` file is readable before reuse.
   - Alternative considered: use structured tool-result metadata. Rejected for now because the context extension receives textual message content consistently, while metadata shape may vary by message source.
   - Alternative considered: reuse any existing path from any textual tool. Rejected because this feature targets Pi bash truncation files specifically.

3. **Do not modify permissions on reused files.**
   - DCP-owned files remain `0600` under `0700` directories.
   - Reused Pi files retain permissions assigned by Pi and the process umask.
   - Alternative considered: `chmod 0600` reused files. Rejected by user preference to avoid mutating files outside DCP ownership.

4. **Keep `.txt` for DCP-owned files.**
   - DCP externalizes generic textual tool results, not just logs.
   - Reused files keep their original extension, commonly `.log` for Pi bash output.

## Risks / Trade-offs

- **Marker format drift** → If Pi changes the `Full output:` wording, DCP may fall back to DCP-owned externalization.
- **Less strict `saved=` semantics** → `saved=` may identify a fuller recovery source rather than the exact replaced text; tests and specs should reflect this explicitly.
- **Inherited permissions** → Reused Pi files may not have DCP's private permissions; this is accepted because DCP will not mutate reused files.
- **Marker false positives** → DCP constrains reuse to bash results and readable `/tmp/pi-bash-*.log` paths so non-Pi bash markers fall back to DCP-owned files.
