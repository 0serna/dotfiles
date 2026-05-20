import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { UsageQuotaStatus } from "./types.js";

const CACHE_FILE = "/tmp/pi-quota-cache.json";

export async function readCache(): Promise<UsageQuotaStatus | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as UsageQuotaStatus;
  } catch {
    return null;
  }
}

export function writeCache(status: UsageQuotaStatus): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(status), "utf8");
  } catch {
    return;
  }
}
