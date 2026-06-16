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

vi.mock("node:os", () => ({
  homedir: () => "/home/test",
}));

// Now import the modules under test
import { mkdir, readFile, writeFile } from "node:fs/promises";
import registerProfilesExtension from "./index.ts";
import { loadConfig } from "./state.ts";
import {
  getRememberedLevel,
  loadMemory,
  recordLevel,
} from "./thinking-memory.ts";

const mkdirMock = vi.mocked(mkdir);
const readFileMock = vi.mocked(readFile);
const writeFileMock = vi.mocked(writeFile);

function missingFileError(): Error & { code: string } {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

function validConfig(): string {
  return JSON.stringify({
    light: { model: "route/light", thinkingLevel: "low" },
    high: { model: "route/high", thinkingLevel: "medium" },
  });
}

type TestModel = { provider: string; id: string };
type TestContext = {
  model: TestModel;
  modelRegistry: {
    find: (provider: string, id: string) => TestModel | undefined;
    getAvailable: () => TestModel[];
  };
  ui: { notify: ReturnType<typeof vi.fn> };
};
type Handler = (event: unknown, ctx: TestContext) => unknown | Promise<unknown>;

function setupExtension() {
  const handlers = new Map<string, Handler>();
  const userModel = { provider: "user", id: "base" };
  const userModel2 = { provider: "user", id: "other" };
  const routeModel = { provider: "route", id: "light" };
  const highRouteModel = { provider: "route", id: "high" };
  const models = [userModel, userModel2, routeModel, highRouteModel];
  const ctx = {
    model: userModel,
    modelRegistry: {
      find: vi.fn((provider: string, id: string) =>
        models.find((m) => m.provider === provider && m.id === id),
      ),
      getAvailable: vi.fn(() => models),
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
  readFileMock
    .mockRejectedValueOnce(missingFileError())
    .mockResolvedValue(validConfig());

  return { ctx, handlers, pi, userModel, userModel2, routeModel };
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

  it("returns valid for correct light/high config", async () => {
    const config = {
      light: { model: "a/b", thinkingLevel: "low" },
      high: { model: "a/b", thinkingLevel: "medium" },
    };
    readFileMock.mockResolvedValue(JSON.stringify(config));
    const result = await loadConfig();
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.config).toEqual(config);
    }
  });

  it("returns invalid when high route is missing", async () => {
    const config = {
      light: { model: "a/b", thinkingLevel: "low" },
    };
    readFileMock.mockResolvedValue(JSON.stringify(config));
    const result = await loadConfig();
    expect(result.status).toBe("invalid");
  });
});

// --- User snapshot route restoration ---

describe("user snapshot route restoration", () => {
  it("restores the session-start model and thinking after a routed command", async () => {
    const { ctx, handlers, pi, userModel, routeModel } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    await handlers.get("input")?.(
      { source: "user", text: "/skill:simplify now" },
      ctx,
    );
    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenNthCalledWith(1, routeModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(2, userModel);
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(1, "low");
    expect(pi.setThinkingLevel).toHaveBeenNthCalledWith(2, "high");
  });

  it("does not replace the user snapshot when routed commands are chained", async () => {
    const { ctx, handlers, pi, userModel, routeModel } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    await handlers.get("input")?.(
      { source: "user", text: "/skill:simplify one" },
      ctx,
    );
    await handlers.get("input")?.(
      { source: "user", text: "/skill:simplify two" },
      ctx,
    );
    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenNthCalledWith(1, routeModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(2, routeModel);
    expect(pi.setModel).toHaveBeenNthCalledWith(3, userModel);
  });

  it("restores the latest user-selected model and thinking", async () => {
    const { ctx, handlers, pi, userModel2 } = setupExtension();

    await handlers.get("session_start")?.({}, ctx);
    ctx.model = userModel2;
    pi.setThinkingLevel("medium");
    await handlers.get("model_select")?.(
      { source: "cycle", model: userModel2 },
      ctx,
    );
    await handlers.get("thinking_level_select")?.({ level: "xhigh" }, ctx);
    await handlers.get("input")?.(
      { source: "user", text: "/skill:simplify now" },
      ctx,
    );
    await handlers.get("agent_end")?.({}, ctx);

    expect(pi.setModel).toHaveBeenLastCalledWith(userModel2);
    expect(pi.setThinkingLevel).toHaveBeenLastCalledWith("xhigh");
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
