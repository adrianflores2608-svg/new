import { mapWithConcurrency } from "./concurrency";
import { fetchWalletHistoryPages } from "./helius";
import { parseSwapsFromTransactions } from "./pumpfun";
import { SwapEvent } from "./types";

export interface WalletRanking {
  address: string;
  realizedPnlSol: number;
  closedPositions: number;
  winRate: number; // fraction of closed positions (per mint) with positive PnL
  totalTrades: number; // buy + sell events observed in the sampled history
}

interface BuyLot {
  solAmount: number;
  tokenAmount: number;
}

/**
 * FIFO-matches buys against sells per mint to estimate realized PnL.
 * Open positions (bought, never sold within the sampled history) don't
 * contribute PnL — only closed round-trips do.
 */
function computeRealizedPnl(events: SwapEvent[]): {
  pnl: number;
  closedPositive: number;
  closedTotal: number;
} {
  const byMint = new Map<string, SwapEvent[]>();
  for (const event of events) {
    const list = byMint.get(event.mint) ?? [];
    list.push(event);
    byMint.set(event.mint, list);
  }

  let totalPnl = 0;
  let closedPositive = 0;
  let closedTotal = 0;

  for (const mintEvents of byMint.values()) {
    mintEvents.sort((a, b) => a.timestamp - b.timestamp);
    const lots: BuyLot[] = [];
    let mintPnl = 0;
    let hadSell = false;

    for (const event of mintEvents) {
      if (event.direction === "buy") {
        lots.push({ solAmount: event.solAmount, tokenAmount: event.tokenAmount });
        continue;
      }

      hadSell = true;
      let remaining = event.tokenAmount;
      let costBasis = 0;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.tokenAmount <= 0) {
          lots.shift();
          continue;
        }
        const tokenFromLot = Math.min(lot.tokenAmount, remaining);
        const fraction = tokenFromLot / lot.tokenAmount;
        costBasis += lot.solAmount * fraction;
        lot.solAmount -= lot.solAmount * fraction;
        lot.tokenAmount -= tokenFromLot;
        remaining -= tokenFromLot;
        if (lot.tokenAmount <= 0) lots.shift();
      }

      mintPnl += event.solAmount - costBasis;
    }

    if (hadSell) {
      closedTotal += 1;
      if (mintPnl > 0) closedPositive += 1;
      totalPnl += mintPnl;
    }
  }

  return { pnl: totalPnl, closedPositive, closedTotal };
}

export interface RankOptions {
  heliusApiKey: string;
  historyPages: number;
  historyPageSize: number;
  minClosedPositions: number;
  concurrency: number;
}

/**
 * Scores a pool of candidate wallets by realized pump.fun PnL over their
 * recently sampled transaction history, filtering out wallets with too few
 * closed positions to say anything meaningful, and sorting best-first.
 */
export async function rankWallets(
  addresses: string[],
  opts: RankOptions
): Promise<WalletRanking[]> {
  const rankings = await mapWithConcurrency(addresses, opts.concurrency, async (address) => {
    try {
      const txs = await fetchWalletHistoryPages(address, opts.heliusApiKey, {
        pages: opts.historyPages,
        pageSize: opts.historyPageSize,
      });
      const events = parseSwapsFromTransactions(txs, address);
      const { pnl, closedPositive, closedTotal } = computeRealizedPnl(events);

      const ranking: WalletRanking = {
        address,
        realizedPnlSol: pnl,
        closedPositions: closedTotal,
        winRate: closedTotal > 0 ? closedPositive / closedTotal : 0,
        totalTrades: events.length,
      };
      return ranking;
    } catch (err) {
      console.error(`[ranker] failed to score ${address}:`, (err as Error).message);
      return null;
    }
  });

  return rankings
    .filter((r): r is WalletRanking => r !== null && r.closedPositions >= opts.minClosedPositions)
    .sort((a, b) => b.realizedPnlSol - a.realizedPnlSol);
}
