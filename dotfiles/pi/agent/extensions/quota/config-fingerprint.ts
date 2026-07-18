import { createHash } from "node:crypto";
import {
  detectConfigConflict,
  ensureDescriptor,
} from "./snapshot-transitions.js";
import {
  type QuotaSnapshot,
  SNAPSHOT_VERSION,
  type SourceDescriptor,
  type SourceRecord,
  sourceKey,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfigurationFingerprintInput = {
  providerId: string;
  sourceId: string;
  accountName: string;
  workspaceEnv?: string;
  cookieEnv?: string;
};

/** Stable, non-secret descriptor of a provider/account configuration. */
export type ConfigurationFingerprint = string;

// ---------------------------------------------------------------------------
// Fingerprint construction
// ---------------------------------------------------------------------------

/** Build a stable fingerprint from non-secret configuration attributes. */
export function buildConfigurationFingerprint(
  input: ConfigurationFingerprintInput,
): ConfigurationFingerprint {
  const parts = [
    input.providerId,
    input.sourceId,
    input.accountName,
    input.workspaceEnv ?? "",
    input.cookieEnv ?? "",
  ];
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

/**
 * Reconcile a snapshot against the locally declared descriptors:
 * - Insert an unavailable record for new sources.
 * - Keep the shared observation when fingerprints match.
 * - Record a conflict when the local descriptor disagrees but the shared
 *   observation is still valid; never replace a valid observation with
 *   missing local configuration.
 * - Remove sources that are no longer declared locally.
 */
export function reconcileSnapshot(
  snapshot: QuotaSnapshot,
  localDescriptors: SourceDescriptor[],
): QuotaSnapshot {
  const next: QuotaSnapshot = {
    ...snapshot,
    version: SNAPSHOT_VERSION,
    sources: { ...snapshot.sources },
  };

  const localKeys = new Set<string>();
  for (const descriptor of localDescriptors) {
    const key = sourceKey(descriptor.identity);
    localKeys.add(key);

    const existing = next.sources[key];
    if (!existing) {
      const inserted = ensureDescriptor(next, descriptor);
      next.sources = { ...inserted.sources };
      next.revision = inserted.revision;
      continue;
    }

    const conflict = detectConfigConflict(next, descriptor);
    if (conflict) {
      const current = next.sources[key]!;
      const hasValidObservation =
        current.state !== "unavailable" && current.windows !== undefined;
      if (hasValidObservation) {
        next.sources[key] = {
          ...current,
          configConflict: conflict,
        };
        next.revision += 1;
      } else {
        const refreshed = ensureDescriptor(next, descriptor);
        next.sources = { ...refreshed.sources };
        next.revision = refreshed.revision;
      }
    } else if (existing.configConflict) {
      next.sources[key] = { ...existing, configConflict: undefined };
      next.revision += 1;
    }
  }

  // Remove orphan sources.
  for (const key of Object.keys(next.sources)) {
    if (!localKeys.has(key)) {
      const record: SourceRecord | undefined = next.sources[key];
      if (record) {
        delete next.sources[key];
        next.revision += 1;
      }
    }
  }

  return next;
}
