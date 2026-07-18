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
