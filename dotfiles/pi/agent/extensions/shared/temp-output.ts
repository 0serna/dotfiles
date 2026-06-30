import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;

export type TempOutputOptions = {
  id?: string;
};

function validatePathSegment(label: string, value: string): void {
  if (!SAFE_PATH_SEGMENT.test(value)) {
    throw new Error(`Invalid temp output ${label}: ${value}`);
  }
}

function tempOutputPath(
  namespace: string,
  options: TempOutputOptions = {},
): string {
  const outputId = options.id ?? randomUUID();
  validatePathSegment("namespace", namespace);
  validatePathSegment("id", outputId);
  return join(tmpdir(), namespace, `${outputId}.txt`);
}

export async function writeTempOutput(
  namespace: string,
  content: string,
  options: TempOutputOptions = {},
): Promise<string> {
  const filePath = tempOutputPath(namespace, options);
  const dir = join(tmpdir(), namespace);
  await mkdir(dir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  await chmod(dir, PRIVATE_DIRECTORY_MODE);
  await writeFile(filePath, content, {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE,
  });
  await chmod(filePath, PRIVATE_FILE_MODE);
  return filePath;
}

export function writeTempOutputSync(
  namespace: string,
  content: string,
  options: TempOutputOptions = {},
): string {
  const filePath = tempOutputPath(namespace, options);
  const dir = join(tmpdir(), namespace);
  mkdirSync(dir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  chmodSync(dir, PRIVATE_DIRECTORY_MODE);
  writeFileSync(filePath, content, {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE,
  });
  chmodSync(filePath, PRIVATE_FILE_MODE);
  return filePath;
}
