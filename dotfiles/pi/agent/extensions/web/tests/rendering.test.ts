import { describe, expect, it } from "vitest";

import { renderCall, renderResult } from "../rendering.js";

const theme = {
  bold: (text: string) => text,
  fg: (_color: string, text: string) => text,
};
const rendered = (component: { render(width: number): string[] }) =>
  component.render(200).join("\n");

describe("web tool rendering", () => {
  it("renders compact intent-specific call arguments", () => {
    expect(
      rendered(
        renderCall(
          "search",
          { query: "pi extensions", limit: 5 },
          theme as never,
        ),
      ),
    ).toContain("pi extensions");
    expect(
      rendered(
        renderCall("fetch", { url: "https://example.com" }, theme as never),
      ),
    ).toContain("https://example.com");
  });

  it("renders counts or byte summaries without response content", () => {
    const counted = rendered(
      renderResult(
        {
          content: [{ type: "text", text: "SECRET RESPONSE" }],
          details: {
            surface: "search",
            resultCount: 3,
            outputBytes: 200,
            truncated: false,
          },
        } as never,
        { isPartial: false } as never,
        theme as never,
      ),
    );
    expect(counted).toContain("3 results");
    expect(counted).not.toContain("SECRET RESPONSE");

    const bytes = rendered(
      renderResult(
        {
          content: [{ type: "text", text: "PAGE CONTENT" }],
          details: { surface: "fetch", outputBytes: 1536, truncated: false },
        } as never,
        { isPartial: false } as never,
        theme as never,
      ),
    );
    expect(bytes).toContain("1.5KB");
    expect(bytes).not.toContain("PAGE CONTENT");
  });

  it("handles failures, unknown details, and truncation compactly", () => {
    expect(
      rendered(
        renderResult(
          { content: [], details: undefined } as never,
          { isPartial: false } as never,
          theme as never,
        ),
      ),
    ).toContain("No summary");
    expect(
      rendered(
        renderResult(
          { content: [], details: {} } as never,
          { isPartial: false } as never,
          theme as never,
          { isError: true } as never,
        ),
      ),
    ).toContain("Failed");
    expect(
      rendered(
        renderResult(
          {
            content: [],
            details: { outputBytes: 60_000, truncated: true },
          } as never,
          { isPartial: false } as never,
          theme as never,
        ),
      ),
    ).toContain("truncated");
  });
});
