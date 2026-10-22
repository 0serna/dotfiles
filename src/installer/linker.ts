import { promises as fs } from "node:fs";
import * as path from "node:path";

import type { DotfileEntry } from "./manifest.ts";
import {
  isPathInsideDirectory,
  resolveSource,
  resolveTarget,
} from "./paths.ts";

export type EntryPlan = {
  entry: DotfileEntry;
  sourcePath: string;
  targetPath: string;
  isDirectory: boolean;
};

export async function planEntry(
  repoDir: string,
  homeDir: string,
  entry: DotfileEntry,
): Promise<EntryPlan> {
  const sourcePath = resolveSource(repoDir, entry.source);
  const targetPath = resolveTarget(repoDir, homeDir, entry.target);
  const sourceStat = await fs.lstat(sourcePath).catch(() => {
    throw new Error(`Source not found: ${entry.source}`);
  });

  const parentPath = path.dirname(targetPath);
  const parentStat = await fs.lstat(parentPath).catch(() => undefined);
  if (parentStat?.isSymbolicLink()) {
    if (!(await isRepoBackedSymlink(repoDir, parentPath))) {
      throw new Error(
        `Parent symlink is not managed by this repository: ${parentPath}`,
      );
    }
  } else {
    const targetStat = await fs.lstat(targetPath).catch(() => undefined);
    if (targetStat && !targetStat.isSymbolicLink()) {
      throw new Error(
        `Target exists and is not a symlink: ${entry.target}. Move it away and run again.`,
      );
    }
  }

  return {
    entry,
    sourcePath,
    targetPath,
    isDirectory: sourceStat.isDirectory(),
  };
}

export async function applyEntry(plan: EntryPlan): Promise<void> {
  const { entry, sourcePath, targetPath, isDirectory } = plan;

  await prepareTargetParent(path.dirname(targetPath));
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.symlink(sourcePath, targetPath, isDirectory ? "dir" : "file");

  const entryType = isDirectory ? "dir" : "file";
  console.log(`Linked ${entryType}: ${entry.source} -> ${entry.target}`);
}

async function prepareTargetParent(parentPath: string): Promise<void> {
  const parentStat = await fs.lstat(parentPath).catch(() => undefined);
  if (parentStat?.isSymbolicLink()) {
    await fs.rm(parentPath, { recursive: true, force: true });
  }

  await fs.mkdir(parentPath, { recursive: true });
}

async function isRepoBackedSymlink(
  repoDir: string,
  symlinkPath: string,
): Promise<boolean> {
  const [resolvedParent, resolvedRepo] = await Promise.all([
    fs.realpath(symlinkPath).catch(() => undefined),
    fs.realpath(repoDir).catch(() => undefined),
  ]);

  if (resolvedParent === undefined || resolvedRepo === undefined) {
    return false;
  }

  return isPathInsideDirectory(resolvedRepo, resolvedParent);
}
