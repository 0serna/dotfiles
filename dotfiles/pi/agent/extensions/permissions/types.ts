import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

export type ChoiceResult =
  | { type: "allow-once" }
  | { type: "allow-session" }
  | { type: "block" };

export interface CmdInfo {
  command: string;
  scope: string;
  approvalKey: string;
}

export type BlockResult = { block: true; reason: string };
