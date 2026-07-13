import { basename, dirname, resolve } from "node:path";

export const CONTEXT_USAGE_WARNING_TOKENS = 150_000;

type ContextUsage = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

export function formatK(value: number): string {
  return `${Math.round(value / 1000)}k`;
}

export function formatCurrentUsage(usage: ContextUsage | undefined): string {
  if (usage == null || usage.tokens == null) {
    return formatK(0);
  }

  return formatK(usage.tokens);
}

export interface GitMetadata {
  topLevel: string;
  gitDir: string;
  commonDir: string;
}

export function parseGitMetadata(output: string): GitMetadata | null {
  const [topLevel, gitDir, commonDir] = output.trim().split(/\r?\n/);
  return topLevel && gitDir && commonDir
    ? { topLevel, gitDir, commonDir }
    : null;
}

export interface DirectorySegmentInput {
  cwd: string;
  home: string | undefined;
  branch: string | null;
  git: GitMetadata | null;
}

export function formatDirectorySegment(input: DirectorySegmentInput): string {
  if (!input.git || !input.branch) {
    return input.cwd === input.home ? "~" : basename(input.cwd);
  }

  const gitDir = resolve(input.cwd, input.git.gitDir);
  const commonDir = resolve(input.cwd, input.git.commonDir);
  const repository =
    gitDir === commonDir
      ? basename(input.git.topLevel)
      : basename(dirname(commonDir));
  return `${repository}/${input.branch}`;
}
