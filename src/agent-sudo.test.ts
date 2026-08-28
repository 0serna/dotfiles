import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const agentSudoPath = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "dotfiles/bin/agent-sudo",
);

function createMockBin(dialogExit = 0) {
  const binDir = mkdtempSync(join(tmpdir(), "agent-sudo-mock-"));
  const sudoLog = join(binDir, "sudo.log");

  writeFileSync(
    join(binDir, "zenity"),
    `#!/usr/bin/env bash
[[ " $* " == *" --password "* ]] || exit 1
if [[ ${dialogExit} -ne 0 ]]; then exit ${dialogExit}; fi
printf '%s\\n' secret
`,
  );

  writeFileSync(
    join(binDir, "sudo"),
    `#!/usr/bin/env bash
password=$(head -n1)
{
  echo "args:$*"
  echo "password:$password"
} >> "${sudoLog}"
`,
  );

  chmodSync(join(binDir, "zenity"), 0o755);
  chmodSync(join(binDir, "sudo"), 0o755);

  return { binDir, sudoLog };
}

function runAgentSudo(args: string[], binDir: string) {
  return spawnSync(agentSudoPath, args, {
    encoding: "utf-8",
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
  });
}

describe("agent-sudo", () => {
  it("fails with a clear usage error when no reason is provided", () => {
    const { binDir } = createMockBin();
    const result = runAgentSudo([], binDir);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing reason");
  });

  it("does not call sudo when the dialog is cancelled", () => {
    const { binDir, sudoLog } = createMockBin(1);
    const result = runAgentSudo(["install jq", "true"], binDir);

    expect(result.status).toBe(1);
    expect(existsSync(sudoLog)).toBe(false);
  });

  it("passes the password to sudo -S in a single dialog step", () => {
    const { binDir, sudoLog } = createMockBin();
    const result = runAgentSudo(["install jq", "true"], binDir);

    expect(result.status).toBe(0);
    const log = readFileSync(sudoLog, "utf-8");
    expect(log).toContain("args:-S true");
    expect(log).toContain("password:secret");
  });
});
