import { failureDetails } from "../../shared/diagnostics.ts";
import type {
  AdapterLogger,
  AdapterResult,
  QuotaAdapter,
} from "../adapter-registry.js";
import type { SourceDescriptor, SourceWindow } from "../snapshot.js";
import { clampPercent } from "../status.js";
import type { OpenCodeGoData, OpenCodeGoWindowData } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GO_DASHBOARD_URL = "https://opencode.ai/workspace";
const PROVIDER_ID = "opencode-go";
const REQUEST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export type OpenCodeAdapterCredentials = {
  workspaceId: string;
  authCookie: string;
};

// ---------------------------------------------------------------------------
// Dashboard fetch
// ---------------------------------------------------------------------------

async function fetchGoDashboardHtml(
  workspaceId: string,
  authCookie: string,
  signal: AbortSignal,
  logger: AdapterLogger,
): Promise<string | null> {
  try {
    const response = await fetch(`${GO_DASHBOARD_URL}/${workspaceId}/go`, {
      headers: { Cookie: `auth=${authCookie}` },
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ]),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    logger.log("go_fetch_error", {
      ...failureDetails(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML parsing (private)
// ---------------------------------------------------------------------------

function toWindow(
  parsed: OpenCodeGoWindowData | undefined,
  now: number,
): SourceWindow | undefined {
  if (!parsed) return undefined;
  return {
    remainingPercent: parsed.remainingPercent,
    resetAt: Math.floor(now / 1000) + parsed.resetInSec,
  };
}

function toWindowData(
  usagePercent: number,
  resetInSec: number,
): OpenCodeGoWindowData {
  return {
    remainingPercent: clampPercent(100 - usagePercent),
    resetInSec,
  };
}

function parseGoHydrationWindow(
  html: string,
  key: string,
): OpenCodeGoWindowData | undefined {
  const match = new RegExp(`${key}:\\$R\\[\\d+\\]=\\{([^}]*)\\}`).exec(html);
  const body = match?.[1];
  if (!body) return undefined;
  const usagePercent = /\busagePercent:(\d+(?:\.\d+)?)/.exec(body)?.[1];
  const resetInSec = /\bresetInSec:(\d+(?:\.\d+)?)/.exec(body)?.[1];
  if (usagePercent == null || resetInSec == null) return undefined;
  return toWindowData(Number(usagePercent), Number(resetInSec));
}

function parseGoHydrationLiterals(html: string): OpenCodeGoData {
  const data: OpenCodeGoData = {};
  data.rolling = parseGoHydrationWindow(html, "rollingUsage");
  data.weekly = parseGoHydrationWindow(html, "weeklyUsage");
  data.monthly = parseGoHydrationWindow(html, "monthlyUsage");
  const balance = /\bbalance:(\d+)/.exec(html);
  if (balance?.[1]) {
    data.balanceDollars = rawBalanceToDollars(Number(balance[1]));
  }
  return data;
}

function findJsonContainingKeys(text: string, keys: string[]): string[] {
  const results: string[] = [];
  let start = 0;
  while (start < text.length) {
    const braceStart = text.indexOf("{", start);
    if (braceStart === -1) break;
    const snippet = text.slice(braceStart, braceStart + 5_000);
    const hasKey = keys.some((k) => snippet.includes(`"${k}"`));
    if (!hasKey) {
      start = braceStart + 1;
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;
    results.push(text.slice(braceStart, end));
    start = end;
  }
  return results;
}

function isUsageWindow(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>)["usagePercent"] === "number" &&
    typeof (v as Record<string, unknown>)["resetInSec"] === "number"
  );
}

function rawBalanceToDollars(raw: number): number {
  return Math.round((raw / 100_000_000) * 100) / 100;
}

function extractGoData(
  obj: unknown,
  depth = 0,
): Partial<OpenCodeGoData> | null {
  if (depth > 15 || typeof obj !== "object" || obj === null) return null;
  const result: Partial<OpenCodeGoData> = {};
  for (const [key, value] of Object.entries(obj)) {
    const usageKey =
      key === "rollingUsage"
        ? "rolling"
        : key === "weeklyUsage"
          ? "weekly"
          : key === "monthlyUsage"
            ? "monthly"
            : null;
    if (usageKey && isUsageWindow(value)) {
      result[usageKey] = toWindowData(
        value["usagePercent"] as number,
        value["resetInSec"] as number,
      );
    } else if (key === "balance" && typeof value === "number") {
      result.balanceDollars = rawBalanceToDollars(value);
    } else if (typeof value === "object" && value !== null) {
      const nested = extractGoData(value, depth + 1);
      if (nested) Object.assign(result, nested);
    }
  }
  return result.rolling ||
    result.weekly ||
    result.monthly ||
    result.balanceDollars != null
    ? result
    : null;
}

function parseGoDashboard(html: string): OpenCodeGoData | null {
  const data = parseGoHydrationLiterals(html);
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const content = scriptMatch[1]!;
    const candidates = findJsonContainingKeys(content, [
      "rollingUsage",
      "weeklyUsage",
      "monthlyUsage",
      "balance",
    ]);
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const extracted = extractGoData(parsed);
        if (extracted) Object.assign(data, extracted);
      } catch {
        // skip unparseable candidate
      }
    }
    if (data.rolling || data.weekly || data.monthly) break;
  }
  return data.rolling ||
    data.weekly ||
    data.monthly ||
    data.balanceDollars != null
    ? data
    : null;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const opencodeGoAdapter: QuotaAdapter = {
  providerId: PROVIDER_ID,

  describe(input): SourceDescriptor {
    return {
      identity: {
        providerId: PROVIDER_ID,
        sourceId: `${PROVIDER_ID}:${input.sourceId}`,
      },
      displayName: `OpenCode ${input.sourceId}`,
      compactPrefix: "OC",
      configFingerprint:
        input.configFingerprint ?? `fingerprint:opencode-go:${input.sourceId}`,
    };
  },

  async fetch(input, signal, logger): Promise<AdapterResult> {
    const credentials = input.credentials as
      | Partial<OpenCodeAdapterCredentials>
      | undefined;
    const workspaceId = credentials?.workspaceId?.trim();
    const authCookie = credentials?.authCookie?.trim();

    if (!workspaceId || !authCookie) {
      return {
        state: "skipped",
        reason: "config_missing",
      };
    }

    const html = await fetchGoDashboardHtml(
      workspaceId,
      authCookie,
      signal,
      logger,
    );
    if (!html) {
      logger.log("go_fetch_failed", { reason: "no html" });
      return { state: "error", reason: "fetch_failed" };
    }

    const parsed = parseGoDashboard(html);
    if (!parsed) {
      logger.log("go_parse_failed", { reason: "no matching data found" });
      return { state: "error", reason: "parse_failed" };
    }

    const now = Date.now();
    logger.log("go_fetch_succeeded", {
      hasRolling: parsed.rolling != null,
      hasWeekly: parsed.weekly != null,
      hasMonthly: parsed.monthly != null,
      hasBalance: parsed.balanceDollars != null,
    });

    return {
      state: "ok",
      windows: {
        rolling: toWindow(parsed.rolling, now),
        weekly: toWindow(parsed.weekly, now),
        monthly: toWindow(parsed.monthly, now),
      },
      extras: {
        balanceDollars: parsed.balanceDollars,
      },
    };
  },
};
