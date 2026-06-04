import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import type { OpenCodeGoData, OpenCodeGoWindowData } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GO_DASHBOARD_URL = "https://opencode.ai/workspace";
const REQUEST_TIMEOUT_MS = 10000;
const GO_WORKSPACE_ID_ENV = "OPENCODE_GO_WORKSPACE_ID";
const GO_AUTH_COOKIE_ENV = "OPENCODE_GO_AUTH_COOKIE";

// ---------------------------------------------------------------------------
// Configuration check
// ---------------------------------------------------------------------------

function isGoConfigured(): boolean {
  return Boolean(
    process.env[GO_WORKSPACE_ID_ENV]?.trim() &&
    process.env[GO_AUTH_COOKIE_ENV]?.trim(),
  );
}

// ---------------------------------------------------------------------------
// Dashboard fetch
// ---------------------------------------------------------------------------

async function fetchGoDashboardHtml(
  logger: ExtensionLogger,
): Promise<string | null> {
  const workspaceId = process.env[GO_WORKSPACE_ID_ENV]?.trim();
  const authCookie = process.env[GO_AUTH_COOKIE_ENV]?.trim();
  if (!workspaceId || !authCookie) return null;
  try {
    const response = await fetch(`${GO_DASHBOARD_URL}/${workspaceId}/go`, {
      headers: {
        Cookie: `auth=${authCookie}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.log("go_fetch_failed", { status: response.status });
      return null;
    }
    return await response.text();
  } catch (error) {
    logger.log("go_fetch_error", failureDetails(error));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dashboard HTML parsing
// ---------------------------------------------------------------------------

/** Find and parse the hydration JSON blob embedded in the dashboard HTML. */
function parseGoDashboard(html: string): OpenCodeGoData | null {
  const data: OpenCodeGoData = parseGoHydrationLiterals(html) ?? {};

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

  return data.rolling || data.weekly || data.monthly ? data : null;
}

function parseGoHydrationLiterals(html: string): OpenCodeGoData | null {
  const data: OpenCodeGoData = {};
  data.rolling = parseGoHydrationWindow(html, "rollingUsage");
  data.weekly = parseGoHydrationWindow(html, "weeklyUsage");
  data.monthly = parseGoHydrationWindow(html, "monthlyUsage");

  const balance = /\bbalance:(\d+)/.exec(html);
  if (balance?.[1])
    data.balanceDollars = rawBalanceToDollars(Number(balance[1]));

  return data.rolling ||
    data.weekly ||
    data.monthly ||
    data.balanceDollars != null
    ? data
    : null;
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

  return {
    remainingPercent: Math.max(0, Math.min(100, 100 - Number(usagePercent))),
    resetInSec: Number(resetInSec),
  };
}

/** Find JSON substrings that contain all given keys (at any nesting). */
function findJsonContainingKeys(text: string, keys: string[]): string[] {
  const results: string[] = [];
  let start = 0;

  while (start < text.length) {
    const braceStart = text.indexOf("{", start);
    if (braceStart === -1) break;

    const snippet = text.slice(braceStart, braceStart + 5000);
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

/** Walk a parsed JSON object and extract OpenCode Go fields. */
function extractGoData(
  obj: unknown,
  depth = 0,
): Partial<OpenCodeGoData> | null {
  if (depth > 15 || typeof obj !== "object" || obj === null) return null;

  const result: Partial<OpenCodeGoData> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "rollingUsage" && isUsageWindow(value)) {
      result.rolling = usageWindowToData(value);
    } else if (key === "weeklyUsage" && isUsageWindow(value)) {
      result.weekly = usageWindowToData(value);
    } else if (key === "monthlyUsage" && isUsageWindow(value)) {
      result.monthly = usageWindowToData(value);
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

function isUsageWindow(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>)["usagePercent"] === "number" &&
    typeof (v as Record<string, unknown>)["resetInSec"] === "number"
  );
}

function usageWindowToData(w: Record<string, unknown>): OpenCodeGoWindowData {
  return {
    remainingPercent: Math.max(
      0,
      Math.min(100, 100 - (w["usagePercent"] as number)),
    ),
    resetInSec: w["resetInSec"] as number,
  };
}

function rawBalanceToDollars(raw: number): number {
  return Math.round((raw / 100_000_000) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch + parse OpenCode Go dashboard, returning structured data or null. */
export async function fetchOpenCodeGoData(
  logger: ExtensionLogger,
): Promise<OpenCodeGoData | null> {
  if (!isGoConfigured()) {
    logger.log("go_skipped", { reason: "not configured" });
    return null;
  }
  const html = await fetchGoDashboardHtml(logger);
  if (!html) {
    logger.log("go_fetch_failed", { reason: "no html" });
    return null;
  }
  const data = parseGoDashboard(html);
  if (!data) {
    logger.log("go_parse_failed", { reason: "no matching data found" });
    return null;
  }
  logger.log("go_fetch_succeeded", {
    hasRolling: data.rolling != null,
    hasWeekly: data.weekly != null,
    hasMonthly: data.monthly != null,
    hasBalance: data.balanceDollars != null,
  });
  return data;
}
