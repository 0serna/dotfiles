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
  fileURLToPath(new URL("../..", import.meta.url)),
  "dotfiles/bin/agent-sudo",
);

function createMockBin({
  dialogExit = 0,
  cached = false,
  sudoersPresent = true,
}: {
  dialogExit?: number;
  cached?: boolean;
  sudoersPresent?: boolean;
} = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "agent-sudo-mock-"));
  const sudoLog = join(binDir, "sudo.log");
  const zenityLog = join(binDir, "zenity.log");
  const cacheFile = join(binDir, "sudo.cache");
  const sudoersFile = join(binDir, "sudoers");

  if (cached) {
    writeFileSync(cacheFile, "");
  }
  if (sudoersPresent) {
    writeFileSync(sudoersFile, "Defaults timestamp_type=global\n");
  }

  writeFileSync(
    join(binDir, "zenity"),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" > "${zenityLog}"
[[ " $* " == *" --hide-text "* ]] || exit 1
if [[ ${dialogExit} -ne 0 ]]; then exit ${dialogExit}; fi
printf '%s\\n' secret
`,
  );

  writeFileSync(
    join(binDir, "sudo"),
    `#!/usr/bin/env bash
if [[ "\${1:-}" == "-n" ]]; then
  [[ -f "${cacheFile}" ]] && exit 0
  exit 1
fi
if [[ "\${1:-}" == "-S" ]]; then
  password=$(head -n1)
  touch "${cacheFile}"
  {
    echo "args:$*"
    echo "password:$password"
  } >> "${sudoLog}"
  exit 0
fi
{
  echo "args:$*"
  echo "password:"
} >> "${sudoLog}"
`,
  );

  chmodSync(join(binDir, "zenity"), 0o755);
  chmodSync(join(binDir, "sudo"), 0o755);

  return { binDir, sudoLog, zenityLog, sudoersFile };
}

function runAgentSudo(args: string[], binDir: string, sudoersFile: string) {
  return spawnSync(agentSudoPath, args, {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      AGENT_SUDO_SUDOERS: sudoersFile,
    },
  });
}

describe("agent-sudo", () => {
  it("fails with a clear usage error when no reason is provided", () => {
    const { binDir, sudoersFile } = createMockBin();
    const result = runAgentSudo([], binDir, sudoersFile);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing reason");
  });

  it("does not call sudo when the dialog is cancelled", () => {
    const { binDir, sudoLog, sudoersFile } = createMockBin({
      dialogExit: 1,
    });
    const result = runAgentSudo(["install jq", "true"], binDir, sudoersFile);

    expect(result.status).toBe(1);
    expect(existsSync(sudoLog)).toBe(false);
  });

  it("shows the reason as the dialog text", () => {
    const { binDir, zenityLog, sudoersFile } = createMockBin();
    runAgentSudo(["install jq for JSON parsing", "true"], binDir, sudoersFile);

    expect(readFileSync(zenityLog, "utf-8")).toContain(
      "--text=install jq for JSON parsing",
    );
  });

  it("passes the password to sudo -S in a single dialog step", () => {
    const { binDir, sudoLog, sudoersFile } = createMockBin();
    const result = runAgentSudo(["install jq", "true"], binDir, sudoersFile);

    expect(result.status).toBe(0);
    const log = readFileSync(sudoLog, "utf-8");
    expect(log).toContain("args:-S true");
    expect(log).toContain("password:secret");
  });

  it("skips the dialog when sudo is already authorized", () => {
    const { binDir, sudoLog, zenityLog, sudoersFile } = createMockBin({
      cached: true,
    });
    const result = runAgentSudo(["install jq", "true"], binDir, sudoersFile);

    expect(result.status).toBe(0);
    expect(existsSync(zenityLog)).toBe(false);
    expect(readFileSync(sudoLog, "utf-8")).toContain("args:true");
  });

  it("installs shared timestamps before the command when missing", () => {
    const { binDir, sudoLog, sudoersFile } = createMockBin({
      sudoersPresent: false,
    });
    const result = runAgentSudo(["install jq", "true"], binDir, sudoersFile);

    expect(result.status).toBe(0);
    const log = readFileSync(sudoLog, "utf-8");
    expect(log).toContain("install -m 440");
    expect(log).toContain(sudoersFile);
    expect(log).toContain("args:-S true");
  });
});
