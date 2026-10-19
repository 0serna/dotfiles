import { describe, expect, it } from "vitest";
import {
  lastStepTokens,
  statusNote,
  totalTokens,
} from "../../dotfiles/opencode/plugins/context-report/usage";

const tokens = {
  input: 200000,
  output: 1000,
  reasoning: 384,
  cache: { read: 70000, write: 0 },
};

describe("context report usage", () => {
  it("totals every token category", () => {
    expect(totalTokens(tokens)).toBe(271384);
  });

  it("uses the last assistant step", () => {
    expect(
      lastStepTokens([{ type: "user" }, { type: "assistant", tokens }]),
    ).toBe(271384);
  });

  it("ignores steps before the latest compaction", () => {
    expect(
      lastStepTokens([{ type: "assistant", tokens }, { type: "compaction" }]),
    ).toBeUndefined();

    expect(
      lastStepTokens([
        { type: "assistant", tokens },
        { type: "compaction" },
        {
          type: "assistant",
          tokens: {
            input: 1,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
        },
      ]),
    ).toBe(1);
  });

  it("builds the request-local status note", () => {
    expect(statusNote(271384)).toEqual({
      role: "user",
      content: [{ type: "text", text: "status: 271384" }],
    });
  });
});
