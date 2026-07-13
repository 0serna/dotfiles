import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionLogger } from "../shared/logger.js";
import { createExtensionLogger } from "../shared/logger.js";
import { fetchCodexQuotaStatus } from "./codex.js";
import { withQuotaNotification } from "./loading.js";
import { fetchOpenCodeGoData } from "./opencode.js";
import { retryNullable } from "./retry.js";
import {
  DEFAULT_COOLDOWN_MS,
  initAccountStates,
  isAvailable,
  isQuotaExhaustionError,
  markBad,
  pickBestQuotaAccount,
  pickNextAccount,
  type AccountQuotaCandidate,
  type RotationReason,
} from "./rotation.js";
import { formatCodexFullDetail, formatOpenCodeFullDetail } from "./status.js";
import type {
  AccountConfig,
  AccountState,
  CodexQuotaData,
  ExtensionContext,
  OpenCodeGoData,
  ProviderAccountConfig,
  RotationConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_INITIAL_DELAY_MS = 5000;
const OPENCODE_PROVIDER = "opencode-go";

// ---------------------------------------------------------------------------
// Module state (cleared on session_shutdown)
// ---------------------------------------------------------------------------

let rotationConfig: RotationConfig | undefined;
let accountStates: AccountState[] = [];
let currentAccountIndex = -1;
let continuationSentThisTurn = false;
let triedAccountsThisTurn: Set<string> = new Set();
let logger: ExtensionLogger | undefined;

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

async function loadProviderConfig(provider: string): Promise<AccountConfig[]> {
  const configPath = join(import.meta.dirname ?? ".", "accounts.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as ProviderAccountConfig[];
    const entry = parsed.find((p) => p.provider === provider);
    return entry?.accounts ?? [];
  } catch {
    return [];
  }
}

async function loadRotationConfig(): Promise<RotationConfig> {
  const accounts = await loadProviderConfig(OPENCODE_PROVIDER);
  return { accounts, cooldownMs: DEFAULT_COOLDOWN_MS };
}

function getLogger(ctx: ExtensionContext): ExtensionLogger {
  if (!logger) {
    logger = createExtensionLogger(ctx, "quota");
  }
  return logger;
}

// ---------------------------------------------------------------------------
// Account activation
// ---------------------------------------------------------------------------

function activateAccount(index: number, ctx: ExtensionContext): boolean {
  const state = accountStates[index];
  if (!state) {
    getLogger(ctx).log("activate_account_failed", {
      index,
      reason: "missing state",
    });
    return false;
  }

  ctx.modelRegistry.authStorage.setRuntimeApiKey(
    OPENCODE_PROVIDER,
    state.apiKey,
  );
  currentAccountIndex = index;
  getLogger(ctx).log("account_activated", {
    provider: OPENCODE_PROVIDER,
    account: state.name,
    index,
  });
  return true;
}

type AvailableAccountQuota = AccountQuotaCandidate & {
  configIndex: number;
  stateIndex: number;
};

type SelectionResult = {
  /** Index of the selected account in accountStates, or -1 if none. */
  index: number;
  /** True when at least one account's fetch returned quota data. */
  hadSuccessfulFetch: boolean;
};

/**
 * Fetch quota for every configured account and select the most balanced
 * account whose monthly, weekly, and rolling windows all have quota.
 */
async function selectBestAccount(
  ctx: ExtensionContext,
): Promise<SelectionResult> {
  const fetchLogger = getLogger(ctx);
  fetchLogger.log("select_best_account_start", {
    provider: OPENCODE_PROVIDER,
    accountCount: rotationConfig?.accounts.length ?? 0,
  });

  const quotas: AccountQuotaCandidate[] = await Promise.all(
    rotationConfig?.accounts.map(async (account) => {
      const data = await retryNullable(
        () =>
          fetchOpenCodeGoData(
            account.name,
            account.workspaceEnv,
            account.cookieEnv,
            fetchLogger,
          ),
        {
          maxAttempts: FETCH_RETRY_ATTEMPTS,
          initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
        },
      );
      return { account, data };
    }) ?? [],
  );

  const anyFetchSucceeded = quotas.some((q) => q.data !== null);

  const now = Date.now();
  const candidates: AvailableAccountQuota[] = [];

  for (let configIndex = 0; configIndex < quotas.length; configIndex++) {
    const quota = quotas[configIndex];
    if (!quota) continue;

    const stateIndex = accountStates.findIndex(
      (state) => state.name === quota.account.name,
    );
    const state = accountStates[stateIndex];
    if (stateIndex < 0 || !state || !isAvailable(state, now)) continue;

    candidates.push({ ...quota, configIndex, stateIndex });
  }

  const selectedCandidateIndex = pickBestQuotaAccount(candidates);
  const selected =
    selectedCandidateIndex >= 0
      ? candidates[selectedCandidateIndex]
      : undefined;

  if (selected) {
    fetchLogger.log("select_best_account_chosen", {
      provider: OPENCODE_PROVIDER,
      account: selected.account.name,
      index: selected.stateIndex,
      configIndex: selected.configIndex,
      monthlyRemaining: selected.data?.monthly?.remainingPercent,
      weeklyRemaining: selected.data?.weekly?.remainingPercent,
      rollingRemaining: selected.data?.rolling?.remainingPercent,
      selectionScore: Math.min(
        selected.data!.monthly!.remainingPercent,
        selected.data!.weekly!.remainingPercent,
        selected.data!.rolling!.remainingPercent,
      ),
    });
    return { index: selected.stateIndex, hadSuccessfulFetch: true };
  }

  fetchLogger.log("select_best_account_fallback", {
    provider: OPENCODE_PROVIDER,
    fallbackIndex: -1,
    reason: anyFetchSucceeded
      ? "no account has all quota windows available"
      : "all account fetches failed",
  });
  return { index: -1, hadSuccessfulFetch: anyFetchSucceeded };
}

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

function currentAccount(): AccountState | undefined {
  return accountStates[currentAccountIndex];
}

function rotateToNext(reason: RotationReason, ctx: ExtensionContext): boolean {
  const now = Date.now();
  const current = currentAccount();
  const log = getLogger(ctx);
  log.log("rotate_attempt", {
    provider: OPENCODE_PROVIDER,
    fromAccount: current?.name,
    fromIndex: currentAccountIndex,
    reason,
  });

  if (current) {
    markBad(
      current,
      reason,
      rotationConfig?.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      now,
    );
  }

  const nextIndex = pickNextAccount(accountStates, currentAccountIndex, now);
  if (nextIndex < 0 || nextIndex === currentAccountIndex) {
    log.log("rotate_exhausted", {
      provider: OPENCODE_PROVIDER,
      accountCount: accountStates.length,
    });
    ctx.ui.notify(
      "All OpenCode Go accounts are exhausted or on cooldown.",
      "warning",
    );
    return false;
  }

  activateAccount(nextIndex, ctx);
  const next = currentAccount();
  if (next) {
    log.log("rotate_success", {
      provider: OPENCODE_PROVIDER,
      fromAccount: current?.name,
      toAccount: next.name,
      toIndex: nextIndex,
      reason,
    });
    ctx.ui.notify(
      `Rotated OpenCode Go: ${current?.name ?? "?"} → ${next.name}`,
      "info",
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Lifecycle handlers
// ---------------------------------------------------------------------------

async function handleSessionStart(
  _event: unknown,
  ctx: ExtensionContext,
): Promise<void> {
  logger = createExtensionLogger(ctx, "quota");
  rotationConfig = await loadRotationConfig();
  accountStates = initAccountStates(rotationConfig.accounts);
  currentAccountIndex = -1;
  continuationSentThisTurn = false;
  triedAccountsThisTurn = new Set();

  logger.log("session_start", {
    provider: OPENCODE_PROVIDER,
    configuredAccounts: rotationConfig.accounts.length,
    validAccounts: accountStates.length,
  });

  if (accountStates.length === 0) {
    logger.log("session_start_no_accounts", {
      provider: OPENCODE_PROVIDER,
      reason: "no configured accounts had API keys",
    });
    return;
  }

  const selection = await selectBestAccount(ctx);
  if (selection.index >= 0) {
    activateAccount(selection.index, ctx);
    return;
  }

  if (selection.hadSuccessfulFetch) {
    // At least one account responded, but none passed hasUsableQuota.
    logger.log("session_start_no_eligible_account", {
      provider: OPENCODE_PROVIDER,
      reason: "no account has all quota windows available",
    });
    ctx.ui.notify(
      "No OpenCode Go account has all quota windows available.",
      "warning",
    );
    return;
  }

  // Blind fallback: all account fetches timed out. Activate the first
  // configured account and let runtime rotation handle errors.
  logger.log("session_start_blind_fallback", {
    provider: OPENCODE_PROVIDER,
    reason: "all account fetches failed, activating first account blindly",
  });
  activateAccount(0, ctx);
}

function makeMessageEndHandler(pi: ExtensionAPI) {
  return async function handleMessageEnd(
    event: {
      message?: { role?: string; stopReason?: string; errorMessage?: string };
    },
    ctx: ExtensionContext,
  ): Promise<void> {
    if (ctx.model?.provider !== OPENCODE_PROVIDER) return;
    if (accountStates.length === 0) return;

    const msg = event.message;
    if (msg?.role !== "assistant" || msg?.stopReason !== "error") return;

    // Only rotate on explicit quota exhaustion. Transient errors (timeouts,
    // stream interruptions, network failures) are handled by pi's built-in
    // retry and must not trigger a key rotation.
    if (!isQuotaExhaustionError(msg.errorMessage)) return;

    const current = currentAccount();
    if (current) {
      triedAccountsThisTurn.add(current.name);
    }

    const allAccountsAttempted = accountStates.every((state) =>
      triedAccountsThisTurn.has(state.name),
    );
    if (allAccountsAttempted) {
      getLogger(ctx).log("rotate_cycle_exhausted", {
        provider: OPENCODE_PROVIDER,
        triedAccounts: Array.from(triedAccountsThisTurn),
        accountCount: accountStates.length,
      });
      ctx.ui.notify(
        "All OpenCode Go accounts have been attempted this turn. Quota may be exhausted on every account.",
        "warning",
      );
      return;
    }

    if (continuationSentThisTurn) return;

    // Provider did not recover automatically. Try one more rotation and queue
    // a continuation so the agent resumes without manual intervention.
    getLogger(ctx).log("message_end_error", {
      provider: OPENCODE_PROVIDER,
      currentAccount: current?.name,
    });
    const rotated = rotateToNext("rate-limited", ctx);
    if (rotated) {
      continuationSentThisTurn = true;
      getLogger(ctx).log("fallback_continuation_queued", {
        provider: OPENCODE_PROVIDER,
        currentAccount: currentAccount()?.name,
      });
      await pi.sendUserMessage("continue", { deliverAs: "followUp" });
    }
  };
}

function handleTurnStart(): void {
  continuationSentThisTurn = false;
  triedAccountsThisTurn = new Set();
}

function handleSessionShutdown(_event: unknown, ctx: ExtensionContext): void {
  ctx.modelRegistry.authStorage.removeRuntimeApiKey(OPENCODE_PROVIDER);
  rotationConfig = undefined;
  accountStates = [];
  currentAccountIndex = -1;
  continuationSentThisTurn = false;
  triedAccountsThisTurn = new Set();
  logger = undefined;
}

// ---------------------------------------------------------------------------
// /quota command
// ---------------------------------------------------------------------------

function formatQuotaOutput(
  codex: CodexQuotaData | null,
  accounts: Array<{ name: string; data: OpenCodeGoData | null }>,
): string {
  const activeName = currentAccount()?.name;
  const blocks: string[] = [];

  if (codex) {
    blocks.push(formatCodexFullDetail(codex).join("\n"));
  }

  for (const account of accounts) {
    if (account.data) {
      blocks.push(
        formatOpenCodeFullDetail(
          account.data,
          account.name,
          account.name === activeName,
        ).join("\n"),
      );
    }
  }

  return blocks.join("\n\n");
}

async function handleQuotaCommand(
  _args: string,
  ctx: ExtensionContext,
): Promise<void> {
  const commandLogger = getLogger(ctx);
  const [codexData, ...accountResults] = await withQuotaNotification(
    ctx,
    async () => {
      const accounts =
        rotationConfig?.accounts ??
        (await loadProviderConfig(OPENCODE_PROVIDER));

      commandLogger.log("quota_command", {
        provider: OPENCODE_PROVIDER,
        accountCount: accounts.length,
        currentAccount: currentAccount()?.name,
      });

      return Promise.all([
        retryNullable(() => fetchCodexQuotaStatus(ctx, commandLogger), {
          maxAttempts: FETCH_RETRY_ATTEMPTS,
          initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
        }),
        ...accounts.map((account) =>
          retryNullable(
            () =>
              fetchOpenCodeGoData(
                account.name,
                account.workspaceEnv,
                account.cookieEnv,
                commandLogger,
              ),
            {
              maxAttempts: FETCH_RETRY_ATTEMPTS,
              initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
            },
          ).then((data) => ({ name: account.name, data })),
        ),
      ]);
    },
  );

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
  pi.on("session_start", handleSessionStart);
  pi.on("turn_start", handleTurnStart);
  pi.on("message_end", makeMessageEndHandler(pi));
  pi.on("session_shutdown", handleSessionShutdown);

  pi.registerCommand("quota", {
    description: "Show detailed quota information",
    handler: handleQuotaCommand,
  });
}
