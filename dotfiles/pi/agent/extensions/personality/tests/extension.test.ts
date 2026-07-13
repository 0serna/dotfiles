import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import extensionFactory from "../index.ts";

type Handler = (event: unknown, ctx: unknown) => unknown;

function createMockPi(): {
  pi: ExtensionAPI;
  handlers: Record<string, Handler>;
} {
  const handlers: Record<string, Handler> = {};
  const pi = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
    },
  } as unknown as ExtensionAPI;

  return { pi, handlers };
}

it("adds the personality to the system prompt for every model", () => {
  const { pi, handlers } = createMockPi();
  extensionFactory(pi);

  const result = handlers["before_agent_start"]!(
    { systemPrompt: "Base system prompt" },
    { model: { provider: "anthropic", id: "claude-opus-4-6" } },
  );

  expect(result).toEqual({
    systemPrompt:
      "Base system prompt\n\nYou are a pragmatic, effective software engineer. You take engineering quality seriously and use a direct, factual and brief communication style with the user without unnecessary detail.",
  });
});
