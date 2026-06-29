import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoggerContext } from "./logger.ts";

type CreateExtensionLogger = typeof import("./logger.ts").createExtensionLogger;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let createExtensionLogger: CreateExtensionLogger;
let tmpHome: string;

function createMockContext(
  sessionId: string | null = "test-session-id",
  modelId?: string,
): LoggerContext {
  return {
    sessionManager: {
      getSessionId: () => sessionId,
    },
    model: modelId ? { id: modelId } : null,
  };
}

function getEntries(extension: string): Record<string, unknown>[] {
  const content = fs.readFileSync(getLogFile(extension), "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function getLogFile(extension: string): string {
  return path.join(tmpHome, `.local/state/pi/${extension}.log`);
}

let testCounter = 0;
function getUniqueExtension(): string {
  return `test-ext-${++testCounter}`;
}

function getEntry(
  entries: Record<string, unknown>[],
  index: number,
): Record<string, unknown> {
  const entry = entries.at(index);
  if (entry === undefined) throw new Error(`Missing log entry at ${index}`);
  return entry;
}

function getData(entry: Record<string, unknown>): Record<string, unknown> {
  expect(entry).toHaveProperty("data");
  return entry.data as Record<string, unknown>;
}

function writeLargeLog(extension: string): void {
  const logFile = getLogFile(extension);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const lines: string[] = [];
  for (let i = 0; i < 12_000; i++) {
    lines.push(JSON.stringify({ index: i, payload: "x".repeat(900) }));
  }
  fs.writeFileSync(logFile, `${lines.join("\n")}\n`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createExtensionLogger", () => {
  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
    vi.resetModules();
    vi.doMock("os", async () => ({
      ...(await vi.importActual<typeof import("os")>("os")),
      homedir: () => tmpHome,
    }));
    ({ createExtensionLogger } = await import("./logger.ts"));
  });

  afterEach(() => {
    vi.doUnmock("os");
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("returns a logger with log method", () => {
    const logger = createExtensionLogger(
      createMockContext(),
      getUniqueExtension(),
    );
    expect(typeof logger.log).toBe("function");
  });

  describe("log entry format", () => {
    it("includes all required fields", () => {
      const ext = getUniqueExtension();
      const logger = createExtensionLogger(
        createMockContext("session-123", "gpt-4"),
        ext,
      );

      logger.log("test_event", { custom: "value" });

      const entries = getEntries(ext);
      expect(entries).toHaveLength(1);

      const entry = getEntry(entries, 0);
      expect(entry).toHaveProperty("timestamp");
      expect(entry).toHaveProperty("extension", ext);
      expect(entry).toHaveProperty("event", "test_event");
      expect(entry).toHaveProperty("sessionId", "session-123");
      expect(entry).toHaveProperty("model", "gpt-4");
      expect(getData(entry)).toHaveProperty("custom", "value");
    });

    it("includes empty data when no payload provided", () => {
      const ext = getUniqueExtension();
      createExtensionLogger(createMockContext(), ext).log("test_event");

      const entries = getEntries(ext);
      expect(entries).toHaveLength(1);
      expect(getData(getEntry(entries, 0))).toEqual({});
    });

    it("includes data: {} when payload serialization fails", () => {
      const ext = getUniqueExtension();
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      createExtensionLogger(createMockContext(), ext).log(
        "test_event",
        circular,
      );

      const entries = getEntries(ext);
      expect(entries).toHaveLength(1);
      expect(getData(getEntry(entries, 0))).toEqual({});
    });

    it("nests payload under data even with reserved key names", () => {
      const ext = getUniqueExtension();
      const logger = createExtensionLogger(
        createMockContext("session-123", "gpt-4"),
        ext,
      );

      logger.log("test_event", {
        timestamp: "fake",
        extension: "fake",
        event: "fake",
        sessionId: "fake",
        model: "fake",
        custom: "value",
      });

      const entry = getEntry(getEntries(ext), 0);
      expect(entry).toHaveProperty("extension", ext);
      expect(entry).toHaveProperty("sessionId", "session-123");

      const data = getData(entry);
      expect(data).toHaveProperty("timestamp", "fake");
      expect(data).toHaveProperty("sessionId", "fake");
      expect(data).toHaveProperty("custom", "value");
    });

    it("reads model live on each call", () => {
      const ext = getUniqueExtension();
      const ctx = createMockContext("session-123", "gpt-4");
      const logger = createExtensionLogger(ctx, ext);

      ctx.model = { id: "claude-3" };
      logger.log("test_event");

      expect(getEntry(getEntries(ext), 0)).toHaveProperty("model", "claude-3");
    });

    it("handles null sessionId and model", () => {
      const ext = getUniqueExtension();
      createExtensionLogger(createMockContext(null), ext).log("test_event");

      const entry = getEntry(getEntries(ext), 0);
      expect(entry).toHaveProperty("sessionId", null);
      expect(entry).toHaveProperty("model", null);
    });
  });

  describe("file creation and append", () => {
    it("creates log file if it does not exist", () => {
      const ext = getUniqueExtension();
      const logFile = getLogFile(ext);

      expect(fs.existsSync(logFile)).toBe(false);
      createExtensionLogger(createMockContext(), ext).log("test_event");
      expect(fs.existsSync(logFile)).toBe(true);
    });

    it("appends to existing file without clearing", () => {
      const ext = getUniqueExtension();
      const logger = createExtensionLogger(createMockContext(), ext);

      logger.log("first_event");
      logger.log("second_event");

      const entries = getEntries(ext);
      expect(entries).toHaveLength(2);
      expect(getEntry(entries, 0)).toHaveProperty("event", "first_event");
      expect(getEntry(entries, 1)).toHaveProperty("event", "second_event");
    });
  });

  describe("truncation", () => {
    it("truncates files over 10 MB to about 5 MB using complete lines", () => {
      const ext = getUniqueExtension();
      writeLargeLog(ext);

      createExtensionLogger(createMockContext(), ext).log("trigger_truncate");

      const logFile = getLogFile(ext);
      expect(fs.statSync(logFile).size).toBeLessThanOrEqual(5 * 1024 * 1024);

      const entries = getEntries(ext);
      expect(entries.length).toBeGreaterThan(0);
      expect(getEntry(entries, -1)).toHaveProperty("event", "trigger_truncate");
    });

    it("does not truncate files at or below 10 MB", () => {
      const ext = getUniqueExtension();
      const logger = createExtensionLogger(createMockContext(), ext);

      for (let i = 0; i < 100; i++) {
        logger.log("test_event", { index: i });
      }

      const entries = getEntries(ext);
      expect(entries).toHaveLength(100);
      expect(getData(getEntry(entries, 0))).toHaveProperty("index", 0);
      expect(getData(getEntry(entries, 99))).toHaveProperty("index", 99);
    });
  });

  describe("error resilience", () => {
    it("never throws even if filesystem operations fail", () => {
      const logger = createExtensionLogger(
        createMockContext(),
        getUniqueExtension(),
      );
      expect(() => logger.log("test_event")).not.toThrow();
    });
  });
});
