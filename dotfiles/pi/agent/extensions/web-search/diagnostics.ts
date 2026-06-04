export interface ErrorDetails {
  name?: string;
  message: string;
  code?: string;
  cause?: ErrorDetails;
}

export interface ResponseDetails {
  status: number;
  statusText: string;
  bodySnippet?: string;
}

export class HttpResponseError extends Error {
  readonly response: ResponseDetails;

  constructor(message: string, response: ResponseDetails) {
    super(message);
    this.name = "HttpResponseError";
    this.response = response;
  }
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : undefined;
}

function serializeSingleError(err: unknown): ErrorDetails {
  if (err instanceof Error) {
    const details: ErrorDetails = {
      name: err.name,
      message: err.message,
    };
    const code = getStringProperty(err, "code");
    if (code) details.code = code;
    return details;
  }

  return { message: String(err) };
}

export function serializeError(err: unknown): ErrorDetails {
  const details = serializeSingleError(err);
  const cause = getCause(err);
  if (cause !== undefined) {
    details.cause = serializeSingleError(cause);
  }
  return details;
}

export function getResponseDetails(err: unknown): ResponseDetails | undefined {
  if (err instanceof HttpResponseError) {
    return err.response;
  }
  return undefined;
}

export async function responseDetails(
  response: Response,
): Promise<ResponseDetails> {
  const bodySnippet = await response.text().catch(() => "unknown error");
  return {
    status: response.status,
    statusText: response.statusText,
    bodySnippet: bodySnippet.slice(0, 200),
  };
}

function getCause(err: unknown): unknown {
  if (typeof err !== "object" || err === null || !("cause" in err)) {
    return undefined;
  }
  return (err as { cause?: unknown }).cause;
}
