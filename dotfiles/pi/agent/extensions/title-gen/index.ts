import { complete, getModel } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ContentBlock = {
  type?: string;
  text?: string;
};

type SessionEntry = {
  type: string;
  message?: {
    role?: string;
    content?: unknown;
  };
};

const MAX_MESSAGES = 10;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b): b is ContentBlock =>
        !!b &&
        typeof b === "object" &&
        b.type === "text" &&
        typeof b.text === "string",
    )
    .map((b) => b.text!)
    .join("\n")
    .trim();
}

function buildConversationSnippet(
  entries: SessionEntry[],
  maxMessages: number,
): string {
  const messages: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message?.role) continue;
    const { role, content } = entry.message;
    if (role !== "user" && role !== "assistant") continue;
    const text = extractText(content);
    if (!text) continue;
    messages.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
  }
  // Take only the last N messages
  return messages.slice(-maxMessages).join("\n\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("title", {
    description: "Generate a session title from recent messages",
    handler: async (_args, ctx) => {
      const branch = ctx.sessionManager.getBranch();
      const snippet = buildConversationSnippet(
        branch as SessionEntry[],
        MAX_MESSAGES,
      );

      if (!snippet) {
        ctx.ui.notify(
          "No conversation messages to generate a title from.",
          "warning",
        );
        return;
      }

      ctx.ui.notify("Generating title...", "info");

      // Use the current session model (or fall back to a default)
      const model = ctx.model ?? getModel("anthropic", "claude-sonnet-4-5");
      if (!model) {
        ctx.ui.notify("No model available for title generation.", "error");
        return;
      }

      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (!auth.ok || !auth.apiKey) {
        ctx.ui.notify("No API key available for the selected model.", "error");
        return;
      }

      const prompt = [
        "Generate a short, descriptive title (max 6 words) for this conversation.",
        "Reply with ONLY the title, no quotes, no punctuation at the end.",
        "",
        "<conversation>",
        snippet,
        "</conversation>",
      ].join("\n");

      const messages = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: prompt }],
          timestamp: Date.now(),
        },
      ];

      try {
        const response = await complete(
          model,
          { messages },
          {
            apiKey: auth.apiKey,
            headers: auth.headers,
            env: auth.env,
            reasoningEffort: "minimal",
          },
        );

        const title = response.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text.trim())
          .join(" ")
          .replace(/^["']|["']$/g, ""); // Strip surrounding quotes

        if (!title) {
          ctx.ui.notify("Model returned an empty title.", "error");
          return;
        }

        pi.setSessionName(title);
        ctx.ui.notify(`Session renamed: "${title}"`, "info");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Title generation failed: ${message}`, "error");
      }
    },
  });
}
