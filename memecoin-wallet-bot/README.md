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

- **Wallet discovery is manual.** "Top wallets" here means whatever addresses
  you add — this does not rank or discover profitable traders for you. A
  natural follow-up project would compute realized PnL per wallet from
  historical pump.fun trades and auto-populate the watchlist.
- **Third-party APIs can change.** Both the Helius enhanced-transactions
  response shape (`src/helius.ts`) and pump.fun's public token-metadata
  endpoint (`src/pumpfun.ts`, `frontend-api.pump.fun`, undocumented) may
  change field names or behavior without notice. If alerts stop showing
  token names/market cap, or stop firing entirely, check those first against
  current Helius docs.
- **No execution path.** By design there is no swap-building or transaction-
  signing code here. Adding auto-execution means handling a private key and
  real slippage/MEV risk — treat that as a separate, much higher-stakes
  project if you ever want it.
