import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AUTO_CONTINUE_REQUEST_EVENT,
  type AutoContinueRequest,
} from "../auto-continue/contract.js";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import {
  createAccountSelection,
  type AccountSelection,
  type AccountSelectionOutcome,
} from "./account-selection.js";
import {
  codexAdapter,
  type CodexAdapterCredentials,
} from "./adapters/codex-adapter.js";
import {
  opencodeGoAdapter,
  type OpenCodeAdapterCredentials,
} from "./adapters/opencode-adapter.js";
import { buildConfigurationFingerprint } from "./config-fingerprint.js";
import { formatQuotaDetail } from "./quota-detail.js";
import {
  createQuotaRefresh,
  type QuotaRefresh,
  type SourceInput,
} from "./quota-refresh.js";
import type { QuotaSnapshot } from "./snapshot.js";
import type {
  AccountConfig,
  ExtensionContext,
  ProviderAccountConfig,
} from "./types.js";

const OPENCODE_PROVIDER = "opencode-go";
const CODEX_PROVIDER = "openai-codex";
const STATUS_KEY = "quota";

let accountSelection: AccountSelection | undefined;
let quotaRefresh: QuotaRefresh | undefined;
let logger: ExtensionLogger | undefined;
let activeOpenCodeApiKey: string | undefined;
let activeOpenCodeAccount: string | undefined;

async function loadProviderConfig(provider: string): Promise<AccountConfig[]> {
  try {
    const configPath = join(import.meta.dirname ?? ".", "accounts.json");
    const parsed = JSON.parse(
      await readFile(configPath, "utf8"),
    ) as ProviderAccountConfig[];
    return parsed.find((entry) => entry.provider === provider)?.accounts ?? [];
  } catch {
    return [];
  }
}

export async function buildSnapshotSources(
  ctx: ExtensionContext,
  log: ExtensionLogger,
  accounts: ReadonlyArray<AccountConfig> = [],
): Promise<SourceInput[]> {
  const inputs: SourceInput[] = [];
  const codexToken =
    await ctx.modelRegistry.getApiKeyForProvider(CODEX_PROVIDER);
  const codexCredentials: CodexAdapterCredentials | undefined =
    codexToken?.trim() ? { accessToken: codexToken.trim() } : undefined;
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
  if (!codexCredentials)
    log.log("codex_auth_missing", { provider: CODEX_PROVIDER });

  for (const account of accounts) {
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

function isQuotaExhaustionError(message?: string): boolean {
  return message?.includes("GoUsageLimitError") ?? false;
}

function bindOpenCodeAccount(
  accountName: string,
  apiKey: string,
  pi: ExtensionAPI,
): void {
  activeOpenCodeAccount = accountName;
  activeOpenCodeApiKey = apiKey;
  pi.registerProvider(OPENCODE_PROVIDER, { apiKey });
}

function applyActiveOpenCodeAuthorization(
  headers: Record<string, string | null>,
): void {
  if (!activeOpenCodeApiKey) return;
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === "authorization") delete headers[name];
  }
  headers.Authorization = `Bearer ${activeOpenCodeApiKey}`;
  logger?.log("request_auth_applied", {
    provider: OPENCODE_PROVIDER,
    account: activeOpenCodeAccount,
  });
}

async function applyOutcomes(
  outcomes: ReadonlyArray<AccountSelectionOutcome>,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  for (const outcome of outcomes) {
    switch (outcome.type) {
      case "activate-account":
        bindOpenCodeAccount(outcome.accountName, outcome.apiKey, pi);
        quotaRefresh?.setActiveSource(outcome.source);
        break;
      case "clear-account":
        activeOpenCodeApiKey = undefined;
        activeOpenCodeAccount = undefined;
        pi.unregisterProvider(OPENCODE_PROVIDER);
        quotaRefresh?.setActiveSource(undefined);
        break;
      case "notify":
        if (ctx.hasUI) ctx.ui.notify(outcome.message, outcome.level);
        break;
      case "log":
        logger?.log(outcome.event, outcome.data);
        break;
      case "request-continuation": {
        const request: AutoContinueRequest = {
          reason: outcome.reason,
          origin: { provider: OPENCODE_PROVIDER },
        };
        logger?.log("continuation_requested", {
          provider: OPENCODE_PROVIDER,
          currentAccount: accountSelection?.activeAccountName(),
          reason: request.reason,
        });
        pi.events.emit(AUTO_CONTINUE_REQUEST_EVENT, request);
        break;
      }
    }
  }
}

async function startSession(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  logger = createExtensionLogger(ctx, "quota");
  activeOpenCodeApiKey = undefined;
  activeOpenCodeAccount = undefined;
  const accounts = await loadProviderConfig(OPENCODE_PROVIDER);
  accountSelection = createAccountSelection({ accounts });
  logger.log("session_start", {
    provider: OPENCODE_PROVIDER,
    configuredAccounts: accounts.length,
  });

  quotaRefresh = createQuotaRefresh({
    logger,
    adapters: [codexAdapter, opencodeGoAdapter],
  });
  quotaRefresh.onSnapshot((snapshot) => {
    if (!accountSelection) return;
    void applyOutcomes(
      accountSelection.handle({
        type: "snapshot-revision",
        snapshot,
      }),
      pi,
      ctx,
    );
  });
  await quotaRefresh.start({
    sources: await buildSnapshotSources(ctx, logger, accounts),
    registerStatus: (value) => ctx.ui.setStatus(STATUS_KEY, value),
    colorize: (intent, text) => ctx.ui.theme.fg(intent, text),
  });
  const snapshot = await quotaRefresh.read();
  await applyOutcomes(
    accountSelection.handle({ type: "startup", snapshot, now: Date.now() }),
    pi,
    ctx,
  );
}

async function shutdownSession(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  if (accountSelection) {
    await applyOutcomes(accountSelection.handle({ type: "shutdown" }), pi, ctx);
  }
  await quotaRefresh?.shutdown();
  ctx.ui.setStatus(STATUS_KEY, undefined);
  accountSelection = undefined;
  quotaRefresh = undefined;
  activeOpenCodeApiKey = undefined;
  activeOpenCodeAccount = undefined;
  logger = undefined;
}

async function showQuota(ctx: ExtensionContext): Promise<void> {
  const snapshot: QuotaSnapshot | undefined = await quotaRefresh?.read();
  if (!snapshot || Object.keys(snapshot.sources).length === 0) {
    if (ctx.hasUI) ctx.ui.notify("No quota data available yet", "info");
    return;
  }
  const output = formatQuotaDetail(snapshot, {
    activeSource: accountSelection?.activeSource(),
  });
  if (ctx.hasUI) ctx.ui.notify(output, "info");
}

export default function quotaExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => startSession(pi, ctx));
  pi.on("turn_start", async (_event, ctx) => {
    if (accountSelection)
      await applyOutcomes(
        accountSelection.handle({ type: "turn-start" }),
        pi,
        ctx,
      );
  });
  pi.on("agent_settled", async (_event, ctx) => {
    if (!accountSelection) return;
    await applyOutcomes(
      accountSelection.handle({
        type: "processing-settled",
        idle: ctx.isIdle(),
        now: Date.now(),
      }),
      pi,
      ctx,
    );
  });
  pi.on("before_provider_headers", (event, ctx) => {
    if (ctx.model?.provider !== OPENCODE_PROVIDER) return;
    applyActiveOpenCodeAuthorization(event.headers);
  });
  pi.on("message_end", async (event, ctx) => {
    if (
      ctx.model?.provider !== OPENCODE_PROVIDER ||
      event.message.role !== "assistant" ||
      event.message.stopReason !== "error" ||
      !isQuotaExhaustionError(event.message.errorMessage) ||
      !accountSelection
    ) {
      return;
    }
    await applyOutcomes(
      accountSelection.handle({
        type: "provider-exhausted",
        now: Date.now(),
      }),
      pi,
      ctx,
    );
  });
  pi.on("session_shutdown", async (_event, ctx) => shutdownSession(pi, ctx));
  pi.registerCommand("quota", {
    description: "Show detailed quota information",
    handler: async (_args, ctx) => showQuota(ctx),
  });
}
