# memecoin-wallet-bot

Tracks a watchlist of Solana wallets and sends Telegram alerts when enough of
them buy the same pump.fun token in a short window, and again when they start
selling. **It only reads on-chain data and sends alerts — it never holds a
private key and never places trades for you.**

## Not financial advice

This is a heuristic notification tool, not a trading strategy. Wallet
copy-signals lag the trade that triggered them, pump.fun tokens are extremely
volatile and often rug, and "wallets that bought together" is not proof of
skill or coordination. Treat every alert as a prompt to do your own research,
not an instruction to buy or sell. Only risk money you can afford to lose.

## How it works

1. You add wallet addresses to a watchlist (wallets you believe are worth
   watching — this bot does not discover or rank them for you).
2. Every `POLL_INTERVAL_SECONDS`, the bot pulls each wallet's recent
   transactions from Helius and picks out pump.fun buys/sells.
3. If `MIN_WALLETS_FOR_BUY_SIGNAL` distinct tracked wallets buy the same token
   within `BUY_SIGNAL_WINDOW_MINUTES`, you get a 🟢 BUY alert.
4. Once a token has a BUY alert, a sell from a tracked buyer triggers a 🔴
   SELL alert (either on the first sell, or once a majority of buyers have
   exited — see `SELL_ALERT_ON_ANY_SELL`).

## Wallet discovery (finding candidates for the watchlist)

The core bot only tracks wallets you already know about. To find candidates,
`npm run rank` (or the `/discover` Telegram command):

1. Samples recent buyers across a set of currently-trending pump.fun tokens
   (`src/discover.ts`) as a candidate pool.
2. Pulls each candidate's transaction history from Helius and reconstructs
   realized SOL PnL per token using FIFO cost-basis matching across their
   buy/sell pairs (`src/ranker.ts`).
3. Filters out wallets with fewer than `RANK_MIN_CLOSED_POSITIONS` closed
   round-trips (too little signal to judge), then ranks the rest by total
   realized PnL.

```bash
npm run rank                 # print the ranked list
npm run rank -- --add-top 5  # also add the top 5 to the watchlist
```

**Treat this as a rough heuristic, not a leaderboard of "the best traders":**
it only samples a limited recent history per wallet (`RANK_HISTORY_PAGES` *
`RANK_HISTORY_PAGE_SIZE` transactions), realized PnL ignores open positions,
and a wallet that got lucky on a couple of trades can outrank a consistently
disciplined one. Use it to generate candidates to review, not to auto-trust.

## Setup

1. **Helius API key** — sign up at https://dev.helius.dev, create an API key
   (free tier is enough for a small watchlist).
2. **Telegram bot** — message [@BotFather](https://t.me/BotFather), run
   `/newbot`, copy the token it gives you.
3. **Telegram chat id** — message your new bot once, then visit
   `https://api.telegram.org/bot<token>/getUpdates` and read `message.chat.id`
   from the JSON response.
4. Copy `.env.example` to `.env` and fill in the three values above.
5. Install and run:

   ```bash
   npm install
   npm run dev
   ```

6. In Telegram, message your bot:
   - `/addwallet <address> [label]` — start tracking a wallet
   - `/list` — see tracked wallets
   - `/positions` — see tokens currently being tracked/signaled
   - `/discover` — find and rank candidate wallets by realized PnL (see below)
   - `/status` — bot health / config summary

## Configuration

All tuning knobs live in `.env` (see `.env.example` for defaults):

| Variable | Meaning |
| --- | --- |
| `POLL_INTERVAL_SECONDS` | How often to poll each wallet |
| `MIN_WALLETS_FOR_BUY_SIGNAL` | Distinct wallets needed to trigger a BUY alert |
| `BUY_SIGNAL_WINDOW_MINUTES` | Rolling window used to count "bought together" |
| `SELL_ALERT_ON_ANY_SELL` | `true` = alert on every buyer's exit, `false` = only once >50% have sold |

State (tracked wallets, last-seen signature per wallet, open positions) is
persisted to `data/state.json` so restarts don't reprocess old transactions
or re-fire old signals.

## Known limitations / things to verify before relying on this

- **Discovery is a heuristic, not a guarantee.** `/discover` and `npm run rank`
  surface candidates worth reviewing — they don't identify "the best"
  wallets. See the Wallet discovery section above for the sampling caveats.
- **Third-party APIs can change.** The Helius enhanced-transactions response
  shape (`src/helius.ts`) and pump.fun's public endpoints (`src/pumpfun.ts`,
  `src/discover.ts` — all against `frontend-api.pump.fun`, undocumented) may
  change field names, paths, or behavior without notice. If alerts stop
  showing token names/market cap, or discovery stops returning candidates,
  check those first against the current Helius docs and pump.fun site.
- **No execution path.** By design there is no swap-building or transaction-
  signing code here. Adding auto-execution means handling a private key and
  real slippage/MEV risk — treat that as a separate, much higher-stakes
  project if you ever want it.
