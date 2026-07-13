import { beforeEach, describe, expect, it } from "vitest";
import {
  type AdapterFetchInput,
  type AdapterResult,
  type QuotaAdapter,
  getAdapter,
  listAdapters,
  registerAdapter,
  resetAdapterRegistry,
} from "../adapter-registry.js";

function makeAdapter(overrides: Partial<QuotaAdapter> = {}): QuotaAdapter {
  return {
    providerId: "test-provider",
    describe(input) {
      return {
        identity: { providerId: "test-provider", sourceId: input.sourceId },
        displayName: input.sourceId,
        compactPrefix: "Test",
        configFingerprint: `fingerprint:test:${input.sourceId}`,
      };
    },
    async fetch(): Promise<AdapterResult> {
      return { state: "ok", windows: {} };
    },
    ...overrides,
  };
}

describe("adapter registry", () => {
  beforeEach(resetAdapterRegistry);

  it("registers and looks up adapters by provider id", () => {
    const adapter = makeAdapter();
    registerAdapter(adapter);
    expect(getAdapter("test-provider")).toBe(adapter);
  });

  it("lists registered adapters in registration order", () => {
    const a = makeAdapter({ providerId: "a" });
    const b = makeAdapter({ providerId: "b" });
    registerAdapter(a);
    registerAdapter(b);
    expect(listAdapters()).toEqual([a, b]);
  });

  it("returns undefined for unknown providers", () => {
    expect(getAdapter("missing")).toBeUndefined();
  });
});

describe("adapter fetch input isolation", () => {
  beforeEach(resetAdapterRegistry);

  it("does not serialize the fetch input inside the adapter result", async () => {
    const adapter = makeAdapter({
      async fetch(input) {
        expect(input.credentials).toEqual({ secret: "value" });
        return { state: "ok", windows: {} };
      },
    });
    registerAdapter(adapter);
    const input: AdapterFetchInput = {
      providerId: "test-provider",
      sourceId: "codex-login",
      credentials: { secret: "value" } as never,
    };
    const result = await adapter.fetch(input, new AbortController().signal, {
      log: () => {},
    });
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.windows).toEqual({});
  });
});
