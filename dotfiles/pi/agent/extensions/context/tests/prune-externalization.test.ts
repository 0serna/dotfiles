import { readFileSync, statSync } from "fs";
import { dirname } from "path";
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
    expect(stubText).toContain("saved=/tmp/pi-dcp/test-ext-session/");

    const pathMatch = stubText.match(/saved=([^"\]]+)/);
    expect(pathMatch).not.toBeNull();
    const savedPath = pathMatch![1]!;
    const fileContent = readFileSync(savedPath, "utf8");
    expect(fileContent).toBe(big());
    expect(statSync(dirname(savedPath)).mode & 0o777).toBe(0o700);
    expect(statSync(savedPath).mode & 0o777).toBe(0o600);
  });
});
