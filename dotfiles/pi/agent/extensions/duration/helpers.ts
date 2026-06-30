/** Minimal session entry shape needed for duration inference. */
export interface SessionEntry {
  type: string;
  timestamp: string;
  message?: {
    role: string;
  };
}

/**
 * Format a duration in milliseconds to a compact human-readable string.
 *
 * - Under 60s: "Ns" (e.g. "5s", "42s")
 * - 60s or more: "Nm Ns" (e.g. "1m 23s", "2m 0s")
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Infer the latest completed user-to-generated-message duration from session entries.
 *
 * Looks for the most recent user message followed by at least one generated
 * message (assistant, tool_result, etc.) before the next user message.
 * Returns the duration in milliseconds, or null if no valid block is found.
 */
export function inferLastDuration(entries: SessionEntry[]): number | null {
  // Walk backwards: collect generated messages until we hit a user message.
  let latestGeneratedTimestamp: string | null = null;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    if (entry.type !== "message" || !entry.message) continue;

    const { role } = entry.message;

    if (role === "user") {
      if (latestGeneratedTimestamp !== null) {
        const userTime = new Date(entry.timestamp).getTime();
        const genTime = new Date(latestGeneratedTimestamp).getTime();
        if (genTime > userTime) {
          return genTime - userTime;
        }
      }
      // Reset: this user has no generated messages after it (yet)
      latestGeneratedTimestamp = null;
    } else {
      // Generated message — track the first one we see (latest chronologically)
      if (latestGeneratedTimestamp === null) {
        latestGeneratedTimestamp = entry.timestamp;
      }
    }
  }

  return null;
}
