import { loadConfig } from "./config";
import { createPoller } from "./poller";
import { SignalEngine } from "./signals";
import { Storage } from "./storage";
import { createBot } from "./telegram";

async function main() {
  const config = loadConfig();
  const storage = new Storage();
  const signalEngine = new SignalEngine(storage, config);
  const bot = createBot(config, storage);
  const poller = createPoller(config, storage, signalEngine, bot);

  await bot.init();
  bot.start();
  console.log("[bot] Telegram bot started.");

  const interval = poller.start();
  console.log(`[bot] Polling ${storage.getWallets().length} wallet(s) every ${config.pollIntervalSeconds}s.`);

  const shutdown = () => {
    console.log("[bot] Shutting down...");
    clearInterval(interval);
    bot.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[bot] Fatal error during startup:", err);
  process.exit(1);
});
