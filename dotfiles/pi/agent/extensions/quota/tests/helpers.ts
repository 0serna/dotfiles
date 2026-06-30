import type { ExtensionContext } from "../types.js";

export function makeContext(): ExtensionContext {
  return {
    ui: {
      setStatus: () => {},
      theme: {
        fg: (style: string, text: string) => `<${style}>${text}</${style}>`,
      },
    },
  } as unknown as ExtensionContext;
}

export function stripStyles(value: string | null): string | null {
  return value?.replaceAll(/<\/?[^>]+>/g, "") ?? null;
}
