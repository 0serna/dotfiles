import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHarness, logger } from "./helpers.js";

vi.mock("../../shared/logger.js", () => ({
  createExtensionLogger: vi.fn(() => logger),
}));

const extensionFactory = (await import("../index.js")).default;

const expectedNames = ["web_search", "web_fetch", "web_code", "web_docs"];

describe("web extension lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("probes Ketch and registers exactly four curated tools", async () => {
    const harness = createHarness();
    await extensionFactory(harness.pi);

    expect(harness.exec).toHaveBeenCalledWith(
      "ketch",
      ["version"],
      expect.objectContaining({ cwd: expect.any(String) }),
    );
    expect(harness.tools.map((tool) => tool.name)).toEqual(expectedNames);
    for (const tool of harness.tools) {
      expect(tool).toMatchObject({
        description: expect.any(String),
        promptSnippet: expect.any(String),
        promptGuidelines: expect.any(Array),
        parameters: expect.any(Object),
      });
      expect(tool).not.toHaveProperty("executionMode");
      const schema = JSON.stringify(tool.parameters);
      for (const hidden of [
        "backend",
        "credential",
        "cookie",
        "cache",
        "browser",
        "regex",
        "selector",
        "version",
      ]) {
        expect(schema).not.toContain(hidden);
      }
    }
  });

  it("registers no tools after a failed probe and notifies only with UI", async () => {
    const harness = createHarness(async () => ({
      stdout: "",
      stderr: "not found",
      code: 1,
    }));
    await extensionFactory(harness.pi);
    expect(harness.tools).toEqual([]);

    await harness.emit("session_start");
    expect(harness.notify).toHaveBeenCalledOnce();

    harness.notify.mockClear();
    harness.ctx.hasUI = false;
    await harness.emit("session_start");
    expect(harness.notify).not.toHaveBeenCalled();
  });

  it("reevaluates availability when the extension factory reloads", async () => {
    let available = false;
    const harness = createHarness(async () => ({
      stdout: available ? "ketch test" : "",
      stderr: "",
      code: available ? 0 : 1,
    }));
    await extensionFactory(harness.pi);
    expect(harness.tools).toHaveLength(0);

    available = true;
    const reloaded = createHarness(async () => ({
      stdout: "ketch test",
      stderr: "",
      code: 0,
    }));
    await extensionFactory(reloaded.pi);
    expect(reloaded.tools.map((tool) => tool.name)).toEqual(expectedNames);
  });

  it("passes the tool abort signal without adding a timeout", async () => {
    const harness = createHarness(async (_command, args, options) => {
      if (args[0] === "version") return { stdout: "v1", stderr: "", code: 0 };
      expect(options).toMatchObject({ signal: expect.any(AbortSignal) });
      expect(options).not.toHaveProperty("timeout");
      return { stdout: "{}", stderr: "", code: 0 };
    });
    await extensionFactory(harness.pi);
    await harness.emit("session_start");
    const tool = harness.tools[0] as {
      execute: (...args: unknown[]) => Promise<unknown>;
    };
    await tool.execute(
      "call",
      { query: "pi" },
      new AbortController().signal,
      undefined,
      harness.ctx,
    );
  });
});
