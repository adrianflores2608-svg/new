import { loadConfig } from "./config";
import { createPoller } from "./poller";
import { createConnection } from "./rugcheck";
import { startLocalServer } from "./server";
import { SignalEngine } from "./signals";
import { Storage } from "./storage";
import { createBot } from "./telegram";

async function main() {
  const config = loadConfig();
  const storage = new Storage();
  const signalEngine = new SignalEngine(storage, config);
  const bot = createBot(config, storage);
  const connection = createConnection(config.heliusApiKey);
  const poller = createPoller(config, storage, signalEngine, bot, connection);

  await bot.init();
  bot.start().catch((err) => {
    console.error("[bot] Telegram polling crashed:", err);
    process.exit(1);
  });
  console.log("[bot] Telegram bot started.");

  const interval = poller.start();
  console.log(`[bot] Polling ${storage.getWallets().length} wallet(s) every ${config.pollIntervalSeconds}s.`);

  const localServer = startLocalServer(storage, config.localServerPort);

  const shutdown = () => {
    console.log("[bot] Shutting down...");
    clearInterval(interval);
    localServer.close();
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
