import type {
  SourceDescriptor,
  SourceExtras,
  SourceWindow,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

/**
 * Per-adapter fetch input. The `credentials` object is opaque to the
 * coordinator; adapters must not include it in any persisted state.
 */
export type AdapterFetchInput = {
  /** Provider id of the source to fetch. */
  providerId: string;
  /** Provider-specific source identifier. */
  sourceId: string;
  /** Stable non-secret fingerprint of the declared source configuration. */
  configFingerprint?: string;
  /** Opaque, in-memory only credentials/config. Never serialized. */
  credentials?: unknown;
};

/** Result returned by an adapter fetch attempt. */
export type AdapterResult =
  | {
      state: "ok";
      windows: {
        rolling?: SourceWindow;
        weekly?: SourceWindow;
        monthly?: SourceWindow;
      };
      extras?: SourceExtras;
    }
  | { state: "skipped"; reason: string }
  | { state: "error"; reason: string; message?: string };

/** Function that describes a declared source. */
export type DescribeSource = (input: AdapterFetchInput) => SourceDescriptor;

/** Function that performs one abort-aware fetch attempt. */
export type FetchAttempt = (
  input: AdapterFetchInput,
  signal: AbortSignal,
  logger: AdapterLogger,
) => Promise<AdapterResult>;

/** Minimal logger surface exposed to adapters. */
export type AdapterLogger = {
  log(event: string, data?: Record<string, unknown>): void;
};

/** Internal provider-adapter contract. */
export type QuotaAdapter = {
  /** Stable provider identifier. */
  providerId: string;
  /** Build a non-secret descriptor for a declared source. */
  describe: DescribeSource;
  /** Perform a single abort-aware fetch attempt. */
  fetch: FetchAttempt;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapters: QuotaAdapter[] = [];

/** Register a new adapter. Throws when the same provider is registered twice. */
export function registerAdapter(adapter: QuotaAdapter): void {
  if (adapters.some((existing) => existing.providerId === adapter.providerId)) {
    throw new Error(`quota adapter already registered: ${adapter.providerId}`);
  }
  adapters.push(adapter);
}

/** Return a registered adapter by provider id, or undefined. */
export function getAdapter(providerId: string): QuotaAdapter | undefined {
  return adapters.find((adapter) => adapter.providerId === providerId);
}

/** Return every registered adapter in registration order. */
export function listAdapters(): QuotaAdapter[] {
  return [...adapters];
}

/** Reset the registry. Intended for tests. */
export function resetAdapterRegistry(): void {
  adapters.length = 0;
}
