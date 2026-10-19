import { Plugin } from "@opencode/plugin";
import { lastStepTokens, statusNote } from "./usage";

export default Plugin.define({
  id: "context-report",
  async setup(ctx) {
    await ctx.session.hook("context", async (request) => {
      const messages = await ctx.session.context({
        sessionID: request.sessionID,
      });
      const tokens = lastStepTokens(messages);
      if (tokens == null) return;
      request.messages.push(statusNote(tokens));
    });
  },
});
