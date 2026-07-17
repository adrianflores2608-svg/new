import { loadConfig } from "./config";
import { fetchWalletHistoryPages } from "./helius";
import { parseSwapsFromTransactions } from "./pumpfun";
import { SignalEngine } from "./signals";
import { Storage } from "./storage";
import { Signal, SwapEvent } from "./types";

/**
 * `npm run backtest`
 *
 * Replays each tracked wallet's recent transaction history through the
 * CURRENT signal thresholds (MIN_WALLETS_FOR_BUY_SIGNAL, conviction, window)
 * to show how often BUY/SELL signals would have fired historically. This is
 * for tuning signal frequency, NOT a profitability backtest — it does not
 * know what any token's price did after a signal, because this bot has no
 * historical price feed. For an actual (forward-looking) track record of
 * whether these signals make money, let the bot run live and check
 * /paperstats after it has accumulated some closed paper trades.
 */
async function main() {
  const config = loadConfig();
  const storage = new Storage(); // read-only use: just need the current watchlist + wallet weights
  const wallets = storage.getWallets();

  if (wallets.length === 0) {
    console.log("No wallets tracked yet — add some with /addwallet or `npm run rank -- --add-top n` first.");
    return;
  }

  console.log(
    `[backtest] pulling up to ${config.rankHistoryPages * config.rankHistoryPageSize} historical transactions per wallet across ${wallets.length} wallet(s)...`
  );

  const allEvents: SwapEvent[] = [];
  for (const wallet of wallets) {
    try {
      const txs = await fetchWalletHistoryPages(wallet.address, config.heliusApiKey, {
        pages: config.rankHistoryPages,
        pageSize: config.rankHistoryPageSize,
      });
      allEvents.push(...parseSwapsFromTransactions(txs, wallet.address));
    } catch (err) {
      console.error(`[backtest] failed to fetch history for ${wallet.address}:`, (err as Error).message);
    }
  }

  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  // Replay into a scratch, non-persisted store so this never touches live state/positions.
  const scratchStorage = new Storage({ persist: false });
  for (const wallet of wallets) {
    scratchStorage.addWallet(wallet.address, wallet.label, {
      realizedPnlSol: wallet.realizedPnlSol,
      winRate: wallet.winRate,
    });
  }
  const engine = new SignalEngine(scratchStorage, config);

  const fired: { at: number; signal: Signal }[] = [];
  for (const event of allEvents) {
    const signal = engine.handleSwap(event);
    if (signal) fired.push({ at: event.timestamp, signal });
  }

  const buyCount = fired.filter((f) => f.signal.type === "BUY").length;
  const sellCount = fired.filter((f) => f.signal.type === "SELL").length;

  console.log(`\nReplayed ${allEvents.length} historical swap(s) across ${wallets.length} wallet(s).`);
  console.log(
    `Would have fired ${buyCount} BUY signal(s) and ${sellCount} SELL signal(s) with current thresholds ` +
      `(MIN_WALLETS_FOR_BUY_SIGNAL=${config.minWalletsForBuySignal}, ` +
      `MIN_CONVICTION_SCORE_FOR_BUY_SIGNAL=${config.minConvictionScoreForBuySignal}, ` +
      `BUY_SIGNAL_WINDOW_MINUTES=${config.buySignalWindowMinutes}).\n`
  );

  for (const { at, signal } of fired.slice(-20)) {
    const when = new Date(at * 1000).toISOString();
    if (signal.type === "BUY") {
      console.log(`  [${when}] BUY  ${signal.mint} (${signal.buyers.length} wallets, conviction ${signal.convictionScore.toFixed(2)})`);
    } else {
      console.log(`  [${when}] SELL ${signal.mint} (${signal.sellersSoFar}/${signal.totalBuyers} sold)`);
    }
  }

  console.log(
    "\nNote: this only tells you how often signals would have fired — not what they would have returned. " +
      "Use /paperstats (or `npm run rank` output) to judge whether the signals are actually good, once the " +
      "live bot has accumulated some real (paper) trades."
  );
}

main().catch((err) => {
  console.error("[backtest] fatal error:", err);
  process.exit(1);
});
