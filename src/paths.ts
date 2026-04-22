import * as path from "node:path";

function isPathInsideDirectory(
  directoryPath: string,
  candidatePath: string,
): boolean {
  const normalizedDirectory = path.resolve(directoryPath);
  const normalizedCandidate = path.resolve(candidatePath);

  return (
    normalizedCandidate === normalizedDirectory ||
    normalizedCandidate.startsWith(`${normalizedDirectory}${path.sep}`)
  );
}

export function resolveSource(repoDir: string, source: string): string {
  if (path.isAbsolute(source)) {
    throw new Error(`Source must be relative: ${source}`);
  }

  const repoRoot = path.resolve(repoDir);
  const resolvedSource = path.resolve(repoDir, source);

  if (!isPathInsideDirectory(repoRoot, resolvedSource)) {
    throw new Error(`Source escapes repository: ${source}`);
  }

  return resolvedSource;
}

export function resolveTarget(
  repoDir: string,
  homeDir: string,
  target: string,
): string {
  const expandedTarget =
    target === "~"
      ? homeDir
      : target.startsWith("~/")
        ? path.join(homeDir, target.slice(2))
        : target;

  if (!path.isAbsolute(expandedTarget)) {
    throw new Error(`Target must be absolute: ${target}`);
  }

  const normalizedTarget = path.resolve(expandedTarget);
  const normalizedHome = path.resolve(homeDir);
  if (normalizedTarget === normalizedHome) {
    throw new Error(`Target resolves to the home directory root: ${target}`);
  }

  const normalizedRepo = path.resolve(repoDir);
  if (isPathInsideDirectory(normalizedRepo, normalizedTarget)) {
    throw new Error(`Target resolves inside the repository: ${target}`);
  }

  return normalizedTarget;
}
