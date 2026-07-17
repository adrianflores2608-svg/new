import { AxiosError } from "axios";

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
}

function isRetryable(err: unknown): boolean {
  const axiosErr = err as AxiosError;
  if (!axiosErr?.isAxiosError) return true; // network error, timeout, etc. — worth retrying
  const status = axiosErr.response?.status;
  return status === undefined || status === 429 || status >= 500;
}

function retryDelayMs(err: unknown, attempt: number, baseDelayMs: number): number {
  const axiosErr = err as AxiosError;
  const retryAfterHeader = axiosErr?.response?.headers?.["retry-after"];
  const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
  if (retryAfterMs && Number.isFinite(retryAfterMs)) return retryAfterMs;
  return baseDelayMs * 2 ** attempt;
}

/**
 * Retries transient failures (network errors, 429 rate limits, 5xx) with
 * exponential backoff (or the server's Retry-After header, when present).
 * Non-retryable errors (4xx other than 429) fail immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === opts.attempts - 1;
      if (isLastAttempt || !isRetryable(err)) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(err, attempt, opts.baseDelayMs)));
    }
  }

  throw lastError;
}
