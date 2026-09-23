import { describe, expect, it } from "vitest";
import { plainText } from "../../dotfiles/opencode/plugins/copy-last/plain-text";

describe("plainText", () => {
  it("keeps paragraphs, lists, links and pipe-separated tables readable", () => {
    expect(
      plainText(
        "# Title\n\nA **bold** [link](https://example.com) and `inline code`.\n\n- First\n- Second\n> A quote\n\n| One | Two |\n| --- | --- |\n| A | B |",
      ),
    ).toBe(
      "Title\n\nA bold link (https://example.com) and inline code.\n\n• First\n• Second\nA quote\n\n| One | Two |\n| --- | --- |\n| A | B |",
    );
  });

  it("keeps code contents and indentation without fences or language labels", () => {
    expect(
      plainText(
        "```ts\n  const value = `hi`;\n    return value;\n```\n\n~~~sh\necho hello\n~~~",
      ),
    ).toBe("  const value = `hi`;\n    return value;\n\necho hello");
  });

  it("preserves Markdown-looking characters inside inline code", () => {
    expect(
      plainText(
        "Use `foo_bar_baz`, `*foo*`, and `[label](url)` with **care**.",
      ),
    ).toBe("Use foo_bar_baz, *foo*, and [label](url) with care.");
    expect(plainText("**Bold** then ``foo`_bar_*baz*`` and *italic*.")).toBe(
      "Bold then foo`_bar_*baz* and italic.",
    );
  });
});
