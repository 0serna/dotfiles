import { accessSync, constants } from "fs";
import { tmpdir } from "os";
import { basename, dirname } from "path";
import { replaceTextContent } from "../content.js";
import type { PruneReason, StubDecision } from "../types.js";

function isReusableFullOutputPath(filePath: string): boolean {
  const dir = dirname(filePath);
  const name = basename(filePath);

  const knownPattern =
    (dir === tmpdir() && /^pi-bash-[A-Za-z0-9]+\.log$/.test(name)) ||
    (dir === `${tmpdir()}/pi-web-fetch` &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.txt$/i.test(
        name,
      ));

  if (!knownPattern) return false;

  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function extractFullOutputPath(text: string): string | null {
  const match = text.match(/Full (?:output|content saved to):\s*([^\s\]]+)/);
  const filePath = match?.[1];
  return filePath !== undefined && isReusableFullOutputPath(filePath)
    ? filePath
    : null;
}

export function buildStub(reason: PruneReason, savedPath?: string): string {
  return savedPath
    ? `[DCP pruned transient output: reason=${reason}; saved=${savedPath}]`
    : `[DCP pruned transient output: reason=${reason}]`;
}

function savedPathFor(decision: StubDecision): string | undefined {
  return extractFullOutputPath(decision.candidate.text) ?? undefined;
}

export function applyStubs<T>(
  messages: readonly T[],
  decisions: readonly StubDecision[],
): T[] {
  const replacements = new Map<number, Record<string, unknown>>();

  for (const decision of decisions) {
    const savedPath = savedPathFor(decision);
    replacements.set(
      decision.candidate.index,
      replaceTextContent(
        decision.candidate.message,
        buildStub(decision.reason, savedPath),
      ),
    );
  }

  return messages.map(
    (message, index) => (replacements.get(index) as T | undefined) ?? message,
  );
}
