import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;

export type ModelRoute = {
  model: string;
  thinkingLevel: ThinkingLevel;
};

export type ModelProfile = {
  default: ModelRoute;
  light: ModelRoute;
  heavy: ModelRoute;
};

export type RouteSnapshot = {
  model: NonNullable<Parameters<ExtensionAPI["setModel"]>[0]> | undefined;
  thinkingLevel: ThinkingLevel;
};

export type PersistedState = {
  activeProfile: string;
};
