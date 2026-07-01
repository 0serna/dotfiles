import { describe, expect, it } from "vitest";
import { findSensitiveMatch } from "../patterns.ts";

// ---------------------------------------------------------------------------
// shell -c pattern
// ---------------------------------------------------------------------------

describe("shell -c pattern", () => {
  it("does not trigger on find -exec sh -c with quoted content", () => {
    const cmd =
      "find openspec/specs -maxdepth 2 -type f -name 'spec.md' -print -exec sh -c 'echo --- $1; head -80 \"$1\"' sh {} \\;";
    expect(findSensitiveMatch(cmd)).toBeNull();
  });

  it("does not trigger on find -exec sh -c with head/sed", () => {
    const cmd =
      "find node_modules/@serwist/next -type f -name '*.d.ts' -maxdepth 4 -print -exec sh -c 'echo --- $1; head -120 $1' sh {} \\; | head -240";
    expect(findSensitiveMatch(cmd)).toBeNull();
  });

  it("does not trigger on bash -c with fully quoted content", () => {
    // After preprocessing, content between quotes is removed → no code visible
    const cmd = 'bash -c "rm -rf /tmp/test"';
    expect(findSensitiveMatch(cmd)).toBeNull();
  });

  it("triggers on sh -c with variable reference", () => {
    const cmd = "sh -c $malicious_var";
    expect(findSensitiveMatch(cmd)).not.toBeNull();
  });

  it("triggers on bash -c with unquoted code", () => {
    const cmd = "bash -c rm -rf /tmp/test";
    expect(findSensitiveMatch(cmd)).not.toBeNull();
  });

  it("triggers on sh -c with semicolon-separated commands", () => {
    const cmd = "sh -c 'echo hello'; rm -rf /";
    expect(findSensitiveMatch(cmd)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dd pattern
// ---------------------------------------------------------------------------

describe("dd pattern", () => {
  it("does not trigger on dd as substring in variable name", () => {
    const cmd = "echo $dd_status";
    expect(findSensitiveMatch(cmd)).toBeNull();
  });

  it("does not trigger on dd as substring in path", () => {
    const cmd = "ls /home/user/addons";
    expect(findSensitiveMatch(cmd)).toBeNull();
  });

  it("triggers on dd with of=/dev/", () => {
    const cmd = "dd if=/dev/zero of=/dev/sda bs=1M";
    expect(findSensitiveMatch(cmd)).not.toBeNull();
  });

  it("triggers on dd with if=/dev/", () => {
    const cmd = "dd if=/dev/sda of=/tmp/backup.img";
    expect(findSensitiveMatch(cmd)).not.toBeNull();
  });
});
