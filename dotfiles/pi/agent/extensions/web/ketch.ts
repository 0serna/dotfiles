import type {
  AgentToolResult,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";

import type { ExtensionLogger } from "../shared/logger.js";
import { writeTempOutput } from "../shared/temp-output.js";

export type WebSurface = "search" | "fetch" | "code" | "docs";

export type WebDetails = {
  surface: WebSurface;
  outputBytes: number;
  resultCount?: number;
  title?: string;
  library?: string;
  truncated: boolean;
  fullOutputPath?: string;
};

export type KetchRequest = {
  surface: WebSurface;
  input: Record<string, unknown>;
  args: string[];
  cwd?: string;
};

export type KetchExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
};

export type KetchExec = (
  command: string,
  args: string[],
  options: { cwd: string; signal?: AbortSignal },
) => Promise<KetchExecResult>;

type RunnerContext = Pick<ExtensionContext, "hasUI" | "ui">;

type KetchRunnerDependencies = {
  exec: KetchExec;
  getLogger(): ExtensionLogger | undefined;
  writeOutput?: typeof writeTempOutput;
};

const EXIT_CLASSIFICATIONS: Record<number, string> = {
  2: "validation",
  3: "not_found",
  4: "upstream",
  5: "precondition",
  6: "cancelled",
};

function classificationFor(
  code: number,
  killed: boolean,
  signal?: AbortSignal,
): string {
  if (killed || signal?.aborted) return "cancelled";
  return EXIT_CLASSIFICATIONS[code] ?? "internal";
}

function shortDiagnostic(diagnostic: string, fallback: string): string {
  const firstLine = diagnostic.trim().split("\n", 1)[0]?.trim();
  return (firstLine || fallback).slice(0, 200);
}

function resultCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["results", "items", "data"]) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  return undefined;
}

function optionalString(value: unknown, keys: string[]): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key];
  }
  return undefined;
}

function summaryDetails(
  surface: WebSurface,
  parsed: unknown,
  outputBytes: number,
): WebDetails {
  const raw: WebDetails = {
    surface,
    outputBytes,
    resultCount: resultCount(parsed),
    title: optionalString(parsed, ["title"]),
    library: optionalString(parsed, ["library", "libraryId"]),
    truncated: false,
  };
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as WebDetails;
}

function notifyFailure(classification: string, ctx: RunnerContext): void {
  if (!ctx.hasUI) return;
  if (classification === "precondition") {
    ctx.ui.notify("Ketch needs setup; see web.log for details.", "error");
  } else if (classification === "internal") {
    ctx.ui.notify("Web research failed internally; see web.log.", "error");
  }
}

export function createKetchRunner(dependencies: KetchRunnerDependencies) {
  const writeOutput = dependencies.writeOutput ?? writeTempOutput;

  return {
    async run(
      request: KetchRequest,
      signal: AbortSignal | undefined,
      ctx: RunnerContext,
    ): Promise<AgentToolResult<WebDetails>> {
      const startedAt = Date.now();
      let execution: KetchExecResult;

      try {
        execution = await dependencies.exec("ketch", request.args, {
          cwd: request.cwd ?? homedir(),
          signal,
        });
      } catch (error) {
        const classification = signal?.aborted ? "cancelled" : "internal";
        const diagnostic =
          error instanceof Error ? error.message : String(error);
        dependencies.getLogger()?.log("request_failed", {
          surface: request.surface,
          input: request.input,
          durationMs: Date.now() - startedAt,
          classification,
          diagnostic,
        });
        notifyFailure(classification, ctx);
        throw new Error(
          `[${classification}] ${shortDiagnostic(diagnostic, "Ketch execution failed")}`,
          { cause: error },
        );
      }

      if (execution.code !== 0 || execution.killed || signal?.aborted) {
        const classification = classificationFor(
          execution.code,
          execution.killed ?? false,
          signal,
        );
        const diagnostic =
          execution.stderr ||
          `Ketch exited with code ${execution.code} without stderr`;
        dependencies.getLogger()?.log("request_failed", {
          surface: request.surface,
          input: request.input,
          durationMs: Date.now() - startedAt,
          exitCode: execution.code,
          classification,
          diagnostic,
        });
        notifyFailure(classification, ctx);
        throw new Error(
          `[${classification}] ${shortDiagnostic(diagnostic, "Ketch command failed")}`,
        );
      }

      let parsed: unknown;
      try {
        if (execution.stdout.trim() === "") throw new Error("empty stdout");
        parsed = JSON.parse(execution.stdout);
      } catch (error) {
        const diagnostic =
          error instanceof Error
            ? `Invalid Ketch JSON: ${error.message}`
            : "Invalid Ketch JSON";
        dependencies.getLogger()?.log("request_failed", {
          surface: request.surface,
          input: request.input,
          durationMs: Date.now() - startedAt,
          exitCode: execution.code,
          classification: "internal",
          diagnostic,
          warning: execution.stderr || undefined,
        });
        notifyFailure("internal", ctx);
        throw new Error(`[internal] ${diagnostic}`, { cause: error });
      }

      const outputBytes = Buffer.byteLength(execution.stdout);
      const details = summaryDetails(request.surface, parsed, outputBytes);
      const truncation = truncateHead(execution.stdout, {
        maxBytes: DEFAULT_MAX_BYTES,
        maxLines: DEFAULT_MAX_LINES,
      });
      let text = truncation.content;

      if (truncation.truncated) {
        try {
          const fullOutputPath = await writeOutput("pi-web", execution.stdout);
          details.truncated = true;
          details.fullOutputPath = fullOutputPath;
          text += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). Full output saved to: ${fullOutputPath}]`;
        } catch (error) {
          const diagnostic =
            error instanceof Error ? error.message : String(error);
          dependencies.getLogger()?.log("request_failed", {
            surface: request.surface,
            input: request.input,
            durationMs: Date.now() - startedAt,
            exitCode: execution.code,
            classification: "internal",
            diagnostic,
          });
          notifyFailure("internal", ctx);
          throw new Error(
            `[internal] ${shortDiagnostic(diagnostic, "Could not persist full Ketch output")}`,
            { cause: error },
          );
        }
      }

      dependencies.getLogger()?.log("request_succeeded", {
        surface: request.surface,
        input: request.input,
        durationMs: Date.now() - startedAt,
        exitCode: execution.code,
        outputBytes,
        resultCount: details.resultCount,
        truncated: details.truncated,
        fullOutputPath: details.fullOutputPath,
        warning: execution.stderr || undefined,
      });

      return { content: [{ type: "text", text }], details };
    },
  };
}

export type KetchRunner = ReturnType<typeof createKetchRunner>;
