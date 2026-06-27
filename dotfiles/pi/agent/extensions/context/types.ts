import type { ExtensionLogger } from "../shared/logger.js";

export const OLD_LARGE_OUTPUT_MIN_AGE = 20;
export const LARGE_OUTPUT_TOKEN_THRESHOLD = 2500;
export const TARGET_MAX_LENGTH = 120;

export type PruneReason =
  | "duplicate_output"
  | "resolved_error"
  | "superseded_file_operation"
  | "old_large_output";

export interface ToolMetadata {
  toolCallId: string | null;
  toolName: string;
  target: string;
  operationKey: string | null;
  isFileOperation: boolean;
  isSkillRead: boolean;
}

export interface ToolResultCandidate {
  index: number;
  message: Record<string, unknown>;
  text: string;
  isError: boolean;
  metadata: ToolMetadata;
  dcpAge: number;
}

export interface StubDecision {
  candidate: ToolResultCandidate;
  reason: PruneReason;
}

export interface PruneMetrics {
  contextSequence?: number;
  processedCount: number;
  stubbedCount: number;
  oldLargeProtectedCount: number;
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
