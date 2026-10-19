export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cache: {
    readonly read: number;
    readonly write: number;
  };
}

export interface ContextMessage {
  readonly type: string;
  readonly tokens?: TokenUsage;
}

export function totalTokens(tokens: TokenUsage): number {
  return (
    tokens.input +
    tokens.output +
    tokens.reasoning +
    tokens.cache.read +
    tokens.cache.write
  );
}

export function lastStepTokens(
  messages: readonly ContextMessage[],
): number | undefined {
  const compaction = messages.findLastIndex(
    (message) => message.type === "compaction",
  );
  const recent = compaction === -1 ? messages : messages.slice(compaction + 1);
  const last = recent.findLast(
    (message) => message.type === "assistant" && message.tokens != null,
  );
  return last?.tokens ? totalTokens(last.tokens) : undefined;
}

export function statusNote(tokens: number) {
  return {
    role: "user" as const,
    content: [{ type: "text" as const, text: `status: ${tokens}` }],
  };
}
