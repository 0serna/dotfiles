import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { registerAdapter } from "./adapter-registry.js";
import {
  codexAdapter,
  type CodexAdapterCredentials,
} from "./adapters/codex-adapter.js";
import {
  opencodeGoAdapter,
  type OpenCodeAdapterCredentials,
} from "./adapters/opencode-adapter.js";
import { buildConfigurationFingerprint } from "./config-fingerprint.js";
import { type SourceInput } from "./coordinator.js";
import { createQuotaLifecycle, type QuotaLifecycle } from "./lifecycle.js";
import { formatQuotaDetail } from "./quota-detail.js";
import { decidePreventiveReselection } from "./reselection.js";
import {
  DEFAULT_COOLDOWN_MS,
  initAccountStates,
  isQuotaExhaustionError,
  markBad,
  pickNextAccount,
  type RotationReason,
} from "./rotation.js";
import { selectFromSnapshot as pickFromSnapshot } from "./snapshot-selection.js";
import type { QuotaSnapshot, SourceIdentity } from "./snapshot.js";
import {
  type AccountConfig,
  type AccountState,
  type ExtensionContext,
  type ProviderAccountConfig,
  type RotationConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENCODE_PROVIDER = "opencode-go";
const CODEX_PROVIDER = "openai-codex";
const STATUS_KEY = "quota";

registerAdapter(codexAdapter);
registerAdapter(opencodeGoAdapter);

// ---------------------------------------------------------------------------
// Module state (cleared on session_shutdown)
// ---------------------------------------------------------------------------

let rotationConfig: RotationConfig | undefined;
let accountStates: AccountState[] = [];
let currentAccountIndex = -1;
let continuationSentThisTurn = false;
let triedAccountsThisTurn: Set<string> = new Set();
let logger: ExtensionLogger | undefined;
let lifecycle: QuotaLifecycle | undefined;
let latestSnapshot: QuotaSnapshot | undefined;
let blindFallbackActive = false;
let pendingPreventiveReselection = false;

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
  lifecycle?.setActiveSource({
    providerId: OPENCODE_PROVIDER,
    sourceId: `${OPENCODE_PROVIDER}:${state.name}`,
  });
  getLogger(ctx).log("account_activated", {
    provider: OPENCODE_PROVIDER,
    account: state.name,
    index,
  });
  return true;
}

function selectFromSnapshot(
  snapshot: QuotaSnapshot,
  ctx: ExtensionContext,
): number {
  const now = Date.now();
  const result = pickFromSnapshot(
    snapshot,
    accountStates,
    rotationConfig?.accounts ?? [],
    now,
  );
  if (result >= 0) {
    const selected = accountStates[result];
    if (selected) {
      getLogger(ctx).log("snapshot_select_chosen", {
        provider: OPENCODE_PROVIDER,
        account: selected.name,
        stateIndex: result,
      });
    }
  }
  return result;
}

function activeSourceIdentity(): SourceIdentity | undefined {
  const active = currentAccount();
  return active
    ? {
        providerId: OPENCODE_PROVIDER,
        sourceId: `${OPENCODE_PROVIDER}:${active.name}`,
      }
    : undefined;
}

function applyPreventiveReselection(
  snapshot: QuotaSnapshot,
  ctx: ExtensionContext,
): void {
  const selectedIndex = selectFromSnapshot(snapshot, ctx);
  if (selectedIndex < 0) return;
  blindFallbackActive = false;
  pendingPreventiveReselection = false;
  if (selectedIndex !== currentAccountIndex) {
    activateAccount(selectedIndex, ctx);
    getLogger(ctx).log("preventive_reselection", {
      provider: OPENCODE_PROVIDER,
      account: currentAccount()?.name,
    });
  }
}

function handleSnapshotRevision(
  snapshot: QuotaSnapshot,
  ctx: ExtensionContext,
): void {
  latestSnapshot = snapshot;
  if (currentAccountIndex < 0) return;
  const decision = decidePreventiveReselection(snapshot, {
    activeSource: activeSourceIdentity(),
    piSettled: ctx.isIdle(),
    blindFallback: blindFallbackActive,
    now: Date.now(),
  });
  if (decision.reason === "agent_busy") {
    pendingPreventiveReselection = true;
    return;
  }
  if (decision.reselect) {
    applyPreventiveReselection(snapshot, ctx);
  }
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
// Source inputs
// ---------------------------------------------------------------------------

async function buildSnapshotSources(
  ctx: ExtensionContext,
  log: ExtensionLogger,
): Promise<SourceInput[]> {
  const inputs: SourceInput[] = [];

  const codexToken = await ctx.modelRegistry.authStorage
    .getApiKey(CODEX_PROVIDER)
    .catch(() => null);
  const codexCredentials: CodexAdapterCredentials | undefined =
    codexToken?.trim()
      ? {
          accessToken: codexToken.trim(),
        }
      : undefined;
  inputs.push({
    providerId: CODEX_PROVIDER,
    sourceId: "codex-login",
    configFingerprint: buildConfigurationFingerprint({
      providerId: CODEX_PROVIDER,
      sourceId: "codex-login",
      accountName: "codex-login",
    }),
    credentials: codexCredentials,
  });
  if (!codexCredentials) {
    log.log("codex_auth_missing", { provider: CODEX_PROVIDER });
  }

  for (const account of rotationConfig?.accounts ?? []) {
    const workspaceId = process.env[account.workspaceEnv]?.trim();
    const authCookie = process.env[account.cookieEnv]?.trim();
    const credentials: OpenCodeAdapterCredentials | undefined =
      workspaceId && authCookie ? { workspaceId, authCookie } : undefined;
    inputs.push({
      providerId: OPENCODE_PROVIDER,
      sourceId: account.name,
      configFingerprint: buildConfigurationFingerprint({
        providerId: OPENCODE_PROVIDER,
        sourceId: account.name,
        accountName: account.name,
        workspaceEnv: account.workspaceEnv,
        cookieEnv: account.cookieEnv,
      }),
      credentials,
    });
    if (!credentials) {
      log.log("opencode_config_missing", {
        provider: OPENCODE_PROVIDER,
        account: account.name,
      });
    }
  }
  return inputs;
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
  latestSnapshot = undefined;
  blindFallbackActive = false;
  pendingPreventiveReselection = false;

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
  }

  lifecycle = createQuotaLifecycle({
    logger,
  });
  lifecycle.onSnapshot((snapshot) => {
    handleSnapshotRevision(snapshot, ctx);
  });

  await lifecycle.start({
    sources: await buildSnapshotSources(ctx, logger),
    registerStatus: (value) => {
      if (value === undefined) {
        ctx.ui.setStatus(STATUS_KEY, undefined);
      } else {
        ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", value));
      }
    },
    activeSource: undefined,
  });

  if (accountStates.length > 0) {
    // Read the latest snapshot and select the best account, or fall back.
    const snapshot = latestSnapshot ?? (await lifecycle.read());
    latestSnapshot = snapshot;
    const selectionIndex = selectFromSnapshot(snapshot, ctx);
    const chosen = selectionIndex >= 0 ? selectionIndex : 0;
    activateAccount(chosen, ctx);
    blindFallbackActive = selectionIndex < 0;
    if (blindFallbackActive) {
      logger.log("session_start_blind_fallback", {
        provider: OPENCODE_PROVIDER,
        reason: "no usable snapshot observation, activating first account",
      });
    }
  }
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

    if (!isQuotaExhaustionError(msg.errorMessage)) return;

    const current = currentAccount();
    if (current && lifecycle) {
      const identity: SourceIdentity = {
        providerId: OPENCODE_PROVIDER,
        sourceId: `${OPENCODE_PROVIDER}:${current.name}`,
      };
      await lifecycle.coordinator().recordExhaustion(identity, {
        confirmedAt: Date.now(),
        reportedBy: ctx.sessionManager.getSessionId() ?? "unknown",
      });
    }

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

function handleAgentSettled(_event: unknown, ctx: ExtensionContext): void {
  if (!pendingPreventiveReselection || !latestSnapshot || !ctx.isIdle()) return;
  const decision = decidePreventiveReselection(latestSnapshot, {
    activeSource: activeSourceIdentity(),
    piSettled: true,
    blindFallback: blindFallbackActive,
    now: Date.now(),
  });
  if (decision.reselect) {
    applyPreventiveReselection(latestSnapshot, ctx);
  } else {
    pendingPreventiveReselection = false;
  }
}

async function handleSessionShutdown(
  _event: unknown,
  ctx: ExtensionContext,
): Promise<void> {
  ctx.modelRegistry.authStorage.removeRuntimeApiKey(OPENCODE_PROVIDER);
  if (lifecycle) {
    await lifecycle.shutdown();
  }
  ctx.ui.setStatus(STATUS_KEY, undefined);
  rotationConfig = undefined;
  accountStates = [];
  currentAccountIndex = -1;
  continuationSentThisTurn = false;
  triedAccountsThisTurn = new Set();
  latestSnapshot = undefined;
  blindFallbackActive = false;
  pendingPreventiveReselection = false;
  logger = undefined;
  lifecycle = undefined;
}

// ---------------------------------------------------------------------------
// /quota command
// ---------------------------------------------------------------------------

async function handleQuotaCommand(
  _args: string,
  ctx: ExtensionContext,
): Promise<void> {
  const snapshot =
    latestSnapshot ?? (lifecycle ? await lifecycle.read() : null);
  if (!snapshot || Object.keys(snapshot.sources).length === 0) {
    ctx.ui.notify("No quota data available yet", "info");
    return;
  }
  const activeName = currentAccount()?.name;
  const activeSource: SourceIdentity | undefined = activeName
    ? {
        providerId: OPENCODE_PROVIDER,
        sourceId: `${OPENCODE_PROVIDER}:${activeName}`,
      }
    : undefined;
  const output = formatQuotaDetail(snapshot, { activeSource });
  ctx.ui.notify(output, "info");
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.on("session_start", handleSessionStart);
  pi.on("turn_start", handleTurnStart);
  pi.on("agent_settled", handleAgentSettled);
  pi.on("message_end", makeMessageEndHandler(pi));
  pi.on("session_shutdown", handleSessionShutdown);

  pi.registerCommand("quota", {
    description: "Show detailed quota information",
    handler: handleQuotaCommand,
  });
}

export { buildSnapshotSources };
