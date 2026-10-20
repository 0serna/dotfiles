import { execFileSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/link-main.sh");

// Git hooks export these variables. They would redirect the test's git calls
// to the repository that runs the tests.
const gitEnv = { ...process.env };
delete gitEnv.GIT_DIR;
delete gitEnv.GIT_WORK_TREE;
delete gitEnv.GIT_INDEX_FILE;
delete gitEnv.GIT_COMMON_DIR;

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

    execFileSync("git", ["init", "-q"], { cwd: repoDir, env: gitEnv });
    execFileSync("git", ["add", "."], { cwd: repoDir, env: gitEnv });
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
      { cwd: repoDir, env: gitEnv },
    );
    execFileSync("git", ["worktree", "add", "-q", worktreeDir], {
      cwd: repoDir,
      env: gitEnv,
    });

    const output = execFileSync(
      "sh",
      [path.join(worktreeDir, "scripts", "link-main.sh")],
      { encoding: "utf-8", env: gitEnv },
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
    execFileSync("git", ["init", "-q"], { cwd: repoDir, env: gitEnv });

    const result = spawnSync(
      "sh",
      [path.join(repoDir, "scripts", "link-main.sh")],
      { encoding: "utf-8", env: gitEnv },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Missing tsx in ${repoDir}`);
    expect(result.stderr).toContain("npm install");
  });
});
