import { promises as fs } from "node:fs";
import * as path from "node:path";

import type { DotfileEntry } from "./manifest.ts";
import {
  isPathInsideDirectory,
  resolveSource,
  resolveTarget,
} from "./paths.ts";

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

  await prepareTargetParent(repoDir, path.dirname(targetPath));
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

async function prepareTargetParent(
  repoDir: string,
  parentPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(parentPath), { recursive: true });

  const parentStat = await fs.lstat(parentPath).catch(() => undefined);
  if (!parentStat?.isSymbolicLink()) {
    await fs.mkdir(parentPath, { recursive: true });
    return;
  }

  const [resolvedParent, resolvedRepo] = await Promise.all([
    fs.realpath(parentPath).catch(() => undefined),
    fs.realpath(repoDir).catch(() => undefined),
  ]);
  const isRepoBackedParent =
    resolvedParent !== undefined &&
    resolvedRepo !== undefined &&
    isPathInsideDirectory(resolvedRepo, resolvedParent);

  if (!isRepoBackedParent) {
    throw new Error(
      `Parent symlink is not managed by this repository: ${parentPath}`,
    );
  }

  await fs.rm(parentPath, { recursive: true, force: true });
  await fs.mkdir(parentPath, { recursive: true });
}
