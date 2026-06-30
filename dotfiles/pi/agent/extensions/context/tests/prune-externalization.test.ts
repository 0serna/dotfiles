import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { pruneMessages } from "../prune.ts";
import {
  assistantToolCall,
  big,
  dcpTail,
  textOf,
  toolResult,
} from "./prune.test-utils.ts";

describe("context DCP pruning externalization", () => {
  it("externalizes pruned output to a file", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      sessionId: "test-ext-session",
    });

    const stubText = textOf(pruned[1]!);
    expect(stubText).toContain("reason=stale_large");
    expect(stubText).toContain("saved=/tmp/pi-dcp/test-ext-session-0001.txt");

    const pathMatch = stubText.match(/saved=([^"\]]+)/);
    expect(pathMatch).not.toBeNull();
    const savedPath = pathMatch![1]!;
    const fileContent = readFileSync(savedPath, "utf8");
    expect(fileContent).toBe(big());
    expect(statSync(dirname(savedPath)).mode & 0o777).toBe(0o700);
    expect(statSync(savedPath).mode & 0o777).toBe(0o600);
  });

  it("reuses existing Pi bash full-output path instead of creating DCP-owned copy", () => {
    const existingPath = join(tmpdir(), "pi-bash-testreuse.log");
    writeFileSync(existingPath, "full original output content", {
      encoding: "utf8",
      mode: 0o644,
    });

    const truncatedText = `[Showing lines 1-20 of 200. Full output: ${existingPath}]`;
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big() + truncatedText),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      sessionId: "test-reuse-session",
    });

    const stubText = textOf(pruned[1]!);
    expect(stubText).toContain("reason=stale_large");
    expect(stubText).toContain(`saved=${existingPath}`);
    expect(stubText).not.toContain("saved=/tmp/pi-dcp/test-reuse-session-");
    expect(readFileSync(existingPath, "utf8")).toBe(
      "full original output content",
    );
    expect(statSync(existingPath).mode & 0o777).toBe(0o644);
  });

  it("reuses existing web_fetch full-content path instead of creating DCP-owned copy", () => {
    const existingDir = join(tmpdir(), "pi-web-fetch");
    const existingPath = join(
      existingDir,
      "123e4567-e89b-12d3-a456-426614174000.txt",
    );
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(existingPath, "full fetched content", {
      encoding: "utf8",
      mode: 0o600,
    });

    const truncatedText = `[Content truncated: 20 of 200 lines. Full content saved to: ${existingPath}]`;
    const messages = [
      assistantToolCall("a", "web_fetch", { url: "https://example.com" }),
      toolResult("a", "web_fetch", big() + truncatedText),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      sessionId: "test-web-fetch-reuse-session",
    });

    const stubText = textOf(pruned[1]!);
    expect(stubText).toContain("reason=stale_large");
    expect(stubText).toContain(`saved=${existingPath}`);
    expect(stubText).not.toContain(
      "saved=/tmp/pi-dcp/test-web-fetch-reuse-session-",
    );
    expect(readFileSync(existingPath, "utf8")).toBe("full fetched content");
  });

  it("falls back to DCP-owned file when web_fetch full-content path is missing", () => {
    const missingPath = join(
      tmpdir(),
      "pi-web-fetch",
      "123e4567-e89b-12d3-a456-426614174999.txt",
    );
    const truncatedText = `[Content truncated: 20 of 200 lines. Full content saved to: ${missingPath}]`;
    const messages = [
      assistantToolCall("a", "web_fetch", { url: "https://example.com" }),
      toolResult("a", "web_fetch", big() + truncatedText),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      sessionId: "test-web-fetch-fallback-session",
    });

    const stubText = textOf(pruned[1]!);
    expect(stubText).toContain("reason=stale_large");
    expect(stubText).toContain(
      "saved=/tmp/pi-dcp/test-web-fetch-fallback-session-0001.txt",
    );
    expect(stubText).not.toContain(missingPath);
  });

  it("falls back to DCP-owned file when full-output path is missing", () => {
    const missingPath = "/tmp/pi-bash-nonexistent-12345.log";
    const truncatedText = `[Showing lines 1-20 of 200. Full output: ${missingPath}]`;
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big() + truncatedText),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      sessionId: "test-fallback-session",
    });

    const stubText = textOf(pruned[1]!);
    expect(stubText).toContain("reason=stale_large");
    expect(stubText).toContain(
      "saved=/tmp/pi-dcp/test-fallback-session-0001.txt",
    );
    expect(stubText).not.toContain(missingPath);

    const pathMatch = stubText.match(/saved=([^"\]]+)/);
    expect(pathMatch).not.toBeNull();
    const savedPath = pathMatch![1]!;
    expect(existsSync(savedPath)).toBe(true);
  });

  it("DCP-owned fallback files keep private permissions", () => {
    const missingPath = "/tmp/pi-bash-nonexistent-perms.log";
    const truncatedText = `[Showing lines 1-20 of 200. Full output: ${missingPath}]`;
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big() + truncatedText),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      sessionId: "test-perms-session",
    });

    const stubText = textOf(pruned[1]!);
    const pathMatch = stubText.match(/saved=([^"\]]+)/);
    expect(pathMatch).not.toBeNull();
    const savedPath = pathMatch![1]!;
    expect(statSync(savedPath).mode & 0o777).toBe(0o600);
    expect(statSync(dirname(savedPath)).mode & 0o777).toBe(0o700);
  });
});
