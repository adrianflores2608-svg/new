import axios from "axios";

const HELIUS_BASE = "https://api.helius.xyz/v0";

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
 * Fetch transactions for a wallet, newest first, optionally only those
 * after `untilSignature` (Helius stops paging once it hits that signature).
 */
export async function fetchWalletTransactions(
  address: string,
  apiKey: string,
  opts: { untilSignature?: string; limit?: number } = {}
): Promise<HeliusTransaction[]> {
  const params: Record<string, string | number> = {
    "api-key": apiKey,
    limit: opts.limit ?? 50,
  };
  if (opts.untilSignature) {
    params.until = opts.untilSignature;
  }

  const { data } = await axios.get<HeliusTransaction[]>(
    `${HELIUS_BASE}/addresses/${address}/transactions`,
    { params, timeout: 15_000 }
  );

  return Array.isArray(data) ? data : [];
}
