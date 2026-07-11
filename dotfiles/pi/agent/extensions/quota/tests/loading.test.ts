import { describe, expect, it, vi } from "vitest";
import { withQuotaNotification } from "../loading.js";
import type { ExtensionContext } from "../types.js";

describe("withQuotaNotification", () => {
  it("shows a fetching notification before success", async () => {
    const ctx = makeContext();

    await expect(withQuotaNotification(ctx, async () => "done")).resolves.toBe(
      "done",
    );

    expect(ctx.ui.notify).toHaveBeenCalledWith("Fetching quota…", "info");
  });

  it("shows a fetching notification before failure", async () => {
    const ctx = makeContext();
    const failure = new Error("network failure");

    await expect(
      withQuotaNotification(ctx, async () => Promise.reject(failure)),
    ).rejects.toBe(failure);

    expect(ctx.ui.notify).toHaveBeenCalledWith("Fetching quota…", "info");
  });

  it("does not notify when UI is unavailable", async () => {
    const ctx = makeContext(false);

    await withQuotaNotification(ctx, async () => undefined);

    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });
});

function makeContext(hasUI = true): ExtensionContext {
  return {
    hasUI,
    ui: {
      notify: vi.fn(),
    },
  } as unknown as ExtensionContext;
}
