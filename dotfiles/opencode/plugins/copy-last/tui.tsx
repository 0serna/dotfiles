import { Plugin } from "@opencode/plugin/tui";
import { runCopyLast } from "./command";

export default Plugin.define({
  id: "copy-last",
  setup(context) {
    let registered = false;
    return context.ui.slot({
      append: "app",
      render: () => {
        if (!registered) {
          registered = true;
          context.keymap.layer(() => ({
            mode: "global",
            commands: [
              {
                id: "copy-last.copy",
                title: "Copy last assistant response",
                slash: { name: "last" },
                run: () => runCopyLast(context),
              },
            ],
          }));
        }
        return null;
      },
    });
  },
});
