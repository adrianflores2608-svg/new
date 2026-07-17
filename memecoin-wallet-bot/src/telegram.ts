import { autoRetry } from "@grammyjs/auto-retry";
import { Bot, Context } from "grammy";
import { Config } from "./config";
import { discoverCandidateWallets } from "./discover";
import { TokenInfo, pumpFunUrl } from "./pumpfun";
import { rankWallets } from "./ranker";
import { PositionPlan } from "./risk";
import { RugCheckResult } from "./rugcheck";
import { Storage } from "./storage";

function isAuthorized(ctx: Context, config: Config): boolean {
  return ctx.chat?.id.toString() === config.telegramChatId;
}

export function createBot(config: Config, storage: Storage): Bot {
  const bot = new Bot(config.telegramBotToken);
  // Transparently waits and retries when Telegram responds 429 (rate limit)
  // instead of silently dropping an alert.
  bot.api.config.use(autoRetry());

  // This is a single-user bot: only the configured chat may issue commands.
  bot.use(async (ctx, next) => {
    if (!isAuthorized(ctx, config)) return;
    await next();
  });

  bot.command("start", (ctx) =>
    ctx.reply(
      "Memecoin wallet watchlist bot.\n\n" +
        "Commands:\n" +
        "/addwallet <address> [label] - track a wallet\n" +
        "/removewallet <address> - stop tracking a wallet\n" +
        "/list - show tracked wallets\n" +
        "/positions - show tokens currently being tracked\n" +
        "/discover - find and rank candidate wallets by realized pump.fun PnL\n" +
        "/paperstats - simulated track record of this bot's own signals\n" +
        "/status - bot status"
    )
  );

  bot.command("addwallet", (ctx) => {
    const [address, ...labelParts] = ctx.match.toString().trim().split(/\s+/).filter(Boolean);
    if (!address) return ctx.reply("Usage: /addwallet <address> [label]");
    const label = labelParts.join(" ") || undefined;
    storage.addWallet(address, label);
    return ctx.reply(`Tracking ${address}${label ? ` (${label})` : ""}`);
  });

  bot.command("removewallet", (ctx) => {
    const address = ctx.match.toString().trim();
    if (!address) return ctx.reply("Usage: /removewallet <address>");
    const removed = storage.removeWallet(address);
    return ctx.reply(removed ? `Stopped tracking ${address}` : `Wasn't tracking ${address}`);
  });

  bot.command("list", (ctx) => {
    const wallets = storage.getWallets();
    if (wallets.length === 0) {
      return ctx.reply("No wallets tracked yet. Add one with /addwallet <address> [label]");
    }
    return ctx.reply(
      wallets
        .map((w) => {
          const track =
            w.realizedPnlSol !== undefined
              ? ` — ${w.realizedPnlSol.toFixed(1)} SOL realized, ${((w.winRate ?? 0) * 100).toFixed(0)}% win rate`
              : "";
          return `- ${w.address}${w.label ? ` (${w.label})` : ""}${track}`;
        })
        .join("\n")
    );
  });

  bot.command("positions", (ctx) => {
    const positions = storage.getAllPositions().filter((p) => p.signaledBuyAt);
    if (positions.length === 0) return ctx.reply("No active signaled positions.");
    const lines = positions.map((p) => {
      const buyers = Object.keys(p.buyers).length;
      const sellers = Object.keys(p.sellers).length;
      const status = p.signaledSellAt ? "SOLD" : "OPEN";
      return `${p.mint} — ${status} (${buyers} buyers / ${sellers} sold)\n${pumpFunUrl(p.mint)}`;
    });
    return ctx.reply(lines.join("\n\n"));
  });

  bot.command("discover", async (ctx) => {
    await ctx.reply(
      `Sampling buyers from ${config.rankSeedTokenLimit} trending pump.fun tokens and scoring realized PnL — this can take a couple of minutes...`
    );

    try {
      const candidates = await discoverCandidateWallets({
        seedMintLimit: config.rankSeedTokenLimit,
        tradesPerMint: config.rankTradesPerSeed,
        maxCandidates: config.rankMaxCandidates,
      });

      if (candidates.length === 0) {
        return ctx.reply("Couldn't find any candidate wallets (pump.fun's public API may be unreachable/changed).");
      }

      const rankings = await rankWallets(candidates, {
        heliusApiKey: config.heliusApiKey,
        historyPages: config.rankHistoryPages,
        historyPageSize: config.rankHistoryPageSize,
        minClosedPositions: config.rankMinClosedPositions,
        concurrency: config.rankConcurrency,
      });

      const top = rankings.slice(0, config.rankTopN);
      if (top.length === 0) {
        return ctx.reply(
          `Scored ${candidates.length} candidate(s) but none had ${config.rankMinClosedPositions}+ closed positions. Try again later or lower RANK_MIN_CLOSED_POSITIONS.`
        );
      }

      const lines = top.map(
        (r, i) =>
          `${i + 1}. ${r.realizedPnlSol.toFixed(2)} SOL — ${(r.winRate * 100).toFixed(0)}% win rate, ${r.closedPositions} closed\n   ${r.address}\n   /addwallet ${r.address}`
      );

      await ctx.reply(
        `Top ${top.length} of ${candidates.length} scored candidate(s) by realized PnL:\n\n${lines.join("\n\n")}\n\n` +
          "This is a heuristic ranking over a small trade sample — not proof of skill. Review before adding."
      );
    } catch (err) {
      await ctx.reply(`Discovery failed: ${(err as Error).message}`);
    }
  });

  bot.command("paperstats", (ctx) => {
    const closed = storage.getClosedPaperTrades();
    const open = storage.getOpenPaperTrades();

    if (closed.length === 0 && open.length === 0) {
      return ctx.reply("No paper trades yet — they open automatically the next time a BUY signal fires.");
    }

    const wins = closed.filter((t) => (t.exit?.pnlSol ?? 0) > 0).length;
    const totalPnlSol = closed.reduce((sum, t) => sum + (t.exit?.pnlSol ?? 0), 0);
    const avgReturnPercent = closed.length
      ? closed.reduce((sum, t) => sum + (t.exit?.pnlPercent ?? 0), 0) / closed.length
      : 0;

    const lines = [
      `Simulated (paper) track record of this bot's own BUY signals:`,
      `Closed trades: ${closed.length} (${wins} win / ${closed.length - wins} loss, ${
        closed.length ? ((wins / closed.length) * 100).toFixed(0) : "0"
      }% win rate)`,
      `Total simulated PnL: ${totalPnlSol >= 0 ? "+" : ""}${totalPnlSol.toFixed(2)} SOL`,
      `Average return per trade: ${avgReturnPercent >= 0 ? "+" : ""}${avgReturnPercent.toFixed(1)}%`,
      `Open (still running): ${open.length}`,
      "",
      "This reflects hypothetical sizing from the risk plan attached to each alert — no real trades were placed.",
    ];
    return ctx.reply(lines.join("\n"));
  });

  bot.command("status", (ctx) =>
    ctx.reply(
      `Tracking ${storage.getWallets().length} wallet(s).\n` +
        `Buy signal threshold: ${config.minWalletsForBuySignal} wallet(s) / conviction ${config.minConvictionScoreForBuySignal} within ${config.buySignalWindowMinutes}m.\n` +
        `Rug check mode: ${config.rugCheckMode}.\n` +
        `Poll interval: ${config.pollIntervalSeconds}s.`
    )
  );

  return bot;
}

export interface BuyAlertData {
  mint: string;
  buyersCount: number;
  convictionScore: number;
  tokenInfo?: TokenInfo;
  rugResult?: RugCheckResult;
  plan: PositionPlan;
}

export async function sendBuyAlert(bot: Bot, chatId: string, data: BuyAlertData): Promise<void> {
  const { mint, buyersCount, convictionScore, tokenInfo, rugResult, plan } = data;
  const name = tokenInfo?.symbol ?? tokenInfo?.name ?? `${mint.slice(0, 8)}…`;
  const link = pumpFunUrl(mint);

  const rugFlagged = rugResult ? !rugResult.passed : false;
  const rugLine = rugResult
    ? rugFlagged
      ? `\n⚠️ Rug flags: ${rugResult.reasons.join("; ")}`
      : "\n✅ No crude rug flags (mint/freeze authority revoked, creator holding within bounds)"
    : "";

  const sizeLine =
    plan.suggestedSizeSol > 0
      ? `\nSuggested size: ~${plan.suggestedSizeSol.toFixed(3)} SOL (${plan.suggestedSizePercent.toFixed(1)}% of bankroll)` +
        (plan.stopLossMarketCapSol
          ? `\nStop-loss level: ~${plan.stopLossMarketCapSol.toFixed(1)} SOL market cap`
          : "")
      : "\nSuggested size: skip (risk plan sized this to ~0 given the rug flags above)";

  const message =
    `🟢 BUY SIGNAL — ${name}\n` +
    `${buyersCount} tracked wallet(s) bought (conviction score ${convictionScore.toFixed(2)})` +
    (tokenInfo?.marketCapSol ? `\nMarket cap: ~${tokenInfo.marketCapSol.toFixed(1)} SOL` : "") +
    rugLine +
    sizeLine +
    `\n${link}\n\n` +
    "Not financial advice — this is a heuristic signal, review before acting.";

  await bot.api.sendMessage(chatId, message);
}

export interface SellAlertData {
  mint: string;
  seller: string;
  sellersSoFar: number;
  totalBuyers: number;
  tokenInfo?: TokenInfo;
}

export async function sendSellAlert(bot: Bot, chatId: string, data: SellAlertData): Promise<void> {
  const { mint, seller, sellersSoFar, totalBuyers, tokenInfo } = data;
  const name = tokenInfo?.symbol ?? tokenInfo?.name ?? `${mint.slice(0, 8)}…`;
  const link = pumpFunUrl(mint);

  const message =
    `🔴 SELL SIGNAL — ${name}\n` +
    `${seller} sold (${sellersSoFar}/${totalBuyers} tracked buyers now out).\n` +
    `\n${link}`;

  await bot.api.sendMessage(chatId, message);
}

export interface StopLossAlertData {
  mint: string;
  pnlSol: number;
  pnlPercent: number;
}

export async function sendStopLossAlert(bot: Bot, chatId: string, data: StopLossAlertData): Promise<void> {
  const { mint, pnlSol, pnlPercent } = data;
  const message =
    `📄 Paper trade stopped out — ${mint}\n` +
    `Simulated exit at stop-loss level: ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}% (${
      pnlSol >= 0 ? "+" : ""
    }${pnlSol.toFixed(3)} SOL)\n` +
    `${pumpFunUrl(mint)}`;

  await bot.api.sendMessage(chatId, message);
}

export interface HealthAlertData {
  recovered: boolean;
  message: string;
}

/** Self-monitoring: lets the bot tell you when it's actually broken, instead of you noticing only by the alert silence. */
export async function sendHealthAlert(bot: Bot, chatId: string, data: HealthAlertData): Promise<void> {
  const prefix = data.recovered ? "✅ Bot recovered" : "⚠️ Bot health warning";
  await bot.api.sendMessage(chatId, `${prefix}\n${data.message}`);
}
