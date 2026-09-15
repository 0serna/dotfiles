import { promises as fs } from "node:fs";
import * as path from "node:path";

export type DotfileEntry = {
  source: string;
  target: string;
};

export async function readManifest(repoDir: string): Promise<DotfileEntry[]> {
  const manifestPath = path.join(repoDir, "dotfiles.json");

  let manifestContent: string;
  try {
    manifestContent = await fs.readFile(manifestPath, "utf-8");
  } catch (error) {
    throw new Error(`Manifest not found: ${manifestPath}`, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestContent) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in manifest: ${manifestPath}`, {
      cause: error,
    });
  }

  if (!Array.isArray(parsed)) {
    throw new Error("dotfiles.json must contain an array of entries");
  }

  return parsed.map((entry, index) => parseEntry(entry, index + 1));
}

function parseEntry(entry: unknown, index: number): DotfileEntry {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Entry ${index} must be an object`);
  }

  const { source, target } = entry as Record<string, unknown>;

  return {
    source: parseEntryValue(source, index),
    target: parseEntryValue(target, index),
  };
}

function parseEntryValue(value: unknown, index: number): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  throw new Error(`Entry ${index} must include non-empty source and target`);
}
