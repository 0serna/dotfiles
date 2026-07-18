import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

// ---------------------------------------------------------------------------
// Account configuration
// ---------------------------------------------------------------------------

export type AccountConfig = {
  name: string;
  apiKeyEnv: string;
  workspaceEnv: string;
  cookieEnv: string;
};

export type ProviderAccountConfig = {
  provider: string;
  accounts: AccountConfig[];
};

// ---------------------------------------------------------------------------
// Rotation state
// ---------------------------------------------------------------------------

export type AccountStatus = "rate-limited" | "unauthorized" | "untried";

export type AccountState = {
  name: string;
  apiKey: string;
  lastStatus: AccountStatus;
  cooldownUntil: number;
  failures: number;
};

export type RotationConfig = {
  accounts: AccountConfig[];
  cooldownMs: number;
};

// ---------------------------------------------------------------------------
// Codex types
// ---------------------------------------------------------------------------

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
};

export type CodexResetCredit = {
  status?: string;
  reset_type?: string;
  granted_at?: string;
  expires_at?: string;
  redeemed_at?: string | null;
};

export type CodexResetCreditsResponse = {
  available_count?: number;
  credits?: CodexResetCredit[];
};

// ---------------------------------------------------------------------------
// OpenCode Go types
// ---------------------------------------------------------------------------

export type OpenCodeGoWindowData = {
  remainingPercent: number;
  resetInSec: number;
};

export type OpenCodeGoData = {
  rolling?: OpenCodeGoWindowData;
  weekly?: OpenCodeGoWindowData;
  monthly?: OpenCodeGoWindowData;
};
