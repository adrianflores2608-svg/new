import { Bot, Context } from "grammy";
import { Config } from "./config";
import { Storage } from "./storage";
import { Signal } from "./types";
import { TokenInfo, pumpFunUrl } from "./pumpfun";

function isAuthorized(ctx: Context, config: Config): boolean {
  return ctx.chat?.id.toString() === config.telegramChatId;
}

export function createBot(config: Config, storage: Storage): Bot {
  const bot = new Bot(config.telegramBotToken);

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
    return ctx.reply(wallets.map((w) => `- ${w.address}${w.label ? ` (${w.label})` : ""}`).join("\n"));
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

  bot.command("status", (ctx) =>
    ctx.reply(
      `Tracking ${storage.getWallets().length} wallet(s).\n` +
        `Buy signal threshold: ${config.minWalletsForBuySignal} wallet(s) within ${config.buySignalWindowMinutes}m.\n` +
        `Poll interval: ${config.pollIntervalSeconds}s.`
    )
  );

  return bot;
}

export async function sendAlert(
  bot: Bot,
  chatId: string,
  signal: Signal,
  tokenInfo?: TokenInfo
): Promise<void> {
  const name = tokenInfo?.symbol ?? tokenInfo?.name ?? `${signal.mint.slice(0, 8)}…`;
  const link = pumpFunUrl(signal.mint);

  const message =
    signal.type === "BUY"
      ? `🟢 BUY SIGNAL — ${name}\n` +
        `${signal.buyers.length} tracked wallet(s) bought this token:\n` +
        signal.buyers.map((b) => `  • ${b.wallet}`).join("\n") +
        (tokenInfo?.marketCapSol ? `\n\nMarket cap: ~${tokenInfo.marketCapSol.toFixed(1)} SOL` : "") +
        `\n${link}`
      : `🔴 SELL SIGNAL — ${name}\n` +
        `${signal.seller.wallet} sold (${signal.sellersSoFar}/${signal.totalBuyers} tracked buyers now out).\n` +
        `\n${link}`;

  await bot.api.sendMessage(chatId, message);
}
