import type { ExtensionLogger } from "../shared/logger.js";

export const STALE_LARGE_MIN_AGE = 20;
export const TARGET_MAX_LENGTH = 120;

export type PruneReason = "superseded" | "stale_large";

export interface ToolMetadata {
  toolCallId: string | null;
  toolName: string;
  target: string;
  semanticOperationKey: string | null;
  supersedeKey: string | null;
  isFileOperation: boolean;
}

export interface ToolResultCandidate {
  index: number;
  message: Record<string, unknown>;
  text: string;
  metadata: ToolMetadata;
  dcpAge: number;
  policy: ReadonlySet<PruneReason>;
}

export interface StubDecision {
  candidate: ToolResultCandidate;
  reason: PruneReason;
}

export interface PruneMetrics {
  contextSequence?: number;
  processedCount: number;
  stubbedCount: number;
  reasonCounts: Record<PruneReason, number>;
  estimatedSavedTokens: number;
  estimatedSavedTokensByReason: Record<PruneReason, number>;
  estimatedSavedTokensByTool: Record<string, number>;
  targets: Array<{
    index: number;
    reason: PruneReason;
    toolName: string;
    target: string;
  }>;
}

export interface PruneOptions {
  logger?: ExtensionLogger;
  contextSequence?: number;
}
