import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
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

import { compact } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import registerProfilesExtension from "../index.ts";
import { ROUTE_TYPES } from "../routes.ts";
import { loadConfig } from "../state.ts";

const compactMock = vi.mocked(compact);
const mkdirMock = vi.mocked(mkdir);
const readFileMock = vi.mocked(readFile);
const renameMock = vi.mocked(rename);
const writeFileMock = vi.mocked(writeFile);

function missingFileError(): Error & { code: string } {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

const PREFS_FILE = "/home/test/.local/state/pi/manual-preferences.json";

/**
 * Route readFile so that:
 *   - manual-preferences.json returns `prefs` (or throws ENOENT if null)
 *   - profiles.json returns `config`
 */
function mockReadFiles(prefs: string | null, config = validConfig()): void {
  readFileMock.mockImplementation(async (path) => {
    const pathStr = String(path);
    if (pathStr.endsWith("/manual-preferences.json")) {
      if (prefs === null) throw missingFileError();
      return prefs;
    }
    if (pathStr.endsWith("/profiles.json")) return config;
    throw missingFileError();
  });
}

function validConfig(): string {
  return JSON.stringify({
    cheap: { model: "route/cheap", thinkingLevel: "low" },
    auxiliar: { model: "route/auxiliar", thinkingLevel: "medium" },
  });
}

function manualPrefsJson(
  selection: {
    modelProvider: string;
    modelId: string;
    thinkingLevel: string;
  } | null,
  thinkingMemory: Record<string, string> = {},
): string {
  return JSON.stringify({ selection, thinkingMemory });
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
  const auxiliarRouteModel = { provider: "route", id: "auxiliar" };
  const models = [userModel, userModel2, cheapRouteModel, auxiliarRouteModel];
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
    auxiliarRouteModel,
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

  it("returns valid for correct cheap/auxiliar config", async () => {
    const config = {
      cheap: { model: "a/b", thinkingLevel: "low" },
      auxiliar: { model: "a/b", thinkingLevel: "medium" },
    };
    readFileMock.mockResolvedValue(JSON.stringify(config));
    const result = await loadConfig();
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.config).toEqual(config);
    }
  });

  it("returns invalid when auxiliar route is missing", async () => {
    const config = {
      cheap: { model: "a/b", thinkingLevel: "low" },
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

  it("uses the cheap route resolved from ROUTE_TYPES[/compact] without changing the active model", async () => {
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
      { provider: "route", id: "cheap" },
      "test-api-key",
      { "x-test": "yes" },
      "custom",
      undefined,
      "low",
    );
    expect(pi.setModel).not.toHaveBeenCalled();
    expect(ctx.model).toEqual({ provider: "user", id: "base" });
  });

  it("yields no custom compaction when configuration is missing", async () => {
    const { ctx, handlers } = setupExtension();
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
      "Compact route failed: model 'route/cheap' not found. Falling back to default compaction.",
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
      "Compact route failed: authentication unavailable for 'route/cheap'. Falling back to default compaction.",
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

// --- Manual preferences restoration ---

describe("manual preferences restoration", () => {
  it("restores persisted selection on session_start even when Pi starts with a contaminated default", async () => {
    const { ctx, handlers, pi, userModel } = setupExtension();
    ctx.model = { provider: "route", id: "cheap" };

    mockReadFiles(
      manualPrefsJson({
        modelProvider: userModel.provider,
        modelId: userModel.id,
        thinkingLevel: "high",
      }),
    );

    await handlers.get("session_start")?.({}, ctx);

    expect(pi.setModel).toHaveBeenCalledWith(userModel);
    expect(pi.setThinkingLevel).toHaveBeenCalledWith("high");
  });

  it("does not restore or persist a selection when the persisted model is unavailable", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const { ctx, handlers, pi } = setupExtension();
    ctx.model = { provider: "route", id: "cheap" };

    mockReadFiles(
      manualPrefsJson({
        modelProvider: "missing",
        modelId: "model",
        thinkingLevel: "high",
      }),
    );

    await handlers.get("session_start")?.({}, ctx);

    expect(pi.setModel).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("persists the unified snapshot on manual model select", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const { ctx, handlers, userModel2 } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    ctx.model = userModel2;

    await handlers.get("model_select")?.(
      { source: "set", model: userModel2 },
      ctx,
    );

    await vi.waitFor(() =>
      expect(writeFileMock).toHaveBeenCalledWith(
        `${PREFS_FILE}.tmp`,
        JSON.stringify(
          {
            selection: {
              modelProvider: userModel2.provider,
              modelId: userModel2.id,
              thinkingLevel: "high",
            },
            thinkingMemory: {
              "user/base": "high",
              "user/other": "high",
            },
          },
          null,
          2,
        ),
        "utf8",
      ),
    );
  });

  it("persists the unified snapshot on manual thinking level change", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    await handlers.get("thinking_level_select")?.({ level: "max" }, ctx);

    await vi.waitFor(() =>
      expect(writeFileMock).toHaveBeenCalledWith(
        `${PREFS_FILE}.tmp`,
        JSON.stringify(
          {
            selection: {
              modelProvider: "user",
              modelId: "base",
              thinkingLevel: "max",
            },
            thinkingMemory: { "user/base": "max" },
          },
          null,
          2,
        ),
        "utf8",
      ),
    );
  });

  it("serializes writes so the latest snapshot wins", async () => {
    let releaseFirstWrite!: () => void;
    let firstWriteStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      firstWriteStarted = resolve;
    });
    const firstWriteReleased = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let firstWriteSeen = false;
    const writtenContents: string[] = [];

    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockImplementation(async (_path, content) => {
      writtenContents.push(String(content));
      if (!firstWriteSeen) {
        firstWriteSeen = true;
        firstWriteStarted();
        await firstWriteReleased;
      }
    });
    renameMock.mockResolvedValue();
    readFileMock.mockImplementation(async (path) => {
      if (String(path).endsWith("/manual-preferences.json")) {
        const last = writtenContents[writtenContents.length - 1];
        if (!last) throw missingFileError();
        return last;
      }
      throw missingFileError();
    });

    const { ctx, handlers } = setupExtension();
    await handlers.get("session_start")?.({}, ctx);
    await handlers.get("thinking_level_select")?.({ level: "high" }, ctx);
    await firstStarted;

    // Trigger a second persistence while the first is still in flight.
    ctx.model = { provider: "user", id: "other" };
    await handlers.get("model_select")?.(
      { source: "set", model: { provider: "user", id: "other" } },
      ctx,
    );
    // Only the first persistence has actually hit writeFile; the second
    // is queued behind it.
    expect(writtenContents).toHaveLength(1);
    releaseFirstWrite();
    await vi.waitFor(() =>
      expect(writtenContents.length).toBeGreaterThanOrEqual(2),
    );
    // The latest enqueued snapshot must reflect the second model_select.
    const latest = JSON.parse(writtenContents[writtenContents.length - 1]!);
    expect(latest.selection).toEqual({
      modelProvider: "user",
      modelId: "other",
      thinkingLevel: "high",
    });
  });

  it("restores a remembered max level when the user returns to a model", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const { ctx, handlers, pi, userModel, userModel2 } = setupExtension();

    mockReadFiles(
      manualPrefsJson(
        {
          modelProvider: userModel.provider,
          modelId: userModel.id,
          thinkingLevel: "high",
        },
        { "user/other": "max" },
      ),
    );
    await handlers.get("session_start")?.({}, ctx);
    vi.mocked(pi.setThinkingLevel).mockClear();

    ctx.model = userModel2;
    await handlers.get("thinking_level_select")?.({ level: "high" }, ctx);
    await handlers.get("model_select")?.(
      { source: "set", model: userModel2 },
      ctx,
    );

    expect(pi.setThinkingLevel).toHaveBeenCalledWith("max");
  });

  it("preserves a model preference when Pi clamps during a model switch", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const { ctx, handlers, pi, userModel, userModel2 } = setupExtension();

    mockReadFiles(
      manualPrefsJson(
        {
          modelProvider: userModel.provider,
          modelId: userModel.id,
          thinkingLevel: "high",
        },
        { "user/other": "high" },
      ),
    );
    await handlers.get("session_start")?.({}, ctx);
    vi.mocked(pi.setThinkingLevel).mockClear();

    // Pi changes the active model and clamps the current level before model_select.
    ctx.model = userModel2;
    await handlers.get("thinking_level_select")?.({ level: "xhigh" }, ctx);
    await handlers.get("model_select")?.(
      { source: "set", model: userModel2 },
      ctx,
    );

    // Returning to the first model clamps xhigh to max before model_select.
    ctx.model = userModel;
    await handlers.get("thinking_level_select")?.({ level: "max" }, ctx);
    await handlers.get("model_select")?.(
      { source: "set", model: userModel },
      ctx,
    );

    // The reducer applies the remembered "high" for the original model.
    expect(pi.setThinkingLevel).toHaveBeenCalledWith("high");
  });

  it("does not persist manual preferences during route activation", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const { ctx, handlers } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
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

    mockReadFiles(
      manualPrefsJson({
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

    mockReadFiles(
      manualPrefsJson({
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
    renameMock.mockResolvedValue();
    const { ctx, handlers, pi, userModel2 } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    ctx.model = userModel2;
    pi.setThinkingLevel("medium");
    await handlers.get("model_select")?.(
      { source: "cycle", model: userModel2 },
      ctx,
    );
    await handlers.get("thinking_level_select")?.({ level: "xhigh" }, ctx);

    mockReadFiles(
      manualPrefsJson({
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
    renameMock.mockResolvedValue();
    const { ctx, handlers, pi, userModel2, cheapRouteModel } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);

    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );

    mockReadFiles(
      manualPrefsJson({
        modelProvider: userModel2.provider,
        modelId: userModel2.id,
        thinkingLevel: "xhigh",
      }),
    );

    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenNthCalledWith(1, cheapRouteModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(2, userModel2);
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "xhigh");
  });

  it("leaves the current model unchanged at agent_end when no persisted selection exists", async () => {
    const { ctx, handlers, pi } = setupExtension();
    mockReadFiles(null);

    await handlers.get("session_start")?.({}, ctx);

    await handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      ctx,
    );

    const setModelCallsBefore = vi.mocked(pi.setModel).mock.calls.length;

    await handlers.get("agent_end")?.({}, ctx);

    expect(vi.mocked(pi.setModel)).toHaveBeenCalledTimes(setModelCallsBefore);
  });
});
