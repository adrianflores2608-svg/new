import axios from "axios";
import { withRetry } from "./retry";

const HELIUS_BASE = "https://api.helius.xyz/v0";
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Shape of Helius' "enhanced transaction history" response, trimmed to the
 * fields this bot actually reads. Helius' API can add/rename fields over
 * time — treat unknown ones as absent rather than throwing.
 * https://docs.helius.dev/solana-apis/enhanced-transactions-api
 */
export interface HeliusTokenTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  mint?: string;
  tokenAmount?: number;
}

export interface HeliusNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number; // lamports
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number; // unix seconds
  source?: string;
  type?: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
}

/**
 * Fetch transactions for a wallet, newest first.
 * - `untilSignature`: stop paging once this signature is reached (used by the
 *   poller to fetch only what's new since the last processed transaction).
 * - `beforeSignature`: start paging from just before this signature (used to
 *   walk further back into history, e.g. for PnL ranking).
 */
export async function fetchWalletTransactions(
  address: string,
  apiKey: string,
  opts: { untilSignature?: string; beforeSignature?: string; limit?: number } = {}
): Promise<HeliusTransaction[]> {
  const params: Record<string, string | number> = {
    "api-key": apiKey,
    limit: opts.limit ?? 50,
  };
  if (opts.untilSignature) {
    params.until = opts.untilSignature;
  }
  if (opts.beforeSignature) {
    params.before = opts.beforeSignature;
  }

  const { data } = await withRetry(
    () =>
      axios.get<HeliusTransaction[]>(`${HELIUS_BASE}/addresses/${address}/transactions`, {
        params,
        timeout: 15_000,
      }),
    { attempts: RETRY_ATTEMPTS, baseDelayMs: RETRY_BASE_DELAY_MS }
  );

  return Array.isArray(data) ? data : [];
}

/**
 * Walk further back into a wallet's history than a single page, for use
 * cases (like PnL ranking) that need a broader trade sample than the
 * poller's "what's new" queries.
 */
export async function fetchWalletHistoryPages(
  address: string,
  apiKey: string,
  opts: { pages: number; pageSize: number }
): Promise<HeliusTransaction[]> {
  const all: HeliusTransaction[] = [];
  let beforeSignature: string | undefined;

  for (let i = 0; i < opts.pages; i++) {
    const batch = await fetchWalletTransactions(address, apiKey, {
      beforeSignature,
      limit: opts.pageSize,
    });
    if (batch.length === 0) break;
    all.push(...batch);
    beforeSignature = batch[batch.length - 1].signature;
    if (batch.length < opts.pageSize) break;
  }

  return all;
}
