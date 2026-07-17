import axios from "axios";
import { HeliusNativeTransfer, HeliusTokenTransfer, HeliusTransaction } from "./helius";
import { SwapEvent } from "./types";

// pump.fun bonding-curve program. Once a token "graduates" it migrates to
// PumpSwap/Raydium and Helius may tag the source differently — both are
// accepted here so buys/sells keep being tracked after graduation.
const PUMP_SOURCES = new Set(["PUMP_FUN", "PUMP_AMM"]);

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;

function netTokenAmount(transfers: HeliusTokenTransfer[], wallet: string, mint: string): number {
  return transfers.reduce((net, t) => {
    if (t.mint !== mint) return net;
    if (t.toUserAccount === wallet) net += t.tokenAmount ?? 0;
    if (t.fromUserAccount === wallet) net -= t.tokenAmount ?? 0;
    return net;
  }, 0);
}

function netSolAmount(transfers: HeliusNativeTransfer[], wallet: string): number {
  return transfers.reduce((net, t) => {
    if (t.toUserAccount === wallet) net += t.amount ?? 0;
    if (t.fromUserAccount === wallet) net -= t.amount ?? 0;
    return net;
  }, 0);
}

/**
 * Turn a wallet's raw Helius transactions into pump.fun buy/sell events.
 * Only transactions Helius attributes to pump.fun (or its AMM) are considered —
 * this intentionally ignores unrelated SPL transfers/swaps from the same wallet.
 *
 * Uses net token/SOL movement across ALL transfer legs for the wallet, not
 * just the first matching leg — a single swap transaction can carry more
 * than one native transfer (e.g. a priority-fee tip alongside the swap
 * amount) or more than one token-transfer entry for the same mint, and
 * picking only the first would misclassify or misprice the trade.
 */
export function parseSwapsFromTransactions(
  txs: HeliusTransaction[],
  wallet: string
): SwapEvent[] {
  const events: SwapEvent[] = [];

  for (const tx of txs) {
    if (!tx.source || !PUMP_SOURCES.has(tx.source)) continue;

    const tokenTransfers = tx.tokenTransfers ?? [];
    const nativeTransfers = tx.nativeTransfers ?? [];

    const mint = tokenTransfers.find(
      (t) =>
        t.mint &&
        t.mint !== WRAPPED_SOL_MINT &&
        (t.fromUserAccount === wallet || t.toUserAccount === wallet)
    )?.mint;
    if (!mint) continue;

    const netToken = netTokenAmount(tokenTransfers, wallet, mint);
    const netSol = netSolAmount(nativeTransfers, wallet);
    if (netToken === 0 || netSol === 0) continue;

    const isBuy = netToken > 0 && netSol < 0;
    const isSell = netToken < 0 && netSol > 0;
    if (!isBuy && !isSell) continue;

    events.push({
      wallet,
      mint,
      direction: isBuy ? "buy" : "sell",
      solAmount: Math.abs(netSol) / LAMPORTS_PER_SOL,
      tokenAmount: Math.abs(netToken),
      signature: tx.signature,
      timestamp: tx.timestamp,
    });
  }

  return events;
}

export interface TokenInfo {
  name?: string;
  symbol?: string;
  marketCapSol?: number;
  creator?: string;
}

/**
 * Best-effort token metadata lookup against pump.fun's public frontend API.
 * This endpoint is undocumented and can change without notice — callers
 * must treat a failed/empty lookup as non-fatal (fall back to the raw mint).
 */
export async function fetchTokenInfo(mint: string): Promise<TokenInfo | undefined> {
  try {
    const { data } = await axios.get(`https://frontend-api.pump.fun/coins/${mint}`, {
      timeout: 8_000,
    });
    return {
      name: data?.name,
      symbol: data?.symbol,
      marketCapSol: data?.market_cap,
      creator: data?.creator,
    };
  } catch {
    return undefined;
  }
}

export function pumpFunUrl(mint: string): string {
  return `https://pump.fun/${mint}`;
}
