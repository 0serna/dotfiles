import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoDir = fileURLToPath(new URL("..", import.meta.url));
const agentSudoPath = join(repoDir, "dotfiles/bin/agent-sudo");

type MockBin = {
  binDir: string;
  sudoLog: string;
};

function createMockBin(dialogExit = "0"): MockBin {
  const binDir = mkdtempSync(join(tmpdir(), "agent-sudo-mock-"));
  const sudoLog = join(binDir, "sudo.log");

  writeFileSync(
    join(binDir, "zenity"),
    `#!/usr/bin/env bash
set -euo pipefail
for arg in "$@"; do
  if [[ "$arg" == "--password" ]]; then
    if [[ ${dialogExit} -ne 0 ]]; then
      exit ${dialogExit}
    fi
    printf '%s\\n' "\${ZENITY_PASSWORD:-secret}"
    exit 0
  fi
done
exit 1
`,
  );

  writeFileSync(
    join(binDir, "sudo"),
    `#!/usr/bin/env bash
set -euo pipefail
password=$(head -n1)
{
  echo "args:$*"
  echo "password:$password"
} >> "${sudoLog}"
exit 0
`,
  );

  chmodSync(join(binDir, "zenity"), 0o755);
  chmodSync(join(binDir, "sudo"), 0o755);

  return { binDir, sudoLog };
}

function runAgentSudo(
  args: string[],
  mockBin: MockBin,
  env: Record<string, string> = {},
) {
  return spawnSync(agentSudoPath, args, {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${mockBin.binDir}:${process.env.PATH ?? ""}`,
      ...env,
    },
  });
}

describe("agent-sudo", () => {
  it("is executable", async () => {
    const { access, constants } = await import("node:fs/promises");
    await expect(
      access(agentSudoPath, constants.X_OK),
    ).resolves.toBeUndefined();
  });

  it("fails with a clear usage error when no reason is provided", () => {
    const mockBin = createMockBin();
    const result = runAgentSudo([], mockBin);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing reason");
  });

  it("does not call sudo when the dialog is cancelled", () => {
    const mockBin = createMockBin("1");
    const result = runAgentSudo(["install jq", "true"], mockBin);

    expect(result.status).toBe(1);
    expect(() => readFileSync(mockBin.sudoLog, "utf-8")).toThrow();
  });

  it("passes the password to sudo -S in a single dialog step", () => {
    const mockBin = createMockBin("0");
    const result = runAgentSudo(["install jq", "true"], mockBin, {
      ZENITY_PASSWORD: "hunter2",
    });

    expect(result.status).toBe(0);
    const log = readFileSync(mockBin.sudoLog, "utf-8");
    expect(log).toContain("args:-S true");
    expect(log).toContain("password:hunter2");
  });
});
