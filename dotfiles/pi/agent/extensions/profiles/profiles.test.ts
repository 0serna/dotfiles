import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs/promises and node:os before importing modules that use them
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@earendil-works/pi-ai", () => ({
  getSupportedThinkingLevels: () => [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ],
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  compact: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/home/test",
}));

// Now import the modules under test
import { compact } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import registerProfilesExtension from "./index.ts";
import { ROUTE_TYPES } from "./routes.ts";
import { loadConfig } from "./state.ts";
import {
  getRememberedLevel,
  loadMemory,
  recordLevel,
} from "./thinking-memory.ts";

const compactMock = vi.mocked(compact);
const mkdirMock = vi.mocked(mkdir);
const readFileMock = vi.mocked(readFile);
const writeFileMock = vi.mocked(writeFile);

function missingFileError(): Error & { code: string } {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

/** Route readFile to config by default; user-selection.json only when a selection is provided. */
function mockReadFiles(selection: string | null, config = validConfig()) {
  readFileMock.mockImplementation(async (path) => {
    const pathStr = String(path);
    if (pathStr.endsWith("/thinking-memory.json")) throw missingFileError();
    if (pathStr.endsWith("/user-selection.json")) {
      if (selection === null) throw missingFileError();
      return selection;
    }
    return config;
  });
}

function validConfig(): string {
  return JSON.stringify({
    cheap: { model: "route/cheap", thinkingLevel: "low" },
    balanced: { model: "route/balanced", thinkingLevel: "medium" },
    strong: { model: "route/strong", thinkingLevel: "medium" },
  });
}

type TestModel = { provider: string; id: string };
type TestContext = {
  model: TestModel;
  modelRegistry: {
    find: (provider: string, id: string) => TestModel | undefined;
    getAvailable: () => TestModel[];
    getApiKeyAndHeaders: (
      model: TestModel,
    ) => Promise<{ ok: true; apiKey: string; headers: Record<string, string> }>;
  };
  ui: { notify: ReturnType<typeof vi.fn> };
};
type Handler = (event: unknown, ctx: TestContext) => unknown | Promise<unknown>;

function setupExtension(config = validConfig()) {
  const handlers = new Map<string, Handler>();
  const userModel = { provider: "user", id: "base" };
  const userModel2 = { provider: "user", id: "other" };
  const cheapRouteModel = { provider: "route", id: "cheap" };
  const balancedRouteModel = { provider: "route", id: "balanced" };
  const strongRouteModel = { provider: "route", id: "strong" };
  const models = [
    userModel,
    userModel2,
    cheapRouteModel,
    balancedRouteModel,
    strongRouteModel,
  ];
  const ctx = {
    model: userModel,
    modelRegistry: {
      find: vi.fn((provider: string, id: string) =>
        models.find((m) => m.provider === provider && m.id === id),
      ),
      getAvailable: vi.fn(() => models),
      getApiKeyAndHeaders: vi.fn(async () => ({
        ok: true as const,
        apiKey: "test-api-key",
        headers: { "x-test": "yes" },
      })),
    },
    ui: { notify: vi.fn() },
  };
  let thinkingLevel = "high";
  const pi = {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    registerCommand: vi.fn(),
    getThinkingLevel: vi.fn(() => thinkingLevel),
    setThinkingLevel: vi.fn((level: string) => {
      const previousLevel = thinkingLevel;
      thinkingLevel = level;
      void handlers.get("thinking_level_select")?.(
        { level, previousLevel },
        ctx,
      );
    }),
    setModel: vi.fn(async (model: typeof userModel) => {
      const previousModel = ctx.model;
      ctx.model = model;
      await handlers.get("model_select")?.(
        { model, previousModel, source: "set" },
        ctx,
      );
      return true;
    }),
  };

  registerProfilesExtension(pi as never);
  mockReadFiles(null, config);

  return {
    ctx,
    handlers,
    pi,
    userModel,
    userModel2,
    cheapRouteModel,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// --- loadConfig ---

describe("loadConfig", () => {
  it("returns missing when file not found", async () => {
    readFileMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    const result = await loadConfig();
    expect(result.status).toBe("missing");
  });

  it("returns valid for correct cheap/balanced/strong config", async () => {
    const config = {
      cheap: { model: "a/b", thinkingLevel: "low" },
      balanced: { model: "a/b", thinkingLevel: "medium" },
      strong: { model: "a/b", thinkingLevel: "medium" },
    };
    readFileMock.mockResolvedValue(JSON.stringify(config));
    const result = await loadConfig();
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.config).toEqual(config);
    }
  });

  it("returns invalid when strong route is missing", async () => {
    const config = {
      cheap: { model: "a/b", thinkingLevel: "low" },
      balanced: { model: "a/b", thinkingLevel: "medium" },
    };
    readFileMock.mockResolvedValue(JSON.stringify(config));
    const result = await loadConfig();
    expect(result.status).toBe("invalid");
  });
});

// --- Compact route compaction ---

describe("compact route compaction", () => {
  const preparation = {
    messagesToSummarize: [],
    turnPrefixMessages: [],
    tokensBefore: 100,
    firstKeptEntryId: "entry-1",
  };

  it("uses the balanced route resolved from ROUTE_TYPES[/compact] without changing the active model", async () => {
    const result = {
      summary: "summary",
      firstKeptEntryId: "entry-1",
      tokensBefore: 100,
    };
    compactMock.mockResolvedValue(result);
    const { ctx, handlers, pi } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    const response = await handlers.get("session_before_compact")?.(
      { preparation, customInstructions: "custom", signal: undefined },
      ctx,
    );

    expect(response).toEqual({ compaction: result });
    expect(compactMock).toHaveBeenCalledWith(
      preparation,
      { provider: "route", id: "balanced" },
      "test-api-key",
      { "x-test": "yes" },
      "custom",
      undefined,
      "medium",
    );
    expect(pi.setModel).not.toHaveBeenCalled();
    expect(ctx.model).toEqual({ provider: "user", id: "base" });
  });

  it("yields no custom compaction when configuration is missing", async () => {
    const { ctx, handlers } = setupExtension();
    // Force missing config: re-mock readFile to reject ENOENT for the session_start load
    readFileMock.mockReset();
    readFileMock.mockRejectedValue(missingFileError());

    await handlers.get("session_start")?.({}, ctx);
    const response = await handlers.get("session_before_compact")?.(
      { preparation },
      ctx,
    );

    expect(response).toBeUndefined();
    expect(compactMock).not.toHaveBeenCalled();
  });

  it("yields no custom compaction when /compact is not mapped", async () => {
    const routeTypes = ROUTE_TYPES as Partial<Record<string, string>>;
    const originalCompactRoute = routeTypes["/compact"];
    delete routeTypes["/compact"];

    try {
      const { ctx, handlers } = setupExtension();

      await handlers.get("session_start")?.({}, ctx);
      const response = await handlers.get("session_before_compact")?.(
        { preparation },
        ctx,
      );

      expect(response).toBeUndefined();
      expect(compactMock).not.toHaveBeenCalled();
      expect(ctx.ui.notify).not.toHaveBeenCalled();
    } finally {
      routeTypes["/compact"] = originalCompactRoute;
    }
  });

  it("warns and falls back when the resolved route model disappears at runtime", async () => {
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    vi.mocked(ctx.modelRegistry.find).mockReturnValue(undefined);
    const response = await handlers.get("session_before_compact")?.(
      { preparation },
      ctx,
    );

    expect(response).toBeUndefined();
    expect(compactMock).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Compact route failed: model 'route/balanced' not found. Falling back to default compaction.",
      "warning",
    );
  });

  it("warns and falls back when auth fails at runtime", async () => {
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    vi.mocked(ctx.modelRegistry.getApiKeyAndHeaders).mockResolvedValue({
      ok: false,
    } as never);
    const response = await handlers.get("session_before_compact")?.(
      { preparation },
      ctx,
    );

    expect(response).toBeUndefined();
    expect(compactMock).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Compact route failed: authentication unavailable for 'route/balanced'. Falling back to default compaction.",
      "warning",
    );
  });

  it("warns and falls back when compaction execution fails", async () => {
    compactMock.mockRejectedValue(new Error("provider down"));
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    const response = await handlers.get("session_before_compact")?.(
      { preparation },
      ctx,
    );

    expect(response).toBeUndefined();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Compact route failed: provider down. Falling back to default compaction.",
      "warning",
    );
  });
});

// --- User snapshot route restoration ---

describe("user snapshot route restoration", () => {
  it("restores persisted user selection on session_start even when Pi starts with a contaminated default", async () => {
    const { ctx, handlers, pi, userModel } = setupExtension();

    // Simulate Pi starting with a route-contaminated default model
    ctx.model = { provider: "route", id: "cheap" };

    mockReadFiles(
      JSON.stringify({
        modelProvider: userModel.provider,
        modelId: userModel.id,
        thinkingLevel: "high",
      }),
    );

    await handlers.get("session_start")?.({}, ctx);

    expect(pi.setModel).toHaveBeenCalledWith(userModel);
    expect(pi.setThinkingLevel).toHaveBeenCalledWith("high");
  });

  it("does not restore or overwrite persisted user selection when model is unavailable", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    const { ctx, handlers, pi } = setupExtension();

    // Pi starts with route-contaminated default
    ctx.model = { provider: "route", id: "cheap" };

    mockReadFiles(
      JSON.stringify({
        modelProvider: "missing",
        modelId: "model",
        thinkingLevel: "high",
      }),
    );

    await handlers.get("session_start")?.({}, ctx);

    // Model should NOT have changed, and the contaminated default should not replace the persisted selection.
    expect(pi.setModel).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("persists user selection on manual model select", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    const { ctx, handlers, userModel2 } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    ctx.model = userModel2;

    await handlers.get("model_select")?.(
      { source: "set", model: userModel2 },
      ctx,
    );

    expect(writeFileMock).toHaveBeenCalledWith(
      "/home/test/.local/state/pi/user-selection.json",
      JSON.stringify(
        {
          modelProvider: userModel2.provider,
          modelId: userModel2.id,
          thinkingLevel: "high",
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  it("persists user selection on manual thinking level change", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);

    await handlers.get("thinking_level_select")?.({ level: "xhigh" }, ctx);

    expect(writeFileMock).toHaveBeenCalledWith(
      "/home/test/.local/state/pi/user-selection.json",
      JSON.stringify(
        {
          modelProvider: "user",
          modelId: "base",
          thinkingLevel: "xhigh",
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  it("does not persist user selection during route activation", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    // Clear writeFile calls from session_start snapshot
    writeFileMock.mockClear();
    mkdirMock.mockClear();

    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("restores the session-start model and thinking after a routed command", async () => {
    const { ctx, handlers, pi, userModel, cheapRouteModel } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);

    // mock user-selection.json so agent_end reads the persisted selection
    mockReadFiles(
      JSON.stringify({
        modelProvider: userModel.provider,
        modelId: userModel.id,
        thinkingLevel: "high",
      }),
    );

    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );
    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenNthCalledWith(1, cheapRouteModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(2, userModel);
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "high");
  });

  it("does not replace the user selection when routed commands are chained", async () => {
    const { ctx, handlers, pi, userModel, cheapRouteModel } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);

    // mock user-selection.json so agent_end reads the persisted selection
    mockReadFiles(
      JSON.stringify({
        modelProvider: userModel.provider,
        modelId: userModel.id,
        thinkingLevel: "high",
      }),
    );

    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit one" },
      ctx,
    );
    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit two" },
      ctx,
    );
    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenNthCalledWith(1, cheapRouteModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(2, cheapRouteModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(3, userModel);
  });

  it("restores the latest user-selected model and thinking from file", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    const { ctx, handlers, pi, userModel2 } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    ctx.model = userModel2;
    pi.setThinkingLevel("medium");
    await handlers.get("model_select")?.(
      { source: "cycle", model: userModel2 },
      ctx,
    );
    await handlers.get("thinking_level_select")?.({ level: "xhigh" }, ctx);

    // mock user-selection.json so agent_end reads the latest persisted selection
    mockReadFiles(
      JSON.stringify({
        modelProvider: userModel2.provider,
        modelId: userModel2.id,
        thinkingLevel: "xhigh",
      }),
    );

    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );
    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenLastCalledWith(userModel2);
    expect(pi.setThinkingLevel).toHaveBeenLastCalledWith("xhigh");
  });

  it("restores the latest file-backed selection when another instance changes it during a route", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    const { ctx, handlers, pi, userModel2, cheapRouteModel } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);

    // Start a route on the original user selection
    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );

    // Simulate another instance changing user-selection.json while the route is active
    mockReadFiles(
      JSON.stringify({
        modelProvider: userModel2.provider,
        modelId: userModel2.id,
        thinkingLevel: "xhigh",
      }),
    );

    await handlers.get("agent_end")?.({}, ctx);

    // Route activated cheap, then restored from file: user/other + xhigh
    expect(pi.setModel).toHaveBeenNthCalledWith(1, cheapRouteModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(2, userModel2);
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "xhigh");
  });

  it("leaves the current model unchanged at agent_end when no persisted user selection exists", async () => {
    const { ctx, handlers, pi } = setupExtension();

    // Force no user-selection.json ever
    mockReadFiles(null);

    await handlers.get("session_start")?.({}, ctx);

    // Set up a user-selection.json read that returns nothing
    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );

    // Clear setModel calls from session_start and route activation
    const setModelCallsBefore = vi.mocked(pi.setModel).mock.calls.length;

    await handlers.get("agent_end")?.({}, ctx);

    // No additional setModel call after agent_end
    expect(vi.mocked(pi.setModel)).toHaveBeenCalledTimes(setModelCallsBefore);
  });
});

// --- Per-model thinking memory ---

describe("per-model thinking memory", () => {
  it("returns undefined for unknown model", async () => {
    readFileMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    await loadMemory();
    expect(getRememberedLevel("provider/model")).toBeUndefined();
  });

  it("records, retrieves, and persists thinking level", async () => {
    vi.useFakeTimers();
    readFileMock.mockRejectedValue(missingFileError());
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    await loadMemory();

    recordLevel("openai/gpt-5", "high");
    await vi.runAllTimersAsync();

    expect(getRememberedLevel("openai/gpt-5")).toBe("high");
    expect(mkdirMock).toHaveBeenCalledWith("/home/test/.local/state/pi", {
      recursive: true,
    });
    expect(writeFileMock).toHaveBeenCalledWith(
      "/home/test/.local/state/pi/thinking-memory.json",
      JSON.stringify({ "openai/gpt-5": "high" }, null, 2),
      "utf8",
    );
  });

  it("loads persisted memory", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ "p/m": "low", "x/y": "high" }),
    );
    await loadMemory();
    expect(getRememberedLevel("p/m")).toBe("low");
    expect(getRememberedLevel("x/y")).toBe("high");
  });
});
