import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createExtensionLogger } from "../shared/logger.js";
import { fetchCodexQuotaStatus } from "./codex.js";
import { fetchOpenCodeGoData } from "./opencode.js";
import { retryNullable } from "./retry.js";
import { formatCodexFullDetail, formatOpenCodeFullDetail } from "./status.js";
import type {
  AccountConfig,
  CodexQuotaData,
  ExtensionContext,
  OpenCodeGoData,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_INITIAL_DELAY_MS = 5000;

// ---------------------------------------------------------------------------
// Account config loading
// ---------------------------------------------------------------------------

async function loadAccounts(): Promise<AccountConfig[]> {
  const configPath = join(import.meta.dirname ?? ".", "accounts.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw) as AccountConfig[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// /quota command
// ---------------------------------------------------------------------------

function formatQuotaOutput(
  codex: CodexQuotaData | null,
  accounts: Array<{ name: string; data: OpenCodeGoData | null }>,
): string {
  const lines: string[] = [];

  if (codex) {
    lines.push(...formatCodexFullDetail(codex));
    lines.push("");
  }

  for (const account of accounts) {
    if (account.data) {
      lines.push(...formatOpenCodeFullDetail(account.data, account.name));
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}

async function handleQuotaCommand(
  _args: string,
  ctx: ExtensionContext,
): Promise<void> {
  const logger = createExtensionLogger(ctx, "quota");
  const accounts = await loadAccounts();

  const [codexData, ...accountResults] = await Promise.all([
    retryNullable(() => fetchCodexQuotaStatus(ctx, logger), {
      maxAttempts: FETCH_RETRY_ATTEMPTS,
      initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
    }),
    ...accounts.map((account) =>
      retryNullable(
        () =>
          fetchOpenCodeGoData(account.workspaceEnv, account.cookieEnv, logger),
        {
          maxAttempts: FETCH_RETRY_ATTEMPTS,
          initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
        },
      ).then((data) => ({ name: account.name, data })),
    ),
  ]);

  const output = formatQuotaOutput(codexData, accountResults);

  if (!output) {
    ctx.ui.notify("No quota data available", "info");
    return;
  }
  ctx.ui.notify(output, "info");
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.registerCommand("quota", {
    description: "Show detailed quota information",
    handler: handleQuotaCommand,
  });
}
