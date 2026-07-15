import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
};

type Handler = (event: unknown, ctx: TestContext) => Promise<unknown> | unknown;

export type TestContext = {
  hasUI: boolean;
  model: { id: string };
  sessionManager: { getSessionId(): string };
  ui: { notify: ReturnType<typeof vi.fn> };
};

export function createHarness(
  execImplementation: (
    command: string,
    args: string[],
    options?: Record<string, unknown>,
  ) => Promise<ExecResult> = async () => ({
    stdout: "ketch test",
    stderr: "",
    code: 0,
  }),
) {
  const handlers: Record<string, Handler[]> = {};
  const tools: Array<Record<string, unknown>> = [];
  const exec = vi.fn(execImplementation);
  const registerTool = vi.fn((tool: Record<string, unknown>) =>
    tools.push(tool),
  );
  const pi = {
    exec,
    on(event: string, handler: Handler) {
      (handlers[event] ??= []).push(handler);
    },
    registerTool,
  } as unknown as ExtensionAPI;
  const notify = vi.fn();
  const ctx: TestContext = {
    hasUI: true,
    model: { id: "test-model" },
    sessionManager: { getSessionId: () => "test-session" },
    ui: { notify },
  };

  async function emit(event: string, payload: unknown = {}) {
    for (const handler of handlers[event] ?? []) {
      await handler(payload, ctx);
    }
  }

  return { ctx, emit, exec, handlers, notify, pi, registerTool, tools };
}

export const logger = {
  log: vi.fn(),
};

export function textOf(result: {
  content: Array<{ type: string; text?: string }>;
}) {
  return result.content.find((item) => item.type === "text")?.text ?? "";
}
