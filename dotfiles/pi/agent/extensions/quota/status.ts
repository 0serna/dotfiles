import { clampPercent } from "./formatting.js";
import type { CodexUsageWindow } from "./types.js";

// ---------------------------------------------------------------------------
// Re-exports: shared formatting utilities (now in formatting.ts)
// ---------------------------------------------------------------------------

export {
  clampPercent,
  formatRelativeExpiry,
  formatResetTime,
} from "./formatting.js";

// ---------------------------------------------------------------------------
// Codex-specific helpers
// ---------------------------------------------------------------------------

export function toRemainingPercent(
  window: CodexUsageWindow | undefined,
): number | undefined {
  if (window == null) return undefined;
  if (typeof window.remaining_percent === "number") {
    return clampPercent(window.remaining_percent);
  }
  if (typeof window.used_percent === "number") {
    return clampPercent(100 - window.used_percent);
  }
  return undefined;
}

export function parseCredits(
  balance: number | string | undefined,
  unlimited: boolean | undefined,
): number | undefined {
  if (unlimited) return undefined;
  const value = typeof balance === "number" ? balance : Number(balance);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}
