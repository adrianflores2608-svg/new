import { loadConfig } from "./config";
import { discoverCandidateWallets } from "./discover";
import { rankWallets } from "./ranker";
import { Storage } from "./storage";

/**
 * Standalone CLI: `npm run rank -- [--add-top <n>]`
 * Discovers candidate wallets from trending pump.fun tokens, scores them by
 * realized PnL, prints the top-ranked ones, and optionally adds them to the
 * watchlist used by the main bot (src/index.ts).
 */
async function main() {
  const config = loadConfig();

  console.log(`[rank] sampling buyers from ${config.rankSeedTokenLimit} trending pump.fun token(s)...`);
  const candidates = await discoverCandidateWallets({
    seedMintLimit: config.rankSeedTokenLimit,
    tradesPerMint: config.rankTradesPerSeed,
    maxCandidates: config.rankMaxCandidates,
  });
  console.log(`[rank] found ${candidates.length} candidate wallet(s); scoring realized PnL...`);

  const rankings = await rankWallets(candidates, {
    heliusApiKey: config.heliusApiKey,
    historyPages: config.rankHistoryPages,
    historyPageSize: config.rankHistoryPageSize,
    minClosedPositions: config.rankMinClosedPositions,
    concurrency: config.rankConcurrency,
  });

  const top = rankings.slice(0, config.rankTopN);
  if (top.length === 0) {
    console.log(
      `No candidate had ${config.rankMinClosedPositions}+ closed positions in the sampled history. ` +
        "Try again later, or lower RANK_MIN_CLOSED_POSITIONS."
    );
    return;
  }

  console.log("\nRank  PnL(SOL)   WinRate  ClosedPositions  Address");
  top.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(4)}  ${r.realizedPnlSol.toFixed(2).padStart(9)}  ` +
        `${(r.winRate * 100).toFixed(0).padStart(6)}%  ${String(r.closedPositions).padStart(15)}  ${r.address}`
    );
  });

  const addFlagIndex = process.argv.indexOf("--add-top");
  if (addFlagIndex === -1) {
    console.log("\nRun with `--add-top <n>` to add the top n wallets to your watchlist.");
    return;
  }

  const requested = Number.parseInt(process.argv[addFlagIndex + 1] ?? "", 10);
  const count = Number.isFinite(requested) ? requested : top.length;
  const storage = new Storage();
  for (const ranking of top.slice(0, count)) {
    storage.addWallet(ranking.address, "auto-discovered");
  }
  console.log(`\nAdded top ${Math.min(count, top.length)} wallet(s) to the watchlist.`);
}

main().catch((err) => {
  console.error("[rank] fatal error:", err);
  process.exit(1);
});
