import { estimateTokens as estimateMessageTokens } from "@earendil-works/pi-coding-agent";
import type { StubDecision } from "../types.js";
import { buildStub } from "./stub.js";

function estimateToolResultTokens(text: string, toolName: string): number {
  return estimateMessageTokens({
    role: "toolResult",
    toolCallId: "context-prune-estimate",
    toolName,
    content: [{ type: "text", text }],
    isError: false,
    timestamp: 0,
  });
}

export function estimatedSavedTokens(decision: StubDecision): number {
  const toolName = decision.candidate.metadata.toolName;
  const stubText = buildStub(decision.reason);

  return Math.max(
    0,
    estimateToolResultTokens(decision.candidate.text, toolName) -
      estimateToolResultTokens(stubText, toolName),
  );
}
