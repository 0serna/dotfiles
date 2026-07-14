import {
  classifyTransientFailure,
  type TransientFailureSignal,
} from "./classifier.js";

export interface AssistantOutcome {
  stopReason?: string;
  errorMessage?: string;
}

export type SettlementDecision =
  | { kind: "none" }
  | { kind: "recover"; signal: TransientFailureSignal }
  | {
      kind: "suppressed";
      signal: TransientFailureSignal;
      reason: "episode-budget-exhausted";
    };

type EpisodePhase = "available" | "offered" | "recovering" | "closed";

export class RecoveryState {
  private candidate: TransientFailureSignal | undefined;
  private phase: EpisodePhase = "available";

  startIndependentWork(): void {
    this.candidate = undefined;
    this.phase = "available";
  }

  observeAssistantOutcome(outcome: AssistantOutcome): void {
    this.candidate =
      outcome.stopReason === "error"
        ? classifyTransientFailure(outcome.errorMessage)
        : undefined;
  }

  settle(): SettlementDecision {
    if (this.phase === "recovering") {
      const signal = this.candidate;
      this.candidate = undefined;
      this.phase = "closed";
      return signal
        ? { kind: "suppressed", signal, reason: "episode-budget-exhausted" }
        : { kind: "none" };
    }

    if (this.phase !== "available" || !this.candidate) {
      return { kind: "none" };
    }

    const signal = this.candidate;
    this.candidate = undefined;
    this.phase = "offered";
    return { kind: "recover", signal };
  }

  markRecoveryContinuationDispatched(): void {
    if (this.phase === "offered") this.phase = "recovering";
  }

  cancelRecovery(): void {
    this.candidate = undefined;
    if (this.phase === "offered") this.phase = "closed";
  }
}
