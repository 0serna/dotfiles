import { describe, expect, it } from "vitest";
import {
  buildTitlePrompt,
  buildTitleSource,
  extractTitle,
  type SessionEntry,
} from "../title-generation.ts";

function user(content: unknown): SessionEntry {
  return { type: "message", message: { role: "user", content } };
}

describe("buildTitleSource", () => {
  it("uses the three most recent text-bearing user messages in branch order", () => {
    const entries: SessionEntry[] = [
      user("first"),
      { type: "message", message: { role: "assistant", content: "ignored" } },
      user("second"),
      { type: "message", message: { role: "toolResult", content: "ignored" } },
      user("third"),
      user("fourth"),
    ];

    expect(buildTitleSource(entries)).toBe(
      "User: second\n\nUser: third\n\nUser: fourth",
    );
  });

  it("uses available user messages when fewer than three exist", () => {
    expect(buildTitleSource([user("one"), user("two")])).toBe(
      "User: one\n\nUser: two",
    );
  });

  it("extracts text blocks and skips image-only or empty messages", () => {
    const entries: SessionEntry[] = [
      user([{ type: "image", data: "data", mimeType: "image/png" }]),
      user([{ type: "text", text: "  text block  " }]),
      user(""),
    ];

    expect(buildTitleSource(entries)).toBe("User: text block");
  });

  it("returns an empty source without text-bearing user messages", () => {
    expect(
      buildTitleSource([
        { type: "message", message: { role: "assistant", content: "reply" } },
      ]),
    ).toBe("");
  });
});

describe("buildTitlePrompt", () => {
  it("requires the predominant language and at most five words", () => {
    expect(buildTitlePrompt("User: arregla el inicio de sesión")).toContain(
      "Use the predominant language of the user messages.\nUse at most five words.",
    );
  });
});

describe("extractTitle", () => {
  it("preserves a non-compliant response instead of discarding the model call", () => {
    expect(
      extractTitle([
        { type: "text", text: "A title with more than five words" },
      ]),
    ).toBe("A title with more than five words");
  });
});
