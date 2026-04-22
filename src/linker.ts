import { promises as fs } from "node:fs";
import * as path from "node:path";

import type { DotfileEntry } from "./manifest.ts";
import { resolveSource, resolveTarget } from "./paths.ts";

export async function linkEntry(
  repoDir: string,
  homeDir: string,
  entry: DotfileEntry,
): Promise<void> {
  const sourcePath = resolveSource(repoDir, entry.source);
  const targetPath = resolveTarget(repoDir, homeDir, entry.target);
  const sourceStat = await fs.lstat(sourcePath).catch(() => {
    throw new Error(`Source not found: ${entry.source}`);
  });
  const isDirectory = sourceStat.isDirectory();
  const isFile = sourceStat.isFile();

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.symlink(sourcePath, targetPath, isDirectory ? "dir" : "file");

  let entryType = "entry";
  if (isDirectory) {
    entryType = "dir";
  } else if (isFile) {
    entryType = "file";
  }

  console.log(`Linked ${entryType}: ${entry.source} -> ${entry.target}`);
}
