import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}

export interface Config {
  heliusApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  pollIntervalSeconds: number;
  minWalletsForBuySignal: number;
  buySignalWindowMinutes: number;
  sellAlertOnAnySell: boolean;
  rankSeedTokenLimit: number;
  rankTradesPerSeed: number;
  rankMaxCandidates: number;
  rankMinClosedPositions: number;
  rankTopN: number;
  rankHistoryPages: number;
  rankHistoryPageSize: number;
  rankConcurrency: number;
}

export function loadConfig(): Config {
  return {
    heliusApiKey: requireEnv("HELIUS_API_KEY"),
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    telegramChatId: requireEnv("TELEGRAM_CHAT_ID"),
    pollIntervalSeconds: intEnv("POLL_INTERVAL_SECONDS", 30),
    minWalletsForBuySignal: intEnv("MIN_WALLETS_FOR_BUY_SIGNAL", 2),
    buySignalWindowMinutes: intEnv("BUY_SIGNAL_WINDOW_MINUTES", 10),
    sellAlertOnAnySell: boolEnv("SELL_ALERT_ON_ANY_SELL", true),
    rankSeedTokenLimit: intEnv("RANK_SEED_TOKEN_LIMIT", 15),
    rankTradesPerSeed: intEnv("RANK_TRADES_PER_SEED", 50),
    rankMaxCandidates: intEnv("RANK_MAX_CANDIDATES", 60),
    rankMinClosedPositions: intEnv("RANK_MIN_CLOSED_POSITIONS", 3),
    rankTopN: intEnv("RANK_TOP_N", 15),
    rankHistoryPages: intEnv("RANK_HISTORY_PAGES", 3),
    rankHistoryPageSize: intEnv("RANK_HISTORY_PAGE_SIZE", 100),
    rankConcurrency: intEnv("RANK_CONCURRENCY", 4),
  };
}
