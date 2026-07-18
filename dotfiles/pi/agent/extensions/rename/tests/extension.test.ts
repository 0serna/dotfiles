import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

import extensionFactory from "../index.ts";

type CommandHandler = (args: string, ctx: unknown) => Promise<void>;

function createSetup() {
  let handler: CommandHandler | undefined;
  const setSessionName = vi.fn();
  const pi = {
    registerCommand: vi.fn((_name, command) => {
      handler = command.handler as CommandHandler;
    }),
    setSessionName,
  } as unknown as ExtensionAPI;
  const ctx = {
    hasUI: true,
    ui: { notify: vi.fn() },
  };

  extensionFactory(pi);

  return { ctx, handler: handler!, pi, setSessionName };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("rename extension", () => {
  it("registers /rename", () => {
    const setup = createSetup();

    expect(setup.pi.registerCommand).toHaveBeenCalledWith(
      "rename",
      expect.objectContaining({
        description: "Rename the session with the given text",
      }),
    );
  });

  it("renames the session with the provided text", async () => {
    const setup = createSetup();

    await setup.handler("mi sesion bonita", setup.ctx);

    expect(setup.setSessionName).toHaveBeenCalledWith("mi sesion bonita");
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      'Session renamed: "mi sesion bonita"',
      "info",
    );
  });

  it("trims whitespace from the arguments", async () => {
    const setup = createSetup();

    await setup.handler("  espacios  ", setup.ctx);

    expect(setup.setSessionName).toHaveBeenCalledWith("espacios");
  });

  it("shows usage when no arguments are provided", async () => {
    const setup = createSetup();

    await setup.handler("", setup.ctx);

    expect(setup.setSessionName).not.toHaveBeenCalled();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Usage: /rename <session name>",
      "warning",
    );
  });

  it("shows usage when only whitespace is provided", async () => {
    const setup = createSetup();

    await setup.handler("   ", setup.ctx);

    expect(setup.setSessionName).not.toHaveBeenCalled();
    expect(setup.ctx.ui.notify).toHaveBeenCalledWith(
      "Usage: /rename <session name>",
      "warning",
    );
  });
});
