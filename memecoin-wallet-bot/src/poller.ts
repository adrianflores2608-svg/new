import { Connection } from "@solana/web3.js";
import { Bot } from "grammy";
import { Config } from "./config";
import { mapWithConcurrency } from "./concurrency";
import { fetchWalletTransactions } from "./helius";
import { fetchTokenInfo, parseSwapsFromTransactions } from "./pumpfun";
import { computePositionPlan } from "./risk";
import { checkToken, RugCheckResult } from "./rugcheck";
import { SignalEngine } from "./signals";
import { Storage } from "./storage";
import { sendBuyAlert, sendHealthAlert, sendSellAlert, sendStopLossAlert } from "./telegram";
import { PaperTrade, PaperTradeExitReason } from "./types";

const HEALTH_WARNING_THRESHOLD = 5; // consecutive failed wallet fetches before warning

export function createPoller(
  config: Config,
  storage: Storage,
  signalEngine: SignalEngine,
  bot: Bot,
  connection: Connection
) {
  let running = false;
  let consecutiveFetchFailures = 0;
  let healthWarningSent = false;

  function recordFetchResult(success: boolean): void {
    if (success) {
      consecutiveFetchFailures = 0;
      if (healthWarningSent) {
        healthWarningSent = false;
        sendHealthAlert(bot, config.telegramChatId, {
          recovered: true,
          message: "Wallet data fetching is working again.",
        }).catch((err) => console.error("[poller] failed to send recovery alert:", (err as Error).message));
      }
      return;
    }

    consecutiveFetchFailures += 1;
    if (consecutiveFetchFailures >= HEALTH_WARNING_THRESHOLD && !healthWarningSent) {
      healthWarningSent = true;
      sendHealthAlert(bot, config.telegramChatId, {
        recovered: false,
        message: `Failed to fetch wallet data ${consecutiveFetchFailures} times in a row. Check HELIUS_API_KEY and your network connection — alerts may be delayed or missed until this recovers.`,
      }).catch((err) => console.error("[poller] failed to send health alert:", (err as Error).message));
    }
  }

  function closePaperTradeAndMaybeNotify(
    mint: string,
    trade: PaperTrade,
    exitMarketCapSol: number,
    reason: PaperTradeExitReason
  ): void {
    const pnlPercent = ((exitMarketCapSol - trade.entryMarketCapSol) / trade.entryMarketCapSol) * 100;
    const pnlSol = trade.sizeSol * (pnlPercent / 100);

    storage.closePaperTrade(mint, {
      marketCapSol: exitMarketCapSol,
      timestamp: Math.floor(Date.now() / 1000),
      reason,
      pnlSol,
      pnlPercent,
    });

    if (reason === "stop_loss") {
      sendStopLossAlert(bot, config.telegramChatId, { mint, pnlSol, pnlPercent }).catch((err) =>
        console.error("[poller] failed to send stop-loss alert:", (err as Error).message)
      );
    }
  }

  async function handleBuySignal(mint: string, buyersCount: number, convictionScore: number): Promise<void> {
    const tokenInfo = await fetchTokenInfo(mint);

    let rugResult: RugCheckResult | undefined;
    if (config.rugCheckMode !== "off") {
      try {
        rugResult = await checkToken(mint, tokenInfo?.creator, connection, {
          requireMintAuthorityRevoked: config.rugRequireMintAuthorityRevoked,
          requireFreezeAuthorityRevoked: config.rugRequireFreezeAuthorityRevoked,
          maxCreatorHoldingPercent: config.rugMaxCreatorHoldingPercent,
        });
      } catch (err) {
        console.error(`[poller] rugcheck failed for ${mint}:`, (err as Error).message);
      }
    }

    const rugFlagged = rugResult ? !rugResult.passed : false;
    if (rugFlagged && config.rugCheckMode === "suppress") {
      console.log(`[poller] suppressed BUY signal for ${mint}: ${rugResult?.reasons.join("; ")}`);
      return;
    }

    const convictionMultiplier = convictionScore / Math.max(config.minWalletsForBuySignal, 1);
    const plan = computePositionPlan(
      {
        bankrollSol: config.riskBankrollSol,
        basePositionPercent: config.riskBasePositionPercent,
        maxPositionPercent: config.riskMaxPositionPercent,
        stopLossPercent: config.riskStopLossPercent,
      },
      { convictionMultiplier, rugFlagged, entryMarketCapSol: tokenInfo?.marketCapSol }
    );

    try {
      await sendBuyAlert(bot, config.telegramChatId, { mint, buyersCount, convictionScore, tokenInfo, rugResult, plan });
    } catch (err) {
      console.error("[poller] failed to send BUY alert:", (err as Error).message);
    }

    if (tokenInfo?.marketCapSol) {
      storage.openPaperTrade({
        mint,
        entryMarketCapSol: tokenInfo.marketCapSol,
        entryTimestamp: Math.floor(Date.now() / 1000),
        sizeSol: plan.suggestedSizeSol,
        stopLossMarketCapSol: plan.stopLossMarketCapSol,
        rugFlagged,
      });
    }
  }

  async function handleSellSignal(
    mint: string,
    seller: string,
    sellersSoFar: number,
    totalBuyers: number
  ): Promise<void> {
    const tokenInfo = await fetchTokenInfo(mint);

    try {
      await sendSellAlert(bot, config.telegramChatId, { mint, seller, sellersSoFar, totalBuyers, tokenInfo });
    } catch (err) {
      console.error("[poller] failed to send SELL alert:", (err as Error).message);
    }

    const openTrade = storage.getOpenPaperTrade(mint);
    if (openTrade && tokenInfo?.marketCapSol) {
      closePaperTradeAndMaybeNotify(mint, openTrade, tokenInfo.marketCapSol, "signal_sell");
    }
  }

  async function checkOpenPaperTradesForStopLoss(): Promise<void> {
    for (const trade of storage.getOpenPaperTrades()) {
      if (!trade.stopLossMarketCapSol) continue;
      const tokenInfo = await fetchTokenInfo(trade.mint);
      if (!tokenInfo?.marketCapSol) continue;
      if (tokenInfo.marketCapSol <= trade.stopLossMarketCapSol) {
        closePaperTradeAndMaybeNotify(trade.mint, trade, tokenInfo.marketCapSol, "stop_loss");
      }
    }
  }

  async function pollWallet(address: string): Promise<void> {
    const lastSignature = storage.getLastSignature(address);
    let txs;
    try {
      txs = await fetchWalletTransactions(address, config.heliusApiKey, {
        untilSignature: lastSignature,
      });
      recordFetchResult(true);
    } catch (err) {
      recordFetchResult(false);
      console.error(`[poller] failed to fetch transactions for ${address}:`, (err as Error).message);
      return;
    }

    if (txs.length === 0) return;

    if (!lastSignature) {
      // First time polling this wallet: establish a baseline instead of
      // replaying potentially weeks-old trades as if they just happened.
      // Helius returns newest-first, so txs[0] is the current tip.
      storage.setLastSignature(address, txs[0].signature);
      return;
    }

    // Helius returns newest-first; replay oldest-first so signals fire in the right order.
    const ordered = [...txs].reverse();

    for (const tx of ordered) {
      const events = parseSwapsFromTransactions([tx], address);
      for (const event of events) {
        const signal = signalEngine.handleSwap(event);
        if (!signal) continue;

        if (signal.type === "BUY") {
          await handleBuySignal(signal.mint, signal.buyers.length, signal.convictionScore);
        } else {
          await handleSellSignal(signal.mint, signal.seller.wallet, signal.sellersSoFar, signal.totalBuyers);
        }
      }
    }

    storage.setLastSignature(address, ordered[ordered.length - 1].signature);
  }

  async function pollOnce(): Promise<void> {
    if (running) return; // don't overlap with a still-running previous pass
    running = true;
    try {
      const wallets = storage.getWallets();
      // Poll wallets concurrently (bounded) instead of one at a time — with a
      // short poll interval, sequential fetches for many wallets could take
      // longer than the interval itself and starve every other cycle.
      await mapWithConcurrency(wallets, config.pollConcurrency, (wallet) => pollWallet(wallet.address));
      await checkOpenPaperTradesForStopLoss();
    } finally {
      running = false;
    }
  }

  function start(): NodeJS.Timeout {
    pollOnce().catch((err) => console.error("[poller] error:", err));
    return setInterval(() => {
      pollOnce().catch((err) => console.error("[poller] error:", err));
    }, config.pollIntervalSeconds * 1000);
  }

  return { pollOnce, start };
}
