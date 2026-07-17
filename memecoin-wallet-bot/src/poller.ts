import { Bot } from "grammy";
import { Config } from "./config";
import { fetchWalletTransactions } from "./helius";
import { fetchTokenInfo, parseSwapsFromTransactions } from "./pumpfun";
import { SignalEngine } from "./signals";
import { Storage } from "./storage";
import { sendAlert } from "./telegram";

export function createPoller(config: Config, storage: Storage, signalEngine: SignalEngine, bot: Bot) {
  let running = false;

  async function pollWallet(address: string): Promise<void> {
    const lastSignature = storage.getLastSignature(address);
    let txs;
    try {
      txs = await fetchWalletTransactions(address, config.heliusApiKey, {
        untilSignature: lastSignature,
      });
    } catch (err) {
      console.error(`[poller] failed to fetch transactions for ${address}:`, (err as Error).message);
      return;
    }

    if (txs.length === 0) return;

    // Helius returns newest-first; replay oldest-first so signals fire in the right order.
    const ordered = [...txs].reverse();

    for (const tx of ordered) {
      const events = parseSwapsFromTransactions([tx], address);
      for (const event of events) {
        const signal = signalEngine.handleSwap(event);
        if (!signal) continue;

        const tokenInfo = await fetchTokenInfo(signal.mint);
        try {
          await sendAlert(bot, config.telegramChatId, signal, tokenInfo);
        } catch (err) {
          console.error("[poller] failed to send telegram alert:", (err as Error).message);
        }
      }
    }

    storage.setLastSignature(address, ordered[ordered.length - 1].signature);
  }

  async function pollOnce(): Promise<void> {
    if (running) return; // don't overlap with a still-running previous pass
    running = true;
    try {
      for (const wallet of storage.getWallets()) {
        await pollWallet(wallet.address);
      }
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
