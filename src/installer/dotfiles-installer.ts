import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { applyEntry, planEntry } from "./linker.ts";
import { readManifest } from "./manifest.ts";

export class DotfilesInstaller {
  constructor(
    private repoDir = process.cwd(),
    private homeDir = os.homedir(),
  ) {}

  async install(): Promise<boolean> {
    try {
      const entries = await readManifest(this.repoDir);
      const plans = [];
      for (const entry of entries) {
        plans.push(await planEntry(this.repoDir, this.homeDir, entry));
      }
      for (const plan of plans) {
        await applyEntry(plan);
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
