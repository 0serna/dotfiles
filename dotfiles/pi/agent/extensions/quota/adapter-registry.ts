import type {
  SourceDescriptor,
  SourceExtras,
  SourceWindow,
} from "./snapshot.js";

export type AdapterFetchInput = {
  providerId: string;
  sourceId: string;
  configFingerprint?: string;
  credentials?: unknown;
};

export type AdapterResult =
  | {
      state: "ok";
      windows: {
        rolling?: SourceWindow;
        weekly?: SourceWindow;
        monthly?: SourceWindow;
      };
      extras?: SourceExtras;
    }
  | { state: "skipped"; reason: string }
  | { state: "error"; reason: string; message?: string };

export type AdapterLogger = {
  log(event: string, data?: Record<string, unknown>): void;
};

export type QuotaAdapter = {
  providerId: string;
  describe(input: AdapterFetchInput): SourceDescriptor;
  fetch(
    input: AdapterFetchInput,
    signal: AbortSignal,
    logger: AdapterLogger,
  ): Promise<AdapterResult>;
};
