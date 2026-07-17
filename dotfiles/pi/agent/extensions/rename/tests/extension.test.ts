import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));

vi.mock("@earendil-works/pi-ai/compat", () => ({ complete }));

import extensionFactory from "../index.ts";

type CommandHandler = (args: string, ctx: unknown) => Promise<void>;

function createSetup({
  branch = [],
  model = { provider: "opencode-go", id: "deepseek-v4-flash" },
  auth = { ok: true, apiKey: "key", headers: {}, env: {} },
}: {
  branch?: unknown[];
  model?: unknown;
  auth?: unknown;
} = {}) {
  let handler: CommandHandler | undefined;
  const setSessionName = vi.fn();
  const pi = {
    registerCommand: vi.fn((_name, command) => {
      handler = command.handler as CommandHandler;
    }),
    setSessionName,
  } as unknown as ExtensionAPI;
  const ctx = {
    hasUI: true,
    sessionManager: {
      getBranch: () => branch,
      getSessionId: () => "test-session",
    },
    modelRegistry: {
      find: vi.fn(() => model),
      getApiKeyAndHeaders: vi.fn(async () => auth),
    },
    ui: { notify: vi.fn() },
  };

  extensionFactory(pi);

  return { ctx, handler: handler!, pi, setSessionName };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("rename extension", () => {
  it("registers /rename", () => {
    const setup = createSetup();

    expect(setup.pi.registerCommand).toHaveBeenCalledWith(
      "rename",
      expect.objectContaining({
        description: "Generate a session title from recent user messages",
      }),
    );
  });

  it("uses only the fixed title model with high reasoning", async () => {
    const setup = createSetup({
      branch: [{ type: "message", message: { role: "user", content: "one" } }],
    });
    complete.mockResolvedValue({ content: [{ type: "text", text: "One" }] });

    await setup.handler("ignored arguments", setup.ctx);

    expect(setup.ctx.modelRegistry.find).toHaveBeenCalledWith(
      "opencode-go",
      "deepseek-v4-flash",
    );
    expect(complete).toHaveBeenCalledWith(
      { provider: "opencode-go", id: "deepseek-v4-flash" },
      expect.any(Object),
      expect.objectContaining({ reasoningEffort: "high" }),
    );
    expect(setup.setSessionName).toHaveBeenCalledWith("One");
  });

  it("reports model responses that stop with an error", async () => {
    const setup = createSetup({
      branch: [{ type: "message", message: { role: "user", content: "one" } }],
    });
    complete.mockResolvedValue({
      content: [],
      stopReason: "error",
      errorMessage: "Provider rejected the request",
      usage: { totalTokens: 0 },
    });

    await setup.handler("", setup.ctx);

    expect(setup.setSessionName).not.toHaveBeenCalled();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Title generation failed: Provider rejected the request",
      "error",
    );
  });

  it("does not rename or fall back when the fixed model is unavailable", async () => {
    const setup = createSetup({
      branch: [{ type: "message", message: { role: "user", content: "one" } }],
      model: null,
    });

    await setup.handler("", setup.ctx);

    expect(complete).not.toHaveBeenCalled();
    expect(setup.setSessionName).not.toHaveBeenCalled();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Title model opencode-go/deepseek-v4-flash is unavailable.",
      "error",
    );
  });
});
