import type { Context } from "@opencode/plugin/tui/context";
import { latestSessionAnswer } from "./answer";
import { copyToClipboard } from "./clipboard";
import { plainText } from "./plain-text";

type CopyContext = Pick<Context, "client" | "renderer"> & {
  ui: Pick<Context["ui"], "router" | "toast">;
};

export async function runCopyLast(context: CopyContext): Promise<void> {
  const route = context.ui.router.current();
  if (route.type !== "session") {
    context.ui.toast.show({ message: "No active session", variant: "error" });
    return;
  }

  try {
    const answer = await latestSessionAnswer(context.client, route.sessionID);
    const text = answer && plainText(answer);
    if (!text?.trim()) {
      context.ui.toast.show({
        message: "No final response to copy",
        variant: "error",
      });
      return;
    }
    if (!copyToClipboard(context.renderer, text)) {
      context.ui.toast.show({
        message: "Terminal clipboard unavailable",
        variant: "error",
      });
      return;
    }
    context.ui.toast.show({ message: "Response copied", variant: "success" });
  } catch {
    context.ui.toast.show({
      message: "Unable to read the session response",
      variant: "error",
    });
  }
}
