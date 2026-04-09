import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type DotfileEntry = {
  source: string;
  target: string;
};

export class ConfigInstaller {
  constructor(
    private repoDir = process.cwd(),
    private homeDir = os.homedir(),
  ) {}

  async install(): Promise<boolean> {
    try {
      const entries = await this.readManifest();
      for (const entry of entries) {
        await this.linkEntry(entry);
      }
      return true;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async readManifest(): Promise<DotfileEntry[]> {
    const manifestPath = path.join(this.repoDir, "dotfiles.json");

    let manifestContent: string;
    try {
      manifestContent = await fs.readFile(manifestPath, "utf-8");
    } catch {
      throw new Error(`Manifest not found: ${manifestPath}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestContent) as unknown;
    } catch {
      throw new Error(`Invalid JSON in manifest: ${manifestPath}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error("dotfiles.json must contain an array of entries");
    }

    return parsed.map((entry, index) => this.parseEntry(entry, index + 1));
  }

  private parseEntry(entry: unknown, index: number): DotfileEntry {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Entry ${index} must be an object`);
    }

    const { source, target } = entry as Record<string, unknown>;
    if (
      typeof source !== "string" ||
      source.trim() === "" ||
      typeof target !== "string" ||
      target.trim() === ""
    ) {
      throw new Error(
        `Entry ${index} must include non-empty source and target`,
      );
    }

    return { source, target };
  }

  private resolveSource(source: string): string {
    if (path.isAbsolute(source)) {
      throw new Error(`Source must be relative: ${source}`);
    }

    const repoRoot = path.resolve(this.repoDir);
    const resolved = path.resolve(this.repoDir, source);

    if (
      resolved !== repoRoot &&
      !resolved.startsWith(`${repoRoot}${path.sep}`)
    ) {
      throw new Error(`Source escapes repository: ${source}`);
    }

    return resolved;
  }

  private resolveTarget(target: string): string {
    const expandedTarget =
      target === "~"
        ? this.homeDir
        : target.startsWith("~/")
          ? path.join(this.homeDir, target.slice(2))
          : target;

    if (!path.isAbsolute(expandedTarget)) {
      throw new Error(`Target must be absolute: ${target}`);
    }

    const normalizedTarget = path.resolve(expandedTarget);
    const normalizedHome = path.resolve(this.homeDir);
    if (normalizedTarget === normalizedHome) {
      throw new Error(`Target resolves to the home directory root: ${target}`);
    }

    const normalizedRepo = path.resolve(this.repoDir);
    if (
      normalizedTarget === normalizedRepo ||
      normalizedTarget.startsWith(`${normalizedRepo}${path.sep}`)
    ) {
      throw new Error(`Target resolves inside the repository: ${target}`);
    }

    return normalizedTarget;
  }

  private async linkEntry(entry: DotfileEntry): Promise<void> {
    const sourcePath = this.resolveSource(entry.source);
    const targetPath = this.resolveTarget(entry.target);
    const sourceStat = await fs.lstat(sourcePath).catch(() => {
      throw new Error(`Source not found: ${entry.source}`);
    });

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.symlink(
      sourcePath,
      targetPath,
      sourceStat.isDirectory() ? "dir" : "file",
    );

    const entryType = sourceStat.isDirectory()
      ? "dir"
      : sourceStat.isFile()
        ? "file"
        : "entry";
    console.log(`Linked ${entryType}: ${entry.source} -> ${entry.target}`);
  }
}

async function main(): Promise<void> {
  const installer = new ConfigInstaller();
  const success = await installer.install();
  process.exit(success ? 0 : 1);
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
