// ---------------------------------------------------------------------------
// Snapshot domain types
// ---------------------------------------------------------------------------

/** Current persisted snapshot schema version. Bump on incompatible changes. */
export const SNAPSHOT_VERSION = 1;

/** Stable, non-secret identifier for a quota source. */
export type SourceIdentity = {
  /** Provider that owns the source (e.g. "openai-codex", "opencode-go"). */
  providerId: string;
  /** Provider-specific source identifier (e.g. account name, "codex-login"). */
  sourceId: string;
};

/** Persistable, non-secret source description. */
export type SourceDescriptor = {
  identity: SourceIdentity;
  /** Long display name used in detailed output (e.g. "OpenCode 1"). */
  displayName: string;
  /** Short prefix used in compact status (e.g. "Codex", "OpenCode"). */
  compactPrefix: string;
  /** Stable fingerprint derived from non-secret configuration. */
  configFingerprint: string;
};

/** A single quota window with an absolute reset timestamp. */
export type SourceWindow = {
  /** Remaining percentage, 0..100. */
  remainingPercent: number;
  /** Absolute reset timestamp in seconds since the epoch. */
  resetAt: number;
};

/** Provider-confirmed exhaustions and partial-issue state for a source. */
export type SourceExtras = {
  /** Codex-style absolute credits. */
  credits?: number;
  /** Codex banked-reset state. `unknown` means the reset endpoint could not be reached. */
  bankedResets?: BankedResetState;
  /** OpenCode-style spendable balance in dollars. */
  balanceDollars?: number;
};

/** Codex banked-reset state. */
export type BankedResetState =
  | { kind: "available"; details: BankedResetDetail[] }
  | { kind: "empty" }
  | { kind: "unavailable" };

export type BankedResetDetail = {
  /** Absolute expiry timestamp in seconds. */
  expiresAt: number;
  grantedAt: number;
  status: string;
};

/** Source-level failure metadata. */
export type SourceFailure = {
  /** Short reason code, e.g. "fetch_failed", "auth_missing", "config_missing". */
  reason: string;
  /** Last attempt timestamp in milliseconds. */
  at: number;
  /** Attempt count in the most recent refresh cycle. */
  attempts: number;
  /** Optional human-readable summary suitable for `/quota` detail. */
  message?: string;
};

/** Source-level provider-confirmed exhaustion evidence. */
export type SourceExhaustion = {
  /** Absolute confirmation timestamp in milliseconds. */
  confirmedAt: number;
  /** Source identifier that reported the exhaustion. */
  reportedBy: string;
};

/** Lifecycle state for a single source. */
export type SourceState =
  | "refreshing"
  | "fresh"
  | "degraded"
  | "expired"
  | "unavailable"
  | "exhausted";

/** A single source record inside the aggregated snapshot. */
export type SourceRecord = {
  identity: SourceIdentity;
  descriptor: SourceDescriptor;
  state: SourceState;
  /** Last observation timestamp in milliseconds. */
  observedAt: number;
  /** Last successful observation timestamp in milliseconds. */
  lastSuccessAt: number;
  /** Available quota windows; presence implies a non-null observation. */
  windows?: {
    rolling?: SourceWindow;
    weekly?: SourceWindow;
    monthly?: SourceWindow;
  };
  extras?: SourceExtras;
  /** Last failure metadata retained for the 30-minute window. */
  failure?: SourceFailure;
  /** Provider-confirmed exhaustion evidence. */
  providerExhaustion?: SourceExhaustion;
  /** Configuration conflict between this process and the shared snapshot. */
  configConflict?: string;
};

/** Metadata describing the last full refresh cycle. */
export type CycleMetadata = {
  /** When the most recent refresh started. */
  cycleStartedAt: number;
  /** When the most recent refresh completed. Undefined while in flight. */
  lastCompletedAt?: number;
};

/** A versioned aggregated quota snapshot shared across Pi processes. */
export type QuotaSnapshot = {
  version: number;
  /** Monotonically increasing revision counter. */
  revision: number;
  cycle: CycleMetadata;
  /** Source records keyed by their stable key. */
  sources: Record<string, SourceRecord>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the canonical key for a source identity. */
export function sourceKey(identity: SourceIdentity): string {
  return `${identity.providerId}/${identity.sourceId}`;
}
