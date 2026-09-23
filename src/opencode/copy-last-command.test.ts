import type { Context } from "@opencode/plugin/tui/context";
import { describe, expect, it, vi } from "vitest";
import { runCopyLast } from "../../dotfiles/opencode/plugins/copy-last/command";

function context(
  route: { type: "home" } | { type: "session"; sessionID: string },
) {
  const toast = vi.fn();
  const copy = vi.fn(() => true);
  const messages = [
    {
      id: "msg",
      type: "assistant" as const,
      time: { created: 1, completed: 2 },
      finish: "stop" as const,
      content: [
        {
          type: "text" as const,
          text: "# Answer\n\n[Docs](https://example.com)",
        },
      ],
      agent: "build",
      model: { providerID: "test", id: "test" },
    },
  ];
  const list = vi.fn(async () => ({ data: messages, cursor: {} }));
  const input = {
    ui: { router: { current: () => route }, toast: { show: toast } },
    client: { message: { list } },
    renderer: { isOsc52Supported: () => true, copyToClipboardOSC52: copy },
  };
  return { input: input as unknown as Context, toast, copy, list, messages };
}

describe("runCopyLast", () => {
  it("copies only the current session's final answer and reports success", async () => {
    const { input, toast, copy, list } = context({
      type: "session",
      sessionID: "current",
    });
    await runCopyLast(input);
    expect(list).toHaveBeenCalledWith({
      sessionID: "current",
      type: "assistant",
      limit: 50,
      order: "desc",
    });
    expect(copy).toHaveBeenCalledWith("Answer\n\nDocs (https://example.com)");
    expect(toast).toHaveBeenCalledWith({
      message: "Response copied",
      variant: "success",
    });
  });

  it("does not copy from home or when there is no final answer", async () => {
    const home = context({ type: "home" });
    await runCopyLast(home.input);
    expect(home.list).not.toHaveBeenCalled();
    expect(home.copy).not.toHaveBeenCalled();
    expect(home.toast).toHaveBeenCalledWith({
      message: "No active session",
      variant: "error",
    });

    const session = context({ type: "session", sessionID: "current" });
    session.messages.length = 0;
    await runCopyLast(session.input);
    expect(session.copy).not.toHaveBeenCalled();
    expect(session.toast).toHaveBeenCalledWith({
      message: "No final response to copy",
      variant: "error",
    });
  });

  it("reports a rejected clipboard write without a success toast", async () => {
    const { input, copy, toast } = context({
      type: "session",
      sessionID: "current",
    });
    copy.mockReturnValue(false);
    await runCopyLast(input);
    expect(toast).toHaveBeenCalledWith({
      message: "Terminal clipboard unavailable",
      variant: "error",
    });
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });
});
