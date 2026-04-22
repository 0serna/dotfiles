import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DotfilesInstaller } from "./dotfiles-installer";

let tmpDir: string;

async function createWorkspace() {
  const repoDir = path.join(tmpDir, "repo");
  const homeDir = path.join(tmpDir, "home");

  await fs.mkdir(repoDir, { recursive: true });
  await fs.mkdir(homeDir, { recursive: true });

  return { repoDir, homeDir };
}

async function writeManifest(repoDir: string, manifest: unknown) {
  await fs.writeFile(
    path.join(repoDir, "dotfiles.json"),
    JSON.stringify(manifest, null, 2),
  );
}

async function createRepo(files: Record<string, string>, manifest: unknown) {
  const { repoDir, homeDir } = await createWorkspace();

  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(repoDir, filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }

  await writeManifest(repoDir, manifest);

  return { repoDir, homeDir };
}

describe("DotfilesInstaller", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("links the declared OpenCode directory", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/opencode/opencode.jsonc": "config",
        "dotfiles/opencode/commands/example.md": "content",
      },
      [
        {
          source: "dotfiles/opencode",
          target: "~/.config/opencode",
        },
      ],
    );

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(true);
    expect(
      (
        await fs.lstat(path.join(homeDir, ".config", "opencode"))
      ).isSymbolicLink(),
    ).toBe(true);
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "opencode", "opencode.jsonc"),
        "utf-8",
      ),
    ).toBe("config");
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "opencode", "commands", "example.md"),
        "utf-8",
      ),
    ).toBe("content");
  });

  it("rejects sources that escape the repository", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/opencode.jsonc": "config" },
      [
        {
          source: "../secret.txt",
          target: "~/.config/opencode/secret.txt",
        },
      ],
    );

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(false);
  });

  it.each(["~", "~/"])("rejects home root target %s", async (target) => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/opencode.jsonc": "config" },
      [{ source: "dotfiles/opencode/opencode.jsonc", target }],
    );

    await fs.writeFile(path.join(homeDir, "keep.txt"), "keep");

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(false);
    expect(await fs.readFile(path.join(homeDir, "keep.txt"), "utf-8")).toBe(
      "keep",
    );
  });

  it("creates parent directories and expands home targets", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/tui.jsonc": "theme" },
      [
        {
          source: "dotfiles/opencode/tui.jsonc",
          target: "~/.config/opencode/nested/tui.jsonc",
        },
      ],
    );

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(true);
    expect(
      (
        await fs.lstat(
          path.join(homeDir, ".config", "opencode", "nested", "tui.jsonc"),
        )
      ).isSymbolicLink(),
    ).toBe(true);
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "opencode", "nested", "tui.jsonc"),
        "utf-8",
      ),
    ).toBe("theme");
  });

  it("rejects targets inside the repository", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    await fs.mkdir(path.join(repoDir, "dotfiles", "opencode"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(repoDir, "dotfiles", "opencode", "opencode.jsonc"),
      "config",
    );

    await writeManifest(repoDir, [
      {
        source: "dotfiles/opencode/opencode.jsonc",
        target: path.join(repoDir, "repo-target", "config.jsonc"),
      },
    ]);

    await fs.mkdir(path.join(repoDir, "repo-target"), { recursive: true });
    await fs.writeFile(
      path.join(repoDir, "repo-target", "config.jsonc"),
      "old",
    );

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(false);
    expect(
      await fs.readFile(
        path.join(repoDir, "repo-target", "config.jsonc"),
        "utf-8",
      ),
    ).toBe("old");
  });

  it("rejects literal dot-prefixed segments inside the repository", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    await fs.mkdir(path.join(repoDir, "dotfiles", "opencode"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(repoDir, "dotfiles", "opencode", "opencode.jsonc"),
      "config",
    );

    const targetPath = path.join(repoDir, "..foo", "config.jsonc");
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, "old");

    await writeManifest(repoDir, [
      {
        source: "dotfiles/opencode/opencode.jsonc",
        target: targetPath,
      },
    ]);

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(false);
    expect(await fs.readFile(targetPath, "utf-8")).toBe("old");
  });

  it("replaces existing targets", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/opencode.jsonc": "new" },
      [
        {
          source: "dotfiles/opencode/opencode.jsonc",
          target: "~/.config/opencode/opencode.jsonc",
        },
      ],
    );

    const targetPath = path.join(homeDir, ".config", "opencode");
    await fs.mkdir(targetPath, { recursive: true });
    await fs.writeFile(path.join(targetPath, "opencode.jsonc"), "old");

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(true);
    expect(
      (
        await fs.lstat(path.join(targetPath, "opencode.jsonc"))
      ).isSymbolicLink(),
    ).toBe(true);
    expect(
      await fs.readFile(path.join(targetPath, "opencode.jsonc"), "utf-8"),
    ).toBe("new");
  });

  it("fails when the manifest is missing", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    const installer = new DotfilesInstaller(repoDir, homeDir);
    const success = await installer.install();

    expect(success).toBe(false);
  });
});
