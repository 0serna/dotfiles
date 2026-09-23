import type { SessionMessageInfo } from "@opencode/client";

export interface MessageSource {
  message: {
    list(input: {
      sessionID: string;
      type: "assistant";
      limit: number;
      order?: "desc";
      cursor?: string;
    }): Promise<{
      data: SessionMessageInfo[];
      cursor: { next?: string | null };
    }>;
  };
}

export async function latestSessionAnswer(
  client: MessageSource,
  sessionID: string,
): Promise<string | undefined> {
  let cursor: string | undefined;
  do {
    const page = await client.message.list({
      sessionID,
      type: "assistant",
      limit: 50,
      ...(cursor ? { cursor } : { order: "desc" as const }),
    });
    const answer = latestAnswer(page.data);
    if (answer) return answer;
    cursor = page.cursor.next ?? undefined;
  } while (cursor);
}

export function latestAnswer(
  messages: readonly SessionMessageInfo[],
): string | undefined {
  const answers = messages
    .filter(
      (message) =>
        message.type === "assistant" &&
        message.time.completed !== undefined &&
        (message.finish === "stop" || message.finish === "length"),
    )
    .sort((a, b) => b.time.created - a.time.created);

  for (const message of answers) {
    if (message.type !== "assistant") continue;
    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) return text;
  }
}
