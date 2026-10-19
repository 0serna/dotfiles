import { execFileSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/link-main.sh");

let tmpDir: string;

describe("link-main.sh", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "link-main-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("runs the installer from the main worktree", async () => {
    const repoDir = path.join(tmpDir, "repo");
    const worktreeDir = path.join(tmpDir, "worktree");
    const fakeTsxPath = path.join(repoDir, "node_modules", ".bin", "tsx");

    await fs.mkdir(path.join(repoDir, "scripts"), { recursive: true });
    await fs.copyFile(
      scriptPath,
      path.join(repoDir, "scripts", "link-main.sh"),
    );
    await fs.mkdir(path.dirname(fakeTsxPath), { recursive: true });
    await fs.writeFile(
      fakeTsxPath,
      "#!/usr/bin/env sh\nprintf '%s\\n' \"$*\"\npwd\n",
      { mode: 0o755 },
    );

    execFileSync("git", ["init", "-q"], { cwd: repoDir });
    execFileSync("git", ["add", "."], { cwd: repoDir });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-q",
        "-m",
        "init",
      ],
      { cwd: repoDir },
    );
    execFileSync("git", ["worktree", "add", "-q", worktreeDir], {
      cwd: repoDir,
    });

    const output = execFileSync(
      "sh",
      [path.join(worktreeDir, "scripts", "link-main.sh")],
      { encoding: "utf-8" },
    );

    expect(output.trim()).toBe(
      `src/installer/dotfiles-installer.ts\n${repoDir}`,
    );
  });

  it("explains when the main checkout has no dependencies", async () => {
    const repoDir = path.join(tmpDir, "repo");

    await fs.mkdir(path.join(repoDir, "scripts"), { recursive: true });
    await fs.copyFile(
      scriptPath,
      path.join(repoDir, "scripts", "link-main.sh"),
    );
    execFileSync("git", ["init", "-q"], { cwd: repoDir });

    const result = spawnSync(
      "sh",
      [path.join(repoDir, "scripts", "link-main.sh")],
      { encoding: "utf-8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Missing tsx in ${repoDir}`);
    expect(result.stderr).toContain("npm install");
  });
});
