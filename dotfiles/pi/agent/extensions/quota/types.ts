import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

export type CodexUsageWindow = {
  used_percent?: number;
  remaining_percent?: number;
  reset_after_seconds?: number;
  reset_at?: number;
  limit_window_seconds?: number;
};

export type CodexUsageResponse = {
  rate_limit?: {
    primary_window?: CodexUsageWindow;
    secondary_window?: CodexUsageWindow;
  };
  rate_limits?: {
    primary_window?: CodexUsageWindow;
    secondary_window?: CodexUsageWindow;
  };
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: number | string;
  };
};

export type CodexQuotaData = {
  remaining5h?: number;
  remaining7d?: number;
  remainingCredits?: number;
  resetAt5h?: number;
  resetAt7d?: number;
};

export type OpenCodeGoWindowData = {
  remainingPercent: number;
  resetInSec: number;
};

export type OpenCodeGoData = {
  rolling?: OpenCodeGoWindowData;
  weekly?: OpenCodeGoWindowData;
  monthly?: OpenCodeGoWindowData;
  balanceDollars?: number;
};

export type UsageQuotaStatus = {
  codex: CodexQuotaData | null;
  codexError: string | null;
  opencodeGo: OpenCodeGoData | null;
  opencodeGoError: string | null;
};
