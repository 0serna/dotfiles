import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export class ConfigInstaller {
  constructor(
    private repoDir = process.cwd(),
    private targetDir = path.join(os.homedir(), ".config", "opencode"),
  ) {}

  async install(): Promise<boolean> {
    const sourceDir = path.join(this.repoDir, "opencode");

    try {
      await fs.stat(sourceDir);
    } catch {
      console.error(`Source directory not found: ${sourceDir}`);
      return false;
    }

    await fs.mkdir(this.targetDir, { recursive: true });

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const source = path.resolve(sourceDir, entry.name);
      const target = path.join(this.targetDir, entry.name);

      await fs.rm(target, { recursive: true, force: true });
      await fs.symlink(source, target);
      const entryType = entry.isDirectory()
        ? "dir"
        : entry.isFile()
          ? "file"
          : "entry";
      console.log(`Linked ${entryType}: ${entry.name}`);
    }

    await this.cleanupBrokenSymlinks();
    return true;
  }

  private async cleanupBrokenSymlinks(): Promise<void> {
    const entries = await fs.readdir(this.targetDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isSymbolicLink()) continue;

      const linkPath = path.join(this.targetDir, entry.name);
      try {
        await fs.stat(linkPath);
      } catch {
        await fs.unlink(linkPath);
        console.log(`Removed broken symlink: ${entry.name}`);
      }
    }
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
