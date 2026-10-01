import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DotfilesInstaller } from "./dotfiles-installer";
import { readManifest } from "./manifest.ts";

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

async function writeConfigFile(repoDir: string) {
  const configPath = path.join(
    repoDir,
    "dotfiles",
    "example-config",
    "config.jsonc",
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

async function createPiRepo() {
  const manifest = (await readManifest(process.cwd())).filter(
    (entry) =>
      entry.source === "dotfiles/AGENTS.md" ||
      entry.source === "dotfiles/pi/settings.json",
  );
  const files: Record<string, string> = {};
  for (const entry of manifest) {
    files[entry.source] = await fs.readFile(entry.source, "utf-8");
  }
  return { ...(await createRepo(files, manifest)), manifest, files };
}

describe("DotfilesInstaller", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("links the declared Config directory", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/example-config/config.jsonc": "config",
        "dotfiles/example-config/commands/example.md": "content",
      },
      [
        {
          source: "dotfiles/example-config",
          target: "~/.config/example-config",
        },
      ],
    );

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(path.join(homeDir, ".config", "example-config"));
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "example-config", "config.jsonc"),
        "utf-8",
      ),
    ).toBe("config");
    expect(
      await fs.readFile(
        path.join(
          homeDir,
          ".config",
          "example-config",
          "commands",
          "example.md",
        ),
        "utf-8",
      ),
    ).toBe("content");
  });

  it("replaces an existing parent symlink before linking granular entries", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/example-config/config.jsonc": "config",
        "dotfiles/example-config/commands/example.md": "command",
      },
      [
        {
          source: "dotfiles/example-config/config.jsonc",
          target: "~/.config/example-config/config.jsonc",
        },
        {
          source: "dotfiles/example-config/commands",
          target: "~/.config/example-config/commands",
        },
      ],
    );
    const exampleConfigTarget = path.join(homeDir, ".config", "example-config");
    const exampleConfigSource = path.join(
      repoDir,
      "dotfiles",
      "example-config",
    );
    await fs.mkdir(path.dirname(exampleConfigTarget), { recursive: true });
    await fs.symlink(exampleConfigSource, exampleConfigTarget, "dir");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectDirectory(exampleConfigTarget);
    await expectSymlink(path.join(exampleConfigTarget, "config.jsonc"));
    await expectSymlink(path.join(exampleConfigTarget, "commands"));
    expect(
      await fs.readFile(
        path.join(exampleConfigTarget, "config.jsonc"),
        "utf-8",
      ),
    ).toBe("config");
  });

  it("migrates a repo-backed parent symlink when the checkout path is symlinked", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/example-config/config.jsonc": "config",
      },
      [
        {
          source: "dotfiles/example-config/config.jsonc",
          target: "~/.config/example-config/config.jsonc",
        },
      ],
    );
    const linkedRepoDir = path.join(tmpDir, "repo-link");
    const exampleConfigTarget = path.join(homeDir, ".config", "example-config");
    await fs.symlink(repoDir, linkedRepoDir, "dir");
    await fs.mkdir(path.dirname(exampleConfigTarget), { recursive: true });
    await fs.symlink(
      path.join(repoDir, "dotfiles", "example-config"),
      exampleConfigTarget,
      "dir",
    );

    const success = await install(linkedRepoDir, homeDir);

    expect(success).toBe(true);
    await expectDirectory(exampleConfigTarget);
    await expectSymlink(path.join(exampleConfigTarget, "config.jsonc"));
  });

  it("preserves a symlinked ancestor while linking granular entries", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/example-config/config.jsonc": "config" },
      [
        {
          source: "dotfiles/example-config/config.jsonc",
          target: "~/.config/example-config/config.jsonc",
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
    await expectSymlink(
      path.join(configSource, "example-config", "config.jsonc"),
    );
    expect(
      await fs.readFile(
        path.join(configTarget, "example-config", "config.jsonc"),
        "utf-8",
      ),
    ).toBe("config");
  });

  it("rejects an immediate parent symlink outside the repository", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/example-config/config.jsonc": "config" },
      [
        {
          source: "dotfiles/example-config/config.jsonc",
          target: "~/.config/example-config/config.jsonc",
        },
      ],
    );
    const externalExampleConfig = path.join(tmpDir, "external-example-config");
    const exampleConfigTarget = path.join(homeDir, ".config", "example-config");
    await fs.mkdir(externalExampleConfig, { recursive: true });
    await fs.mkdir(path.dirname(exampleConfigTarget), { recursive: true });
    await fs.symlink(externalExampleConfig, exampleConfigTarget, "dir");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
    await expectSymlink(exampleConfigTarget);
  });

  it("rejects a broken immediate parent symlink without replacing it", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/example-config/config.jsonc": "config" },
      [
        {
          source: "dotfiles/example-config/config.jsonc",
          target: "~/.config/example-config/config.jsonc",
        },
      ],
    );
    const missingTarget = path.join(tmpDir, "missing-example-config");
    const exampleConfigTarget = path.join(homeDir, ".config", "example-config");
    await fs.mkdir(path.dirname(exampleConfigTarget), { recursive: true });
    await fs.symlink(missingTarget, exampleConfigTarget, "dir");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
    await expectSymlink(exampleConfigTarget);
  });

  it("rejects sources that escape the repository", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/example-config/config.jsonc": "config" },
      [
        {
          source: "../secret.txt",
          target: "~/.config/example-config/secret.txt",
        },
      ],
    );

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
  });

  it.each(["~", "~/"])("rejects home root target %s", async (target) => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/example-config/config.jsonc": "config" },
      [{ source: "dotfiles/example-config/config.jsonc", target }],
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
      { "dotfiles/example-config/tui.jsonc": "theme" },
      [
        {
          source: "dotfiles/example-config/tui.jsonc",
          target: "~/.config/example-config/nested/tui.jsonc",
        },
      ],
    );

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(
      path.join(homeDir, ".config", "example-config", "nested", "tui.jsonc"),
    );
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "example-config", "nested", "tui.jsonc"),
        "utf-8",
      ),
    ).toBe("theme");
  });

  it("rejects targets inside the repository", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    await writeConfigFile(repoDir);

    await writeManifest(repoDir, [
      {
        source: "dotfiles/example-config/config.jsonc",
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

    await writeConfigFile(repoDir);

    const targetPath = path.join(repoDir, "..foo", "config.jsonc");
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, "old");

    await writeManifest(repoDir, [
      {
        source: "dotfiles/example-config/config.jsonc",
        target: targetPath,
      },
    ]);

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
    expect(await fs.readFile(targetPath, "utf-8")).toBe("old");
  });

  it("allows absolute targets in sibling directories with the repository path prefix", async () => {
    const { repoDir, homeDir } = await createWorkspace();
    const targetPath = path.join(`${repoDir}-target`, "config.jsonc");

    await writeConfigFile(repoDir);
    await writeManifest(repoDir, [
      {
        source: "dotfiles/example-config/config.jsonc",
        target: targetPath,
      },
    ]);

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(targetPath);
  });

  it("links the same source file to multiple targets", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/shared/rules.md": "shared instructions" },
      [
        {
          source: "dotfiles/shared/rules.md",
          target: "~/.config/example-config/rules.md",
        },
        {
          source: "dotfiles/shared/rules.md",
          target: "~/.local/share/agent/rules.md",
        },
      ],
    );

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(
      path.join(homeDir, ".config", "example-config", "rules.md"),
    );
    await expectSymlink(
      path.join(homeDir, ".local", "share", "agent", "rules.md"),
    );
    expect(
      await fs.readFile(
        path.join(homeDir, ".config", "example-config", "rules.md"),
        "utf-8",
      ),
    ).toBe("shared instructions");
    expect(
      await fs.readFile(
        path.join(homeDir, ".local", "share", "agent", "rules.md"),
        "utf-8",
      ),
    ).toBe("shared instructions");
  });

  it("does not include removed agent configuration targets in the default manifest", async () => {
    const manifest = await readManifest(process.cwd());

    expect(
      manifest.some(
        (entry) =>
          entry.source.startsWith("dotfiles/legacy-agent/") ||
          entry.source.startsWith("dotfiles/legacy-tool/") ||
          entry.source.startsWith("dotfiles/legacy-config/"),
      ),
    ).toBe(false);
  });

  it("manages only Pi settings and shared instructions in the default manifest", async () => {
    const manifest = await readManifest(process.cwd());
    const piEntries = manifest.filter(
      (entry) => entry.target === "~/.pi" || entry.target.startsWith("~/.pi/"),
    );

    expect(piEntries).toEqual([
      {
        source: "dotfiles/pi/settings.json",
        target: "~/.pi/agent/settings.json",
      },
      {
        source: "dotfiles/AGENTS.md",
        target: "~/.pi/agent/AGENTS.md",
      },
    ]);
    expect(
      manifest.filter((entry) => entry.source.startsWith("dotfiles/pi")),
    ).toEqual([piEntries[0]]);
    expect(manifest).toContainEqual({
      source: "dotfiles/agents",
      target: "~/.agents",
    });
    expect(await fs.readdir("dotfiles/pi")).toEqual([
      "extensions",
      "settings.json",
    ]);
    expect(await fs.readdir("dotfiles/pi/extensions")).toEqual([".gitkeep"]);
    expect(
      JSON.parse(await fs.readFile("dotfiles/pi/settings.json", "utf-8")),
    ).not.toHaveProperty("skills");
  });

  it.each([false, true])(
    "links and relinks Pi settings and shared instructions with existing files: %s",
    async (existingFiles) => {
      const { repoDir, homeDir, manifest, files } = await createPiRepo();
      if (existingFiles) {
        for (const entry of manifest) {
          const target = path.join(homeDir, entry.target.slice(2));
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, "old content");
        }
      }

      for (let run = 0; run < 2; run++) {
        expect(await install(repoDir, homeDir)).toBe(true);
        for (const entry of manifest) {
          const target = path.join(homeDir, entry.target.slice(2));
          await expectSymlink(target);
          expect(await fs.realpath(target)).toBe(
            path.join(repoDir, entry.source),
          );
          expect(await fs.readFile(target, "utf-8")).toBe(files[entry.source]);
        }
        await expectDirectory(path.join(homeDir, ".pi", "agent"));
      }
    },
  );

  it("preserves Pi runtime data and all Orca extensions through repeated installation", async () => {
    const { repoDir, homeDir } = await createPiRepo();
    const agentDir = path.join(homeDir, ".pi", "agent");
    const unmanagedPaths = [
      "auth.json",
      "models-store.json",
      "trust.json",
      "sessions/project/session.jsonl",
      "bin/pi",
      "install/managed-install.json",
      "extensions/orca-agent-status.ts",
      "extensions/orca-prefill.ts",
      "extensions/orca-titlebar-spinner.ts",
    ];
    for (const relativePath of unmanagedPaths) {
      const target = path.join(agentDir, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, `unmanaged ${relativePath}`);
    }

    for (let run = 0; run < 2; run++) {
      expect(await install(repoDir, homeDir)).toBe(true);
      await expectDirectory(agentDir);
      await expectDirectory(path.join(agentDir, "extensions"));
      for (const relativePath of unmanagedPaths) {
        const target = path.join(agentDir, relativePath);
        expect((await fs.lstat(target)).isFile()).toBe(true);
        expect(await fs.readFile(target, "utf-8")).toBe(
          `unmanaged ${relativePath}`,
        );
      }
      expect(
        (await fs.readdir(path.join(agentDir, "extensions"))).sort(),
      ).toEqual(
        unmanagedPaths
          .filter((p) => p.startsWith("extensions/"))
          .map((p) => path.basename(p))
          .sort(),
      );
    }
  });

  it("links a personal Pi extension file without replacing Orca extensions", async () => {
    const source = "dotfiles/pi/extensions/personal.ts";
    const { repoDir, homeDir } = await createRepo(
      { [source]: "export default function personal() {}\n" },
      [{ source, target: "~/.pi/agent/extensions/personal.ts" }],
    );
    const extensionsDir = path.join(homeDir, ".pi", "agent", "extensions");
    const orcaPath = path.join(extensionsDir, "orca-prefill.ts");
    const personalPath = path.join(extensionsDir, "personal.ts");
    await fs.mkdir(extensionsDir, { recursive: true });
    await fs.writeFile(orcaPath, "Orca-managed content");

    for (let run = 0; run < 2; run++) {
      expect(await install(repoDir, homeDir)).toBe(true);
      await expectDirectory(extensionsDir);
      await expectSymlink(personalPath);
      expect(await fs.realpath(personalPath)).toBe(path.join(repoDir, source));
      expect(await fs.readFile(personalPath, "utf-8")).toBe(
        "export default function personal() {}\n",
      );
      expect((await fs.lstat(orcaPath)).isFile()).toBe(true);
      expect(await fs.readFile(orcaPath, "utf-8")).toBe("Orca-managed content");
    }
  });

  it("links agent-sudo into ~/.local/bin", async () => {
    const { repoDir, homeDir } = await createRepo(
      {
        "dotfiles/bin/agent-sudo": "#!/usr/bin/env bash\necho agent-sudo\n",
      },
      [
        {
          source: "dotfiles/bin/agent-sudo",
          target: "~/.local/bin/agent-sudo",
        },
      ],
    );

    expect(await install(repoDir, homeDir)).toBe(true);
    await expectSymlink(path.join(homeDir, ".local", "bin", "agent-sudo"));
  });

  it("replaces existing targets", async () => {
    const { repoDir, homeDir } = await createRepo(
      { "dotfiles/example-config/config.jsonc": "new" },
      [
        {
          source: "dotfiles/example-config/config.jsonc",
          target: "~/.config/example-config/config.jsonc",
        },
      ],
    );

    const targetPath = path.join(homeDir, ".config", "example-config");
    await fs.mkdir(targetPath, { recursive: true });
    await fs.writeFile(path.join(targetPath, "config.jsonc"), "old");

    const success = await install(repoDir, homeDir);

    expect(success).toBe(true);
    await expectSymlink(path.join(targetPath, "config.jsonc"));
    expect(
      await fs.readFile(path.join(targetPath, "config.jsonc"), "utf-8"),
    ).toBe("new");
  });

  it("fails when the manifest is missing", async () => {
    const { repoDir, homeDir } = await createWorkspace();

    const success = await install(repoDir, homeDir);

    expect(success).toBe(false);
  });
});
