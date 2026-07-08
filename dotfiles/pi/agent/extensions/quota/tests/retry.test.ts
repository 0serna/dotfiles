import { describe, expect, it, vi } from "vitest";
import { retryNullable } from "../retry.js";

describe("retryNullable", () => {
  it("returns the first successful value without further retries", async () => {
    const operation = vi
      .fn<Parameters<typeof retryNullable<string>>[0]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("ok");
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryNullable(operation, { maxAttempts: 3, initialDelayMs: 5000 }, delay),
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(5000);
  });

  it("uses incremental delays between three total attempts", async () => {
    const operation = vi.fn().mockResolvedValue(null);
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryNullable(operation, { maxAttempts: 3, initialDelayMs: 5000 }, delay),
    ).resolves.toBeNull();

    expect(operation).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 5000);
    expect(delay).toHaveBeenNthCalledWith(2, 10000);
  });

  it("retries thrown fetch errors and returns null only after all attempts fail", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("network"));
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryNullable(operation, { maxAttempts: 3, initialDelayMs: 5000 }, delay),
    ).resolves.toBeNull();

    expect(operation).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 5000);
    expect(delay).toHaveBeenNthCalledWith(2, 10000);
  });
});
