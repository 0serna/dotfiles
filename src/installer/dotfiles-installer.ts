import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { linkEntry } from "./linker.ts";
import { readManifest } from "./manifest.ts";

export class DotfilesInstaller {
  constructor(
    private repoDir = process.cwd(),
    private homeDir = os.homedir(),
  ) {}

  async install(): Promise<boolean> {
    try {
      const entries = await readManifest(this.repoDir);
      for (const entry of entries) {
        await linkEntry(this.repoDir, this.homeDir, entry);
      }
      return true;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}

async function main(): Promise<void> {
  const installer = new DotfilesInstaller();
  const success = await installer.install();
  process.exit(success ? 0 : 1);
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
