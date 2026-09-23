import type { SessionMessageInfo } from "@opencode/client";
import { describe, expect, it, vi } from "vitest";
import {
  latestAnswer,
  latestSessionAnswer,
} from "../../dotfiles/opencode/plugins/copy-last/answer";

function assistant(
  created: number,
  finish: "stop" | "length" | "tool-calls" | "error" | undefined,
  content: Array<{ type: "text" | "reasoning"; text: string }>,
  completed = created + 1,
): SessionMessageInfo {
  return {
    type: "assistant",
    id: `message-${created}`,
    agent: "build",
    model: { providerID: "test", id: "test" },
    time: { created, completed },
    finish,
    content,
  };
}

describe("latestAnswer", () => {
  it("selects the newest completed final answer despite intermediate and internal messages", () => {
    const messages = [
      assistant(1, "stop", [{ type: "text", text: "Previous answer" }]),
      assistant(2, "tool-calls", [{ type: "text", text: "Working on it" }]),
      assistant(3, "stop", [
        { type: "reasoning", text: "Private thought" },
        { type: "text", text: "Final " },
        { type: "text", text: "answer" },
      ]),
      assistant(4, undefined, [{ type: "text", text: "Streaming" }]),
    ];

    expect(latestAnswer(messages)).toBe("Final answer");
    expect(latestAnswer([...messages].reverse())).toBe("Final answer");
  });

  it("skips a final message without visible text and a failed response", () => {
    expect(
      latestAnswer([
        assistant(1, "length", [{ type: "text", text: "Last visible" }]),
        assistant(2, "stop", [{ type: "reasoning", text: "Hidden" }]),
        assistant(3, "error", [{ type: "text", text: "Failure" }]),
      ]),
    ).toBe("Last visible");
  });

  it("returns nothing without a final visible response", () => {
    expect(
      latestAnswer([
        assistant(1, "tool-calls", [{ type: "text", text: "Interim" }]),
      ]),
    ).toBeUndefined();
    expect(latestAnswer([])).toBeUndefined();
  });
});

describe("latestSessionAnswer", () => {
  it("pages past intermediate tool messages to find the newest final answer", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: [assistant(4, "tool-calls", [{ type: "text", text: "Working" }])],
        cursor: { next: "older" },
      })
      .mockResolvedValueOnce({
        data: [assistant(3, "stop", [{ type: "text", text: "Answer" }])],
        cursor: {},
      });
    expect(await latestSessionAnswer({ message: { list } }, "current")).toBe(
      "Answer",
    );
    expect(list).toHaveBeenNthCalledWith(1, {
      sessionID: "current",
      type: "assistant",
      limit: 50,
      order: "desc",
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      sessionID: "current",
      type: "assistant",
      limit: 50,
      cursor: "older",
    });
  });
});
