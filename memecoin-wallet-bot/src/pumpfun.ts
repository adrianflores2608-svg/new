import axios from "axios";
import { HeliusTransaction } from "./helius";
import { SwapEvent } from "./types";

// pump.fun bonding-curve program. Once a token "graduates" it migrates to
// PumpSwap/Raydium and Helius may tag the source differently — both are
// accepted here so buys/sells keep being tracked after graduation.
const PUMP_SOURCES = new Set(["PUMP_FUN", "PUMP_AMM"]);

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Turn a wallet's raw Helius transactions into pump.fun buy/sell events.
 * Only transactions Helius attributes to pump.fun (or its AMM) are considered —
 * this intentionally ignores unrelated SPL transfers/swaps from the same wallet.
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

    const tokenLeg = tokenTransfers.find(
      (t) =>
        t.mint &&
        t.mint !== WRAPPED_SOL_MINT &&
        (t.fromUserAccount === wallet || t.toUserAccount === wallet)
    );
    if (!tokenLeg || !tokenLeg.mint) continue;

    const solLeg = nativeTransfers.find(
      (t) => t.fromUserAccount === wallet || t.toUserAccount === wallet
    );
    if (!solLeg || !solLeg.amount) continue;

    const isBuy = tokenLeg.toUserAccount === wallet && solLeg.fromUserAccount === wallet;
    const isSell = tokenLeg.fromUserAccount === wallet && solLeg.toUserAccount === wallet;
    if (!isBuy && !isSell) continue;

    events.push({
      wallet,
      mint: tokenLeg.mint,
      direction: isBuy ? "buy" : "sell",
      solAmount: solLeg.amount / LAMPORTS_PER_SOL,
      tokenAmount: tokenLeg.tokenAmount ?? 0,
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
