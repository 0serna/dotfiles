import { stat } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { createKetchRunner } from "../ketch.js";
import { logger, textOf } from "./helpers.js";

const request = {
  surface: "search" as const,
  input: { query: "pi" },
  args: ["search", "pi", "--multi", "--limit", "5", "--json"],
  cwd: "/home/test",
};
const ctx = (hasUI = true) => ({ hasUI, ui: { notify: vi.fn() } });

function runner(result: {
  stdout?: string;
  stderr?: string;
  code?: number;
  killed?: boolean;
}) {
  const exec = vi.fn().mockResolvedValue({
    stdout: result.stdout ?? "{}",
    stderr: result.stderr ?? "",
    code: result.code ?? 0,
    killed: result.killed ?? false,
  });
  return { exec, run: createKetchRunner({ exec, getLogger: () => logger }) };
}

describe("Ketch runner", () => {
  it("passes valid JSON through and derives tolerant summary details", async () => {
    const { run } = runner({
      stdout: '{"results":[{"title":"one"},{"title":"two"}]}',
      stderr: "one backend failed",
    });
    const result = await run.run(request, undefined, ctx() as never);

    expect(textOf(result)).toBe(
      '{"results":[{"title":"one"},{"title":"two"}]}',
    );
    expect(result.details).toMatchObject({
      surface: "search",
      resultCount: 2,
      truncated: false,
    });
    expect(JSON.stringify(result.details)).not.toContain("one backend failed");
    expect(logger.log).toHaveBeenCalledWith(
      "request_succeeded",
      expect.objectContaining({ warning: "one backend failed" }),
    );
  });

  it.each([
    [2, "[validation]"],
    [3, "[not_found]"],
    [4, "[upstream]"],
    [5, "[precondition]"],
    [6, "[cancelled]"],
    [1, "[internal]"],
  ])("classifies exit code %i as %s", async (code, prefix) => {
    const { run } = runner({ code, stderr: "complete diagnostic" });
    await expect(run.run(request, undefined, ctx() as never)).rejects.toThrow(
      prefix,
    );
  });

  it("classifies killed or aborted execution as cancelled", async () => {
    const killed = runner({ code: 1, killed: true });
    await expect(
      killed.run.run(request, undefined, ctx() as never),
    ).rejects.toThrow("[cancelled]");

    const controller = new AbortController();
    controller.abort();
    const aborted = runner({ code: 1 });
    await expect(
      aborted.run.run(request, controller.signal, ctx() as never),
    ).rejects.toThrow("[cancelled]");
  });

  it("rejects empty or invalid successful output as internal", async () => {
    for (const stdout of ["", "not json"]) {
      const { run } = runner({ stdout });
      await expect(run.run(request, undefined, ctx() as never)).rejects.toThrow(
        "[internal]",
      );
    }
  });

  it("notifies only for precondition and internal failures with UI", async () => {
    for (const code of [5, 1, 4]) {
      const context = ctx();
      const { run } = runner({ code, stderr: "diagnostic" });
      await expect(
        run.run(request, undefined, context as never),
      ).rejects.toThrow();
      expect(context.ui.notify).toHaveBeenCalledTimes(code === 4 ? 0 : 1);
      if (code !== 4) {
        expect(context.ui.notify.mock.calls[0]?.[0].length).toBeLessThan(100);
      }
    }

    const noUi = ctx(false);
    const { run } = runner({ code: 5 });
    await expect(run.run(request, undefined, noUi as never)).rejects.toThrow();
    expect(noUi.ui.notify).not.toHaveBeenCalled();
  });

  it.each([
    ["bytes", JSON.stringify({ value: "x".repeat(55_000) })],
    [
      "lines",
      JSON.stringify(
        { value: Array.from({ length: 2_100 }, (_, index) => index) },
        null,
        2,
      ),
    ],
  ])(
    "truncates output exceeding the %s limit and persists it privately",
    async (_kind, stdout) => {
      const { run } = runner({ stdout });
      const result = await run.run(request, undefined, ctx() as never);
      const details = result.details;

      expect(details.truncated).toBe(true);
      expect(details.fullOutputPath).toEqual(expect.any(String));
      expect(textOf(result)).toContain(details.fullOutputPath as string);
      const mode = (await stat(details.fullOutputPath as string)).mode & 0o777;
      expect(mode).toBe(0o600);
      expect(JSON.stringify(details)).not.toContain(stdout.slice(0, 100));
      expect(details).not.toHaveProperty("stdout");
      expect(details).not.toHaveProperty("stderr");
      expect(details).not.toHaveProperty("snippet");
      expect(details).not.toHaveProperty("content");
    },
  );

  it("classifies temporary-output persistence failures as internal", async () => {
    const context = ctx();
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ value: "x".repeat(55_000) }),
      stderr: "",
      code: 0,
      killed: false,
    });
    const run = createKetchRunner({
      exec,
      getLogger: () => logger,
      writeOutput: vi.fn().mockRejectedValue(new Error("disk unavailable")),
    });

    await expect(run.run(request, undefined, context as never)).rejects.toThrow(
      "[internal]",
    );
    expect(context.ui.notify).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      "request_failed",
      expect.objectContaining({
        classification: "internal",
        diagnostic: "disk unavailable",
      }),
    );
  });

  it("keeps unknown JSON shapes as byte-only summaries", async () => {
    const { run } = runner({ stdout: '{"unexpected":{"shape":true}}' });
    const result = await run.run(request, undefined, ctx() as never);
    expect(result.details).toMatchObject({
      surface: "search",
      outputBytes: 29,
    });
    expect(result.details).not.toHaveProperty("resultCount");
  });
});
