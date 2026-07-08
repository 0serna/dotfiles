export type RetryOptions = {
  maxAttempts: number;
  initialDelayMs: number;
};

export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function retryNullable<T>(
  operation: (attempt: number) => Promise<T | null>,
  options: RetryOptions,
  delay: DelayFn = defaultDelay,
): Promise<T | null> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      if (result != null) return result;
    } catch {
      // Treat thrown fetch errors as failed attempts; caller decides how to log
      // the final provider error after retries are exhausted.
    }

    if (attempt < options.maxAttempts) {
      await delay(options.initialDelayMs * attempt);
    }
  }

  return null;
}
