import type { ModelProfile } from "./types.ts";

export const DEFAULT_THINKING = "medium";

export const PROFILES = {
  mixed: {
    default: { model: "openai-codex/gpt-5.5", thinkingLevel: "low" },
    light: { model: "opencode-go/deepseek-v4-flash", thinkingLevel: "high" },
    heavy: { model: "openai-codex/gpt-5.5", thinkingLevel: "medium" },
  },
  "opencode-only": {
    default: { model: "opencode-go/deepseek-v4-flash", thinkingLevel: "high" },
    light: { model: "opencode-go/deepseek-v4-flash", thinkingLevel: "high" },
    heavy: { model: "opencode-go/deepseek-v4-pro", thinkingLevel: "high" },
  },
} satisfies Record<string, ModelProfile>;

export type ProfileName = keyof typeof PROFILES;

export const FALLBACK_PROFILE: ProfileName = "mixed";

export const ROUTE_TYPES = {
  "/opsx-propose": "heavy",
  "/opsx-apply": "light",
  "/opsx-archive": "light",
  "/review": "heavy",
  "/simplify": "light",
  "/commit": "light",
} as const satisfies Record<string, keyof ModelProfile>;

export type RouteName = keyof typeof ROUTE_TYPES;
