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

async function install(repoDir: string, homeDir: string) {
  return new DotfilesInstaller(repoDir, homeDir).install();
}

async function expectSymlink(filePath: string) {
  expect((await fs.lstat(filePath)).isSymbolicLink()).toBe(true);
}

async function expectDirectory(filePath: string) {
  expect((await fs.lstat(filePath)).isDirectory()).toBe(true);
}

async function writeOpenCodeConfig(repoDir: string) {
  const configPath = path.join(
    repoDir,
    "dotfiles",
    "opencode",
    "opencode.jsonc",
  );

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, "config");
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

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(path.join(homeDir, ".config", "opencode"));
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

  it("replaces an existing parent symlink before linking granular entries", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/opencode/opencode.jsonc": "config",
        "dotfiles/opencode/commands/example.md": "command",
      },
      [
        {
          source: "dotfiles/opencode/opencode.jsonc",
          target: "~/.config/opencode/opencode.jsonc",
        },
        {
          source: "dotfiles/opencode/commands",
          target: "~/.config/opencode/commands",
        },
      ],
    );
    const opencodeTarget = path.join(homeDir, ".config", "opencode");
    const opencodeSource = path.join(repoDir, "dotfiles", "opencode");
    await fs.mkdir(path.dirname(opencodeTarget), { recursive: true });
    await fs.symlink(opencodeSource, opencodeTarget, "dir");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectDirectory(opencodeTarget);
    await expectSymlink(path.join(opencodeTarget, "opencode.jsonc"));
    await expectSymlink(path.join(opencodeTarget, "commands"));
    expect(
      await fs.readFile(path.join(opencodeTarget, "opencode.jsonc"), "utf-8"),
    ).toBe("config");
  });

  it("migrates a repo-backed parent symlink when the checkout path is symlinked", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/opencode/opencode.jsonc": "config",
      },
      [
        {
          source: "dotfiles/opencode/opencode.jsonc",
          target: "~/.config/opencode/opencode.jsonc",
        },
      ],
    );
    const linkedRepoDir = path.join(tmpDir, "repo-link");
    const opencodeTarget = path.join(homeDir, ".config", "opencode");
    await fs.symlink(repoDir, linkedRepoDir, "dir");
    await fs.mkdir(path.dirname(opencodeTarget), { recursive: true });
    await fs.symlink(
      path.join(repoDir, "dotfiles", "opencode"),
      opencodeTarget,
      "dir",
    );

    const success = await install(linkedRepoDir, homeDir);

    expect(success).toBe(true);
    await expectDirectory(opencodeTarget);
    await expectSymlink(path.join(opencodeTarget, "opencode.jsonc"));
  });

  it("preserves a symlinked ancestor while linking granular entries", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/opencode.jsonc": "config" },
      [
        {
          source: "dotfiles/opencode/opencode.jsonc",
          target: "~/.config/opencode/opencode.jsonc",
        },
      ],
    );
    const configSource = path.join(tmpDir, "external-config");
    const configTarget = path.join(homeDir, ".config");
    await fs.mkdir(configSource, { recursive: true });
    await fs.symlink(configSource, configTarget, "dir");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(configTarget);
    await expectSymlink(path.join(configSource, "opencode", "opencode.jsonc"));
    expect(
      await fs.readFile(
        path.join(configTarget, "opencode", "opencode.jsonc"),
        "utf-8",
      ),
    ).toBe("config");
  });

  it("rejects an immediate parent symlink outside the repository", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/opencode.jsonc": "config" },
      [
        {
          source: "dotfiles/opencode/opencode.jsonc",
          target: "~/.config/opencode/opencode.jsonc",
        },
      ],
    );
    const externalOpencode = path.join(tmpDir, "external-opencode");
    const opencodeTarget = path.join(homeDir, ".config", "opencode");
    await fs.mkdir(externalOpencode, { recursive: true });
    await fs.mkdir(path.dirname(opencodeTarget), { recursive: true });
    await fs.symlink(externalOpencode, opencodeTarget, "dir");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
    await expectSymlink(opencodeTarget);
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

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
  });

  it.each(["~", "~/"])("rejects home root target %s", async (target) => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/opencode/opencode.jsonc": "config" },
      [{ source: "dotfiles/opencode/opencode.jsonc", target }],
    );

    await fs.writeFile(path.join(homeDir, "keep.txt"), "keep");

    const success = await install(repoDir, homeDir);

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

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(
      path.join(homeDir, ".config", "opencode", "nested", "tui.jsonc"),
    );
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "opencode", "nested", "tui.jsonc"),
        "utf-8",
      ),
    ).toBe("theme");
  });

  it("rejects targets inside the repository", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    await writeOpenCodeConfig(repoDir);

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

    const success = await install(repoDir, homeDir);

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

    await writeOpenCodeConfig(repoDir);

    const targetPath = path.join(repoDir, "..foo", "config.jsonc");
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, "old");

    await writeManifest(repoDir, [
      {
        source: "dotfiles/opencode/opencode.jsonc",
        target: targetPath,
      },
    ]);

    const success = await install(repoDir, homeDir);

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

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(path.join(targetPath, "opencode.jsonc"));
    expect(
      await fs.readFile(path.join(targetPath, "opencode.jsonc"), "utf-8"),
    ).toBe("new");
  });

  it("fails when the manifest is missing", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
  });
});
