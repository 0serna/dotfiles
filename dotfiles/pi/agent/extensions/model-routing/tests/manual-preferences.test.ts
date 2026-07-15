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
  emptyThinkingPreferences,
  loadThinkingPreferences,
  saveThinkingPreferences,
  withRememberedSelection,
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

describe("loadThinkingPreferences", () => {
  it("returns empty preferences when the file is missing", async () => {
    readFileMock.mockRejectedValue(missingFileError());
    await expect(loadThinkingPreferences()).resolves.toEqual({
      thinkingMemory: {},
    });
  });

  it("retains thinking memory and ignores a legacy selection", async () => {
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
    await expect(loadThinkingPreferences()).resolves.toEqual({
      thinkingMemory: { "user/a": "high", "user/b": "low" },
    });
  });

  it("ignores a malformed legacy selection", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        selection: {
          modelProvider: "user",
          modelId: "a",
          thinkingLevel: "nope",
        },
        thinkingMemory: { "user/a": "high" },
      }),
    );
    await expect(loadThinkingPreferences()).resolves.toEqual({
      thinkingMemory: { "user/a": "high" },
    });
  });

  it("returns empty preferences when the document is not an object", async () => {
    readFileMock.mockResolvedValue(JSON.stringify(["bad"]));
    await expect(loadThinkingPreferences()).resolves.toEqual({
      thinkingMemory: {},
    });
  });
});

describe("saveThinkingPreferences", () => {
  it("writes the file as an atomic rename of a temp file", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue();
    renameMock.mockResolvedValue();

    const prefs = withRememberedSelection(emptyThinkingPreferences(), {
      modelProvider: "user",
      modelId: "a",
      thinkingLevel: "high",
    });
    await saveThinkingPreferences(prefs);

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

    const first = saveThinkingPreferences({
      thinkingMemory: { "user/a": "high" },
    });
    await firstStarted;

    const second = saveThinkingPreferences({
      thinkingMemory: { "user/b": "xhigh" },
    });
    expect(writeCount).toBe(1);
    const loaded = loadThinkingPreferences();
    releaseFirstWrite();
    await Promise.all([first, second]);
    await expect(loaded).resolves.toEqual({
      thinkingMemory: { "user/b": "xhigh" },
    });
  });

  it("does not throw when the filesystem write fails", async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockRejectedValue(new Error("disk full"));
    await expect(
      saveThinkingPreferences({ thinkingMemory: {} }),
    ).resolves.toBeUndefined();
  });
});

describe("withRememberedSelection", () => {
  it("returns a new record that updates memory for the selected model", () => {
    const next = withRememberedSelection(emptyThinkingPreferences(), {
      modelProvider: "user",
      modelId: "a",
      thinkingLevel: "high",
    });
    expect(next).toEqual({
      thinkingMemory: { "user/a": "high" },
    });
  });

  it("preserves unrelated memory entries", () => {
    const next = withRememberedSelection(
      { thinkingMemory: { "user/b": "low" } },
      { modelProvider: "user", modelId: "a", thinkingLevel: "high" },
    );
    expect(next.thinkingMemory).toEqual({
      "user/a": "high",
      "user/b": "low",
    });
  });
});
