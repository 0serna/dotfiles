import { describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "../../dotfiles/opencode/plugins/copy-last/clipboard";

describe("copyToClipboard", () => {
  it("writes only when the renderer supports OSC 52", () => {
    const copy = vi.fn(() => true);
    expect(
      copyToClipboard(
        { isOsc52Supported: () => true, copyToClipboardOSC52: copy },
        "answer",
      ),
    ).toBe(true);
    expect(copy).toHaveBeenCalledWith("answer");
    copy.mockClear();
    expect(
      copyToClipboard(
        { isOsc52Supported: () => false, copyToClipboardOSC52: copy },
        "answer",
      ),
    ).toBe(false);
    expect(copy).not.toHaveBeenCalled();
  });

  it("rejects absent, failed, and throwing renderer methods", () => {
    expect(copyToClipboard({}, "answer")).toBe(false);
    expect(
      copyToClipboard(
        { isOsc52Supported: () => true, copyToClipboardOSC52: () => false },
        "answer",
      ),
    ).toBe(false);
    expect(
      copyToClipboard(
        {
          isOsc52Supported: () => true,
          copyToClipboardOSC52: () => {
            throw Error("disconnected");
          },
        },
        "answer",
      ),
    ).toBe(false);
  });
});
