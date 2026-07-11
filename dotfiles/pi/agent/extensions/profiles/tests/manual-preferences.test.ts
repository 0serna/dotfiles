import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/home/test",
}));

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import {
  emptyManualPreferences,
  loadManualPreferences,
  saveManualPreferences,
  withSelection,
} from "../manual-preferences.ts";

const mkdirMock = vi.mocked(mkdir);
const readFileMock = vi.mocked(readFile);
const renameMock = vi.mocked(rename);
const writeFileMock = vi.mocked(writeFile);

const FILE = "/home/test/.local/state/pi/manual-preferences.json";
const TMP = `${FILE}.tmp`;

function missingFileError(): Error & { code: string } {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadManualPreferences", () => {
  it("returns empty preferences when the file is missing", async () => {
    readFileMock.mockRejectedValue(missingFileError());
    await expect(loadManualPreferences()).resolves.toEqual({
      selection: null,
      thinkingMemory: {},
    });
  });

  it("returns the parsed record when structurally valid", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        selection: {
          modelProvider: "user",
          modelId: "a",
          thinkingLevel: "high",
        },
        thinkingMemory: { "user/a": "high", "user/b": "low" },
      }),
    );
    await expect(loadManualPreferences()).resolves.toEqual({
      selection: { modelProvider: "user", modelId: "a", thinkingLevel: "high" },
      thinkingMemory: { "user/a": "high", "user/b": "low" },
    });
  });

  it("returns empty preferences when the file is malformed", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        selection: {
          modelProvider: "user",
          modelId: "a",
          thinkingLevel: "nope",
        },
        thinkingMemory: {},
      }),
    );
    await expect(loadManualPreferences()).resolves.toEqual({
      selection: null,
      thinkingMemory: {},
    });
  });

  it("returns empty preferences when the document is not an object", async () => {
    readFileMock.mockResolvedValue(JSON.stringify(["bad"]));
    await expect(loadManualPreferences()).resolves.toEqual({
      selection: null,
      thinkingMemory: {},
    });
  });
});

describe("saveManualPreferences", () => {
  it("writes the file as an atomic rename of a temp file", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();

    const prefs = withSelection(emptyManualPreferences(), {
      modelProvider: "user",
      modelId: "a",
      thinkingLevel: "high",
    });
    await saveManualPreferences(prefs);

    expect(mkdirMock).toHaveBeenCalledWith("/home/test/.local/state/pi", {
      recursive: true,
    });
    expect(writeFileMock).toHaveBeenCalledWith(
      TMP,
      JSON.stringify(prefs, null, 2),
      "utf8",
    );
    expect(renameMock).toHaveBeenCalledWith(TMP, FILE);
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
    let writeCount = 0;
    let lastWritten = "";

    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockImplementation(async (_path, content) => {
      writeCount += 1;
      lastWritten = String(content);
      if (writeCount === 1) {
        firstWriteStarted();
        await firstWriteReleased;
      }
    });
    renameMock.mockResolvedValue();
    readFileMock.mockImplementation(async () => {
      if (!lastWritten) throw missingFileError();
      return lastWritten;
    });

    const first = saveManualPreferences({
      selection: { modelProvider: "user", modelId: "a", thinkingLevel: "high" },
      thinkingMemory: { "user/a": "high" },
    });
    await firstStarted;

    const second = saveManualPreferences({
      selection: {
        modelProvider: "user",
        modelId: "b",
        thinkingLevel: "xhigh",
      },
      thinkingMemory: { "user/b": "xhigh" },
    });
    // While the first write is still in flight, no second write has started.
    expect(writeCount).toBe(1);
    const loaded = loadManualPreferences();
    releaseFirstWrite();
    await Promise.all([first, second]);
    await expect(loaded).resolves.toEqual({
      selection: {
        modelProvider: "user",
        modelId: "b",
        thinkingLevel: "xhigh",
      },
      thinkingMemory: { "user/b": "xhigh" },
    });
  });

  it("does not throw when the filesystem write fails", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockRejectedValue(new Error("disk full"));
    await expect(
      saveManualPreferences({
        selection: {
          modelProvider: "user",
          modelId: "a",
          thinkingLevel: "low",
        },
        thinkingMemory: {},
      }),
    ).resolves.toBeUndefined();
  });
});

describe("withSelection", () => {
  it("returns a new record that records the selection and updates memory for the selected model", () => {
    const next = withSelection(emptyManualPreferences(), {
      modelProvider: "user",
      modelId: "a",
      thinkingLevel: "high",
    });
    expect(next).toEqual({
      selection: { modelProvider: "user", modelId: "a", thinkingLevel: "high" },
      thinkingMemory: { "user/a": "high" },
    });
  });

  it("preserves unrelated memory entries", () => {
    const next = withSelection(
      {
        selection: null,
        thinkingMemory: { "user/b": "low" },
      },
      { modelProvider: "user", modelId: "a", thinkingLevel: "high" },
    );
    expect(next.thinkingMemory).toEqual({
      "user/a": "high",
      "user/b": "low",
    });
  });
});
