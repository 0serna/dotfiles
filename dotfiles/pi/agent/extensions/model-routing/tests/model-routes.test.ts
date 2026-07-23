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
  parseSkillBlock: vi.fn((text: string) => {
    const name = text.match(/^<skill name="([^"]+)"/)?.[1];
    return name ? { name } : null;
  }),
}));

vi.mock("node:os", () => ({
  homedir: () => "/home/test",
}));

import { compact } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import registerModelRoutesExtension from "../index.ts";
import { ROUTE_TOKENS } from "../routes.ts";
import { createModelRoutesRuntime } from "../runtime.ts";
import { loadConfig, saveConfig } from "../state.ts";
import { renderRouteFrame } from "../ui.ts";

const compactMock = vi.mocked(compact);
const mkdirMock = vi.mocked(mkdir);
const readFileMock = vi.mocked(readFile);
const renameMock = vi.mocked(rename);
const writeFileMock = vi.mocked(writeFile);

function missingFileError(): Error & { code: string } {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

const PREFS_FILE = "/home/test/.local/state/pi/manual-preferences.json";
const ROUTES_FILE = "/home/test/.local/state/pi/model-routes.json";

type FileState = {
  prefs: string | null;
  routes: string | "missing" | "invalid:unreadable" | "invalid:unparseable";
};

function configureFiles(state: FileState): void {
  readFileMock.mockImplementation(async (path) => {
    const pathStr = String(path);
    if (pathStr.endsWith("/manual-preferences.json")) {
      if (state.prefs === null) throw missingFileError();
      return state.prefs;
    }
    if (pathStr.endsWith("/model-routes.json")) {
      if (state.routes === "missing") throw missingFileError();
      if (state.routes === "invalid:unreadable") {
        throw new Error("EACCES: permission denied");
      }
      if (state.routes === "invalid:unparseable") {
        return "{not json";
      }
      return state.routes;
    }
    throw missingFileError();
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
  model?: TestModel;
  isIdle: ReturnType<typeof vi.fn>;
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

function setupExtension() {
  const handlers = new Map<string, Handler>();
  const userModel = { provider: "user", id: "base" };
  const userModel2 = { provider: "user", id: "other" };
  const compactModel = { provider: "compact", id: "model" };
  const commitModel = { provider: "commit", id: "model" };
  const openspecProposeModel = { provider: "openspecPropose", id: "model" };
  const allModels = [
    userModel,
    userModel2,
    compactModel,
    commitModel,
    openspecProposeModel,
  ];
  const ctx: TestContext = {
    model: userModel,
    isIdle: vi.fn(() => true),
    modelRegistry: {
      find: vi.fn((provider: string, id: string) =>
        allModels.find((m) => m.provider === provider && m.id === id),
      ),
      getAvailable: vi.fn(() => allModels),
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

  registerModelRoutesExtension(pi as never);
  // Default: missing routes file, missing prefs file.
  configureFiles({ prefs: null, routes: "missing" });

  return {
    ctx,
    handlers,
    pi,
    userModel,
    userModel2,
    compactModel,
    commitModel,
    openspecProposeModel,
  };
}

function setupContext() {
  // Lightweight context factory for direct runtime tests (no extension).
  const userModel = { provider: "user", id: "base" };
  const userModel2 = { provider: "user", id: "other" };
  const compactModel = { provider: "compact", id: "model" };
  const commitModel = { provider: "commit", id: "model" };
  const openspecProposeModel = { provider: "openspecPropose", id: "model" };
  const allModels = [
    userModel,
    userModel2,
    compactModel,
    commitModel,
    openspecProposeModel,
  ];
  const ctx = {
    model: userModel,
    modelRegistry: {
      find: vi.fn((provider: string, id: string) =>
        allModels.find((m) => m.provider === provider && m.id === id),
      ),
      getAvailable: vi.fn(() => allModels),
      getApiKeyAndHeaders: vi.fn(async () => ({
        ok: true as const,
        apiKey: "test-api-key",
        headers: { "x-test": "yes" },
      })),
    },
    ui: { notify: vi.fn() },
  };
  return ctx as unknown as Parameters<
    ReturnType<typeof createModelRoutesRuntime>["refreshConfig"]
  >[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// --- loadConfig ---

describe("loadConfig", () => {
  it("returns missing when the routes file is not found", async () => {
    configureFiles({ prefs: null, routes: "missing" });
    const result = await loadConfig();
    expect(result.status).toBe("missing");
  });

  it("returns valid with the raw record for a partial per-token config", async () => {
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });
    const result = await loadConfig();
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.config).toEqual({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      });
    }
  });

  it("returns invalid when the file is unparseable JSON", async () => {
    configureFiles({ prefs: null, routes: "invalid:unparseable" });
    const result = await loadConfig();
    expect(result.status).toBe("invalid");
  });

  it("returns invalid when the file is a JSON array", async () => {
    configureFiles({ prefs: null, routes: JSON.stringify(["bad"]) });
    const result = await loadConfig();
    expect(result.status).toBe("invalid");
  });

  it("preserves undeclared entries so the runtime can canonicalize them", async () => {
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
        "/unknown/legacy": {
          model: "legacy/model",
          thinkingLevel: "high",
        },
      }),
    });
    const result = await loadConfig();
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.config).toHaveProperty("/unknown/legacy");
    }
  });
});

// --- saveConfig ---

describe("saveConfig", () => {
  it("writes only declared, configured routes", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    await saveConfig({
      "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      "/unknown/legacy": {
        model: "legacy/model",
        thinkingLevel: "high",
      },
    });

    expect(writeFileMock).toHaveBeenCalledWith(
      ROUTES_FILE,
      JSON.stringify(
        {
          "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
        },
        null,
        2,
      ),
      "utf8",
    );
  });
});

// --- Runtime sanitization ---

describe("runtime sanitization", () => {
  it("converts malformed values and undeclared keys to unset, keeping configured routes", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
        "/skill:simplify": "not-an-object",
        "/skill:openspec-apply-change": {
          model: "unknown/missing",
          thinkingLevel: "high",
        },
        "/unknown/legacy": {
          model: "legacy/model",
          thinkingLevel: "high",
        },
      }),
    });

    const runtime = createModelRoutesRuntime();
    const ctx = setupContext();
    await runtime.refreshConfig(ctx);

    expect(runtime.isRouteUsable("/skill:commit")).toBe(true);
    expect(runtime.isRouteUsable("/skill:simplify")).toBe(false);
    expect(runtime.isRouteUsable("/skill:openspec-apply-change")).toBe(false);

    expect(writeFileMock).toHaveBeenCalledWith(
      ROUTES_FILE,
      JSON.stringify(
        {
          "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  it("converts an unknown model route to unset", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": {
          model: "unknown/missing",
          thinkingLevel: "low",
        },
      }),
    });

    const runtime = createModelRoutesRuntime();
    const ctx = setupContext();
    await runtime.refreshConfig(ctx);

    expect(runtime.isRouteUsable("/skill:commit")).toBe(false);
    expect(writeFileMock).toHaveBeenCalled();
  });

  it("retains a route whose model is known but credentials are temporarily missing", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    const runtime = createModelRoutesRuntime();
    const ctx = setupContext();
    vi.mocked(ctx.modelRegistry.getAvailable).mockReturnValue([
      { provider: "user", id: "base" },
      { provider: "user", id: "other" },
      { provider: "compact", id: "model" },
      // commit/model is intentionally NOT in the available list
      { provider: "simplify", id: "model" },
    ] as never);

    await runtime.refreshConfig(ctx);

    expect(runtime.isRouteUsable("/skill:commit")).toBe(false);
    const activation = runtime.getActivation()["/skill:commit"];
    expect(activation.kind).toBe("missing_credentials");
    // The route survives sanitization because the model is known;
    // since the canonical shape matches the raw file, no rewrite
    // happens.
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(runtime.getConfigSnapshot()).toEqual({
      "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
    });
  });

  it("does not rewrite the file when it cannot be read", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    configureFiles({ prefs: null, routes: "invalid:unreadable" });

    const runtime = createModelRoutesRuntime();
    const ctx = setupContext();
    await runtime.refreshConfig(ctx);

    expect(runtime.getStatus()).toBe("invalid");
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("does not rewrite the file when it is unparseable", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    configureFiles({ prefs: null, routes: "invalid:unparseable" });

    const runtime = createModelRoutesRuntime();
    const ctx = setupContext();
    await runtime.refreshConfig(ctx);

    expect(runtime.getStatus()).toBe("invalid");
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("isolates route failures: a missing route does not disable other routes", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();

    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    const runtime = createModelRoutesRuntime();
    const ctx = setupContext();
    await runtime.refreshConfig(ctx);

    expect(runtime.isRouteUsable("/skill:commit")).toBe(true);
    expect(runtime.isRouteUsable("/skill:simplify")).toBe(false);
    expect(runtime.isRouteUsable("/compact")).toBe(false);
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

  it("uses the /compact route when configured and usable", async () => {
    const result = {
      summary: "summary",
      firstKeptEntryId: "entry-1",
      tokensBefore: 100,
    };
    compactMock.mockResolvedValue(result);
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/compact": { model: "compact/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    const response = await setup.handlers.get("session_before_compact")?.(
      { preparation, customInstructions: "custom", signal: undefined },
      setup.ctx,
    );

    expect(response).toEqual({ compaction: result });
    expect(compactMock).toHaveBeenCalledWith(
      preparation,
      { provider: "compact", id: "model" },
      "test-api-key",
      { "x-test": "yes" },
      "custom",
      undefined,
      "low",
    );
    expect(setup.pi.setModel).not.toHaveBeenCalled();
    expect(setup.ctx.model).toEqual({ provider: "user", id: "base" });
  });

  it("yields no custom compaction when /compact is unset", async () => {
    const setup = setupExtension();
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    const response = await setup.handlers.get("session_before_compact")?.(
      { preparation },
      setup.ctx,
    );

    expect(response).toBeUndefined();
    expect(compactMock).not.toHaveBeenCalled();
  });

  it("warns and falls back when the resolved route model disappears at runtime", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/compact": { model: "compact/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    vi.mocked(setup.ctx.modelRegistry.find).mockReturnValue(undefined);
    const response = await setup.handlers.get("session_before_compact")?.(
      { preparation },
      setup.ctx,
    );

    expect(response).toBeUndefined();
    expect(compactMock).not.toHaveBeenCalled();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Compact route failed: model 'compact/model' not found. Falling back to default compaction.",
      "error",
    );
  });

  it("warns and falls back when auth fails at runtime", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/compact": { model: "compact/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    vi.mocked(setup.ctx.modelRegistry.getApiKeyAndHeaders).mockResolvedValue({
      ok: false,
    } as never);
    const response = await setup.handlers.get("session_before_compact")?.(
      { preparation },
      setup.ctx,
    );

    expect(response).toBeUndefined();
    expect(compactMock).not.toHaveBeenCalled();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Compact route failed: authentication unavailable for 'compact/model'. Falling back to default compaction.",
      "error",
    );
  });

  it("warns and falls back when compaction execution fails", async () => {
    compactMock.mockRejectedValue(new Error("provider down"));
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/compact": { model: "compact/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    const response = await setup.handlers.get("session_before_compact")?.(
      { preparation },
      setup.ctx,
    );

    expect(response).toBeUndefined();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Compact route failed: provider down. Falling back to default compaction.",
      "error",
    );
  });
});

// --- Session baseline and thinking preferences ---

describe("session baseline and thinking preferences", () => {
  it("restores remembered thinking level for the current model on session start", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: manualPrefsJson(null, {
        "user/base": "xhigh",
      }),
      routes: "missing",
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    expect(setup.pi.setThinkingLevel).toHaveBeenCalledWith("xhigh");
  });

  it("does not change thinking level when no remembered preference exists for the current model", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: manualPrefsJson(null, {
        "user/other": "xhigh",
      }),
      routes: "missing",
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    expect(setup.pi.setThinkingLevel).not.toHaveBeenCalled();
  });

  it("captures baseline with the restored thinking level, not Pi's default", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    configureFiles({
      prefs: manualPrefsJson(null, {
        "user/base": "xhigh",
      }),
      routes: "missing",
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    // After start, the baseline should reflect the restored level.
    // Simulate a route activation and settlement to verify baseline restoration.
    configureFiles({
      prefs: manualPrefsJson(null, {
        "user/base": "xhigh",
      }),
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    // Should restore to "xhigh" (the remembered preference), not "high" (Pi's default).
    expect(setup.pi.setThinkingLevel).toHaveBeenLastCalledWith("xhigh");
  });

  it("keeps Pi's startup selection and ignores a legacy persisted selection", async () => {
    const setup = setupExtension();
    setup.ctx.model = setup.commitModel;

    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel.provider,
        modelId: setup.userModel.id,
        thinkingLevel: "high",
      }),
      routes: "missing",
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    expect(setup.ctx.model).toBe(setup.commitModel);
    expect(setup.pi.setModel).not.toHaveBeenCalled();
    expect(setup.pi.setThinkingLevel).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("does not write preferences while capturing Pi's startup selection", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const setup = setupExtension();

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    expect(setup.pi.setModel).not.toHaveBeenCalled();
    expect(setup.pi.setThinkingLevel).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("persists thinking memory only on manual model select", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    setup.ctx.model = setup.userModel2;

    await setup.handlers.get("model_select")?.(
      { source: "set", model: setup.userModel2 },
      setup.ctx,
    );

    await vi.waitFor(() =>
      expect(writeFileMock).toHaveBeenCalledWith(
        `${PREFS_FILE}.tmp`,
        JSON.stringify(
          {
            thinkingMemory: {
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

  it("persists thinking memory only on manual thinking level change", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("thinking_level_select")?.(
      { level: "max" },
      setup.ctx,
    );

    await vi.waitFor(() =>
      expect(writeFileMock).toHaveBeenCalledWith(
        `${PREFS_FILE}.tmp`,
        JSON.stringify(
          {
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

    const setup = setupExtension();
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("thinking_level_select")?.(
      { level: "high" },
      setup.ctx,
    );
    await firstStarted;

    setup.ctx.model = { provider: "user", id: "other" };
    await setup.handlers.get("model_select")?.(
      { source: "set", model: { provider: "user", id: "other" } },
      setup.ctx,
    );
    expect(writtenContents).toHaveLength(1);
    releaseFirstWrite();
    await vi.waitFor(() =>
      expect(writtenContents.length).toBeGreaterThanOrEqual(2),
    );
    const latest = JSON.parse(writtenContents[writtenContents.length - 1]!);
    expect(latest).toEqual({
      thinkingMemory: {
        "user/base": "high",
        "user/other": "high",
      },
    });
  });

  it("lazily removes a legacy selection on the next manual preference change", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    configureFiles({
      prefs: manualPrefsJson(
        {
          modelProvider: "legacy",
          modelId: "selection",
          thinkingLevel: "low",
        },
        { "user/other": "max" },
      ),
      routes: "missing",
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("thinking_level_select")?.(
      { level: "xhigh" },
      setup.ctx,
    );

    await vi.waitFor(() => expect(writeFileMock).toHaveBeenCalled());
    const content = vi.mocked(writeFileMock).mock.calls.at(-1)?.[1];
    expect(JSON.parse(String(content))).toEqual({
      thinkingMemory: {
        "user/base": "xhigh",
        "user/other": "max",
      },
    });
  });

  it("restores a remembered max level when the user returns to a model", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const setup = setupExtension();

    configureFiles({
      prefs: manualPrefsJson(
        {
          modelProvider: setup.userModel.provider,
          modelId: setup.userModel.id,
          thinkingLevel: "high",
        },
        { "user/other": "max" },
      ),
      routes: "missing",
    });
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    vi.mocked(setup.pi.setThinkingLevel).mockClear();

    setup.ctx.model = setup.userModel2;
    await setup.handlers.get("thinking_level_select")?.(
      { level: "high" },
      setup.ctx,
    );
    await setup.handlers.get("model_select")?.(
      { source: "set", model: setup.userModel2 },
      setup.ctx,
    );

    expect(setup.pi.setThinkingLevel).toHaveBeenCalledWith("max");
  });

  it("preserves a model preference when Pi clamps during a model switch", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue();
    const setup = setupExtension();

    configureFiles({
      prefs: manualPrefsJson(
        {
          modelProvider: setup.userModel.provider,
          modelId: setup.userModel.id,
          thinkingLevel: "high",
        },
        { "user/other": "high" },
      ),
      routes: "missing",
    });
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    vi.mocked(setup.pi.setThinkingLevel).mockClear();

    setup.ctx.model = setup.userModel2;
    await setup.handlers.get("thinking_level_select")?.(
      { level: "xhigh" },
      setup.ctx,
    );
    await setup.handlers.get("model_select")?.(
      { source: "set", model: setup.userModel2 },
      setup.ctx,
    );

    setup.ctx.model = setup.userModel;
    await setup.handlers.get("thinking_level_select")?.(
      { level: "max" },
      setup.ctx,
    );
    await setup.handlers.get("model_select")?.(
      { source: "set", model: setup.userModel },
      setup.ctx,
    );

    expect(setup.pi.setThinkingLevel).toHaveBeenCalledWith("high");
  });

  it("does not persist manual preferences during route activation", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    writeFileMock.mockClear();
    mkdirMock.mockClear();

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("activates a queued route only when its expanded user message starts", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
        "/skill:openspec-propose": {
          model: "openspecPropose/model",
          thinkingLevel: "medium",
        },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    await setup.handlers.get("input")?.(
      {
        source: "user",
        text: "/skill:openspec-propose later",
        streamingBehavior: "followUp",
      },
      setup.ctx,
    );

    expect(setup.pi.setModel).toHaveBeenCalledTimes(1);
    expect(setup.ctx.model).toBe(setup.commitModel);

    await setup.handlers.get("message_start")?.(
      {
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: '<skill name="openspec-propose" location="/skills/openspec-propose/SKILL.md">\nBody\n</skill>\n\nlater',
            },
          ],
        },
      },
      setup.ctx,
    );

    expect(setup.pi.setModel).toHaveBeenCalledTimes(2);
    expect(setup.ctx.model).toBe(setup.openspecProposeModel);
  });

  it("does not retry an unset route at message_start", async () => {
    const setup = setupExtension();
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    setup.ctx.ui.notify.mockClear();

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    await setup.handlers.get("message_start")?.(
      {
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: '<skill name="commit" location="/skills/commit/SKILL.md">\nBody\n</skill>\n\nnow',
            },
          ],
        },
      },
      setup.ctx,
    );

    expect(setup.ctx.ui.notify).not.toHaveBeenCalled();
    expect(setup.pi.setModel).not.toHaveBeenCalled();
  });

  it("cancels the active route when the user manually selects a model", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );

    setup.ctx.model = setup.userModel2;
    await setup.handlers.get("model_select")?.(
      { source: "cycle", model: setup.userModel2 },
      setup.ctx,
    );
    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel2.provider,
        modelId: setup.userModel2.id,
        thinkingLevel: "low",
      }),
      routes: "missing",
    });
    vi.mocked(setup.pi.setModel).mockClear();

    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).not.toHaveBeenCalled();
    expect(setup.ctx.model).toBe(setup.userModel2);
  });

  it("cancels the active route when the user manually selects a thinking level", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    await setup.handlers.get("thinking_level_select")?.(
      { level: "medium" },
      setup.ctx,
    );
    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.commitModel.provider,
        modelId: setup.commitModel.id,
        thinkingLevel: "medium",
      }),
      routes: "missing",
    });
    vi.mocked(setup.pi.setModel).mockClear();

    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).not.toHaveBeenCalled();
    expect(setup.ctx.model).toBe(setup.commitModel);
  });

  it("captures a late Pi selection before the first route and restores it", async () => {
    const setup = setupExtension();
    setup.ctx.model = undefined;
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    setup.ctx.model = setup.userModel2;
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenNthCalledWith(1, setup.commitModel);
    expect(setup.pi.setModel).toHaveBeenNthCalledWith(2, setup.userModel2);
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "high");
  });

  it("restores a routed selection only after settlement is idle", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel.provider,
        modelId: setup.userModel.id,
        thinkingLevel: "high",
      }),
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );

    expect(setup.handlers.get("agent_end")).toBeUndefined();
    setup.ctx.isIdle.mockReturnValue(false);
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);
    expect(setup.pi.setModel).toHaveBeenCalledTimes(1);

    setup.ctx.isIdle.mockReturnValue(true);
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenNthCalledWith(1, setup.commitModel);
    expect(setup.pi.setModel).toHaveBeenNthCalledWith(2, setup.userModel);
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "high");
  });

  it("routes different skills to their own tokens independently", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
        "/skill:openspec-propose": {
          model: "openspecPropose/model",
          thinkingLevel: "medium",
        },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit one" },
      setup.ctx,
    );
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:openspec-propose two" },
      setup.ctx,
    );
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenNthCalledWith(1, setup.commitModel);
    expect(setup.pi.setModel).toHaveBeenNthCalledWith(
      2,
      setup.openspecProposeModel,
    );
  });

  it("warns but continues when the routed command has a broken configuration", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "unknown/provider", thinkingLevel: "low" },
      }),
    });
    await setup.handlers.get("session_start")?.({}, setup.ctx);
    setup.ctx.ui.notify.mockClear();

    const setModelCallsBefore = vi.mocked(setup.pi.setModel).mock.calls.length;

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );

    expect(vi.mocked(setup.pi.setModel)).toHaveBeenCalledTimes(
      setModelCallsBefore,
    );
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Route '/skill:commit' is not configured or unavailable; continuing with current model.",
      "error",
    );
  });

  it("does not replace the user selection when routed commands are chained", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel.provider,
        modelId: setup.userModel.id,
        thinkingLevel: "high",
      }),
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit one" },
      setup.ctx,
    );
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit two" },
      setup.ctx,
    );
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenNthCalledWith(1, setup.commitModel);
    expect(setup.pi.setModel).toHaveBeenNthCalledWith(2, setup.userModel);
  });

  it("restores the latest session-selected model and thinking", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    setup.ctx.model = setup.userModel2;
    setup.pi.setThinkingLevel("medium");
    await setup.handlers.get("model_select")?.(
      { source: "cycle", model: setup.userModel2 },
      setup.ctx,
    );
    await setup.handlers.get("thinking_level_select")?.(
      { level: "xhigh" },
      setup.ctx,
    );

    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel2.provider,
        modelId: setup.userModel2.id,
        thinkingLevel: "xhigh",
      }),
      routes: "missing",
    });

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenLastCalledWith(setup.userModel2);
    expect(setup.pi.setThinkingLevel).toHaveBeenLastCalledWith("xhigh");
  });

  it("restores the session baseline when another session changes thinking preferences during a route", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );

    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel2.provider,
        modelId: setup.userModel2.id,
        thinkingLevel: "xhigh",
      }),
      routes: "missing",
    });

    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenNthCalledWith(1, setup.commitModel);
    expect(setup.pi.setModel).toHaveBeenNthCalledWith(2, setup.userModel);
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "high");
  });

  it("closes the route and warns when the session baseline cannot be restored", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);
    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );
    configureFiles({
      prefs: manualPrefsJson({
        modelProvider: setup.userModel.provider,
        modelId: setup.userModel.id,
        thinkingLevel: "high",
      }),
      routes: "missing",
    });
    vi.mocked(setup.pi.setModel).mockResolvedValueOnce(false);

    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.ctx.model).toBe(setup.commitModel);
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Could not restore session baseline model 'user/base'.",
      "error",
    );

    vi.mocked(setup.pi.setModel).mockClear();
    await setup.handlers.get("agent_settled")?.({}, setup.ctx);
    expect(setup.pi.setModel).not.toHaveBeenCalled();
  });

  it("restores the session baseline when persisted preferences disappear during a route", async () => {
    const setup = setupExtension();
    configureFiles({
      prefs: null,
      routes: JSON.stringify({
        "/skill:commit": { model: "commit/model", thinkingLevel: "low" },
      }),
    });

    await setup.handlers.get("session_start")?.({}, setup.ctx);

    await setup.handlers.get("input")?.(
      { source: "user", text: "/skill:commit now" },
      setup.ctx,
    );

    await setup.handlers.get("agent_settled")?.({}, setup.ctx);

    expect(setup.pi.setModel).toHaveBeenNthCalledWith(1, setup.commitModel);
    expect(setup.pi.setModel).toHaveBeenNthCalledWith(2, setup.userModel);
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(setup.pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "high");
  });
});

describe("renderRouteFrame layout", () => {
  // Passthrough theme: visibleWidth measures the raw text, which is what
  // the TUI width guard checks, so colors do not affect the assertion.
  const theme = {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  } as unknown as Parameters<typeof renderRouteFrame>[4];

  function expectFits(
    width: number,
    status: "valid" | "missing" | "invalid",
  ): void {
    const rows = ROUTE_TOKENS.map((token) => ({
      token,
      model: "opencode-go/deepseek-v4-pro",
      thinking: "minimal",
    }));
    const lines = renderRouteFrame(width, rows, 0, status, theme);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
  }

  it("fits an 83-column terminal for every status without overflow", () => {
    expectFits(83, "valid");
    expectFits(83, "missing");
    expectFits(83, "invalid");
  });

  it("fits very narrow terminals without overflow", () => {
    expectFits(40, "valid");
    expectFits(20, "valid");
  });

  it("aligns the header columns with the item columns at 83 columns", () => {
    const rows = ROUTE_TOKENS.map((token) => ({
      token,
      model: "[unset]",
      thinking: "[unset]",
    }));
    const lines = renderRouteFrame(83, rows, 0, "valid", theme);
    // Header is line index 5; first item is line index 6.
    const header = lines[5]!;
    const firstItem = lines[6]!;
    // The "model" label in the header must start where the model value
    // starts in every item row.
    expect(header.indexOf("model")).toBe(firstItem.indexOf("[unset]"));
  });
});
