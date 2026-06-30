import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export async function writeTempOutput(
  prefix: string,
  fileName: string,
  content: string,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-`));
  await chmod(dir, PRIVATE_DIRECTORY_MODE);

  const filePath = join(dir, fileName);
  await writeFile(filePath, content, {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE,
  });
  await chmod(filePath, PRIVATE_FILE_MODE);
  return filePath;
}
