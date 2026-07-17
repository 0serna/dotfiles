import { complete } from "@earendil-works/pi-ai/compat";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { createExtensionLogger } from "../shared/logger.ts";
import {
  buildTitlePrompt,
  buildTitleSource,
  extractTitle,
  type SessionEntry,
} from "./title-generation.ts";

const TITLE_PROVIDER = "opencode-go";
const TITLE_MODEL = "deepseek-v4-flash";

function notify(
  ctx: ExtensionCommandContext,
  message: string,
  level: "info" | "warning" | "error",
): void {
  if (ctx.hasUI) ctx.ui.notify(message, level);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("rename", {
    description: "Generate a session title from recent user messages",
    handler: async (_args, ctx) => {
      const logger = createExtensionLogger(ctx, "rename");
      const source = buildTitleSource(
        ctx.sessionManager.getBranch() as SessionEntry[],
      );
      if (!source) {
        notify(
          ctx,
          "No user messages available to generate a title.",
          "warning",
        );
        return;
      }

      const model = ctx.modelRegistry.find(TITLE_PROVIDER, TITLE_MODEL);
      if (!model) {
        notify(
          ctx,
          `Title model ${TITLE_PROVIDER}/${TITLE_MODEL} is unavailable.`,
          "error",
        );
        return;
      }

      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (!auth.ok || !auth.apiKey) {
        notify(ctx, "No API key available for the title model.", "error");
        return;
      }

      notify(ctx, "Generating session title...", "info");

      try {
        const response = await complete(
          model,
          {
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: buildTitlePrompt(source) }],
                timestamp: Date.now(),
              },
            ],
          },
          {
            apiKey: auth.apiKey,
            headers: auth.headers,
            env: auth.env,
            reasoningEffort: "high",
          },
        );

        const contentTypes = response.content.map((block) => block.type);
        const responseDetails = {
          contentTypes,
          stopReason: response.stopReason,
          errorMessage: response.errorMessage,
          usage: response.usage,
        };
        logger.log("generation_completed", responseDetails);

        if (response.stopReason === "error") {
          const message = response.errorMessage ?? "Unknown model error.";
          logger.log("generation_failed", responseDetails);
          notify(ctx, `Title generation failed: ${message}`, "error");
          return;
        }

        const title = extractTitle(response.content);
        if (!title) {
          logger.log("generation_empty", {
            contentTypes,
            stopReason: response.stopReason,
            usage: response.usage,
          });
          notify(ctx, "Title model returned an empty title.", "error");
          return;
        }

        pi.setSessionName(title);
        notify(ctx, `Session renamed: "${title}"`, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.log("generation_failed", { message });
        notify(ctx, `Title generation failed: ${message}`, "error");
      }
    },
  });
}
