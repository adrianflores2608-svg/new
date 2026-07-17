# memecoin-wallet-bot

Tracks a watchlist of Solana wallets and sends Telegram alerts when enough of
them buy the same pump.fun token in a short window, layering in rug-flag
checks, a suggested position size/stop-loss, and a simulated (paper) track
record of its own signals. **It only reads on-chain data and sends alerts —
it never holds a private key and never places trades for you.**

## Not financial advice — read this first

No signal bot can make you profitable. This is a heuristic notification
tool, not a trading strategy:

- Wallet copy-signals lag the trade that triggered them.
- pump.fun tokens are extremely volatile, thinly traded, and frequently rug.
- "Wallets that bought together" is not proof of skill or coordination — it
  can just as easily be several unrelated people reacting to the same hype.
- The rug-flag check (below) catches crude, common patterns — it does not
  verify a token is safe.
- The realized-PnL wallet ranking and the risk/position sizing are all
  transparent, static formulas (documented below), not predictive models.
  Past PnL sampled from a short transaction history is not a guarantee of
  future performance.

Treat every alert as a prompt to do your own research, not an instruction to
buy or sell. Only risk money you can afford to lose completely.

## How it works

1. You add wallet addresses to a watchlist, either manually or via
   `/discover` / `npm run rank` (see below).
2. Every `POLL_INTERVAL_SECONDS`, the bot pulls each wallet's recent
   transactions from Helius (up to `POLL_CONCURRENCY` wallets at once, so a
   long watchlist doesn't slow the cycle down) and picks out pump.fun
   buys/sells. Helius calls automatically retry on rate limits/transient
   errors; if fetching keeps failing, you get a ⚠️ health-warning alert
   instead of silently missing signals.
3. Buys are weighted by each wallet's **conviction score** (1.0 for an
   unranked wallet; higher for wallets with a strong sampled realized PnL,
   lower for a weak one — see `src/conviction.ts`). Once enough distinct
   wallets *and* enough combined conviction buy the same token within
   `BUY_SIGNAL_WINDOW_MINUTES`, a token qualifies for a signal.
4. Before alerting, the token passes through a **rug/scam check**
   (`src/rugcheck.ts`) — mint/freeze authority revoked, creator wallet
   holding size — controlled by `RUG_CHECK_MODE`.
5. The alert includes a **suggested position size** (as % of a bankroll you
   configure) and a **stop-loss level**, both computed by a static formula in
   `src/risk.ts` — not a recommendation, a starting point for your own plan.
6. In the background, the bot **paper-trades** every BUY signal: it opens a
   simulated position sized per the risk plan, and closes it either when the
   matching SELL signal fires or when price breaches the stop-loss. Check
   `/paperstats` for the resulting hypothetical win rate / PnL — this is the
   closest thing to real evidence of whether the signals are any good,
   because it's forward-looking (no historical price feed needed).
7. Once a signaled token sees a sell from a tracked buyer, you get a 🔴 SELL
   alert (either on the first sell, or once a majority of buyers have exited
   — see `SELL_ALERT_ON_ANY_SELL`).

## Wallet discovery (finding candidates for the watchlist)

To find candidates instead of only tracking wallets you already know,
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
npm run rank -- --add-top 5  # also add the top 5 to the watchlist (with their PnL/win-rate attached)
```

Wallets added this way carry their sampled PnL/win-rate, which feeds the
conviction weighting in step 3 above. Manually-added wallets (`/addwallet`)
default to neutral weight (1.0) since there's no ranking data for them.

**Treat this as a rough heuristic, not a leaderboard of "the best traders":**
it only samples a limited recent history per wallet (`RANK_HISTORY_PAGES` *
`RANK_HISTORY_PAGE_SIZE` transactions), realized PnL ignores open positions,
and a wallet that got lucky on a couple of trades can outrank a consistently
disciplined one. Use it to generate candidates to review, not to auto-trust.

## Tuning signal frequency: `npm run backtest`

```bash
npm run backtest
```

Replays every tracked wallet's recent transaction history through the
**current** thresholds (`MIN_WALLETS_FOR_BUY_SIGNAL`,
`MIN_CONVICTION_SCORE_FOR_BUY_SIGNAL`, `BUY_SIGNAL_WINDOW_MINUTES`) and
reports how many BUY/SELL signals would have fired. Useful for tuning
without waiting days for live signals — **but it only tells you signal
frequency, not signal quality**: this bot has no historical price feed, so it
can't tell you what those historical signals would have returned. For actual
performance evidence, let the live bot run and check `/paperstats`.

## Setup

1. **Helius API key** — sign up at https://dev.helius.dev, create an API key
   (free tier is enough for a small watchlist).
2. **Telegram bot** — message [@BotFather](https://t.me/BotFather), run
   `/newbot`, copy the token it gives you.
3. **Telegram chat id** — message your new bot once, then visit
   `https://api.telegram.org/bot<token>/getUpdates` and read `message.chat.id`
   from the JSON response.
4. Copy `.env.example` to `.env` and fill in the three values above (the rest
   have sensible defaults — see Configuration below).
5. Install and run:

   ```bash
   npm install
   npm run dev
   ```

6. In Telegram, message your bot:
   - `/addwallet <address> [label]` — start tracking a wallet
   - `/removewallet <address>` — stop tracking a wallet
   - `/list` — see tracked wallets (with PnL/win-rate if ranked)
   - `/positions` — see tokens currently being tracked/signaled
   - `/discover` — find and rank candidate wallets by realized PnL
   - `/paperstats` — simulated track record of this bot's own signals
   - `/status` — bot health / config summary

## Configuration

All tuning knobs live in `.env` (see `.env.example` for the full list with
defaults). The main ones:

| Variable | Meaning |
| --- | --- |
| `POLL_INTERVAL_SECONDS` | How often to poll wallets (default 10s — lower means faster alerts but more Helius API usage) |
| `POLL_CONCURRENCY` | How many wallets to poll in parallel per cycle |
| `MIN_WALLETS_FOR_BUY_SIGNAL` | Distinct wallets needed to trigger a BUY alert (a floor) |
| `MIN_CONVICTION_SCORE_FOR_BUY_SIGNAL` | Weighted threshold using ranked wallets' PnL — see `src/conviction.ts` |
| `BUY_SIGNAL_WINDOW_MINUTES` | Rolling window used to count "bought together" |
| `SELL_ALERT_ON_ANY_SELL` | `true` = alert on every buyer's exit, `false` = only once >50% have sold |
| `RUG_CHECK_MODE` | `flag` (alert with warning), `suppress` (don't alert), or `off` |
| `RUG_MAX_CREATOR_HOLDING_PERCENT` | Flag if the creator wallet holds more than this % of supply |
| `RISK_BANKROLL_SOL` / `RISK_BASE_POSITION_PERCENT` / `RISK_MAX_POSITION_PERCENT` | Drive the suggested position size in alerts and paper trades |
| `RISK_STOP_LOSS_PERCENT` | Suggested/simulated stop-loss, as % drop in market cap from entry |

State (tracked wallets, last-seen signature per wallet, open positions, open
and closed paper trades) is persisted to `data/state.json` so restarts don't
reprocess old transactions, re-fire old signals, or lose paper-trading
history.

## Speed and reliability

- **Polling is parallelized** across wallets (`POLL_CONCURRENCY`, default 5)
  instead of one at a time, so a watchlist of many wallets doesn't make each
  cycle take longer than the poll interval itself.
- **Helius API calls auto-retry** on network errors, 429 (rate limit), and 5xx
  responses, with exponential backoff (or the server's `Retry-After` header
  when present) — see `src/retry.ts`. Non-retryable errors (bad API key, etc.)
  fail immediately instead of retrying pointlessly.
- **Telegram API calls auto-retry** on rate limits via the official
  `@grammyjs/auto-retry` plugin, so a burst of alerts doesn't silently drop
  messages.
- **Self health-check**: if wallet-data fetching fails 5 times in a row, the
  bot sends itself a ⚠️ warning to your Telegram (and a ✅ recovery message
  once it starts working again) — so you find out the bot is stuck instead of
  just wondering why no alerts are coming.
- None of this makes the bot "faster than competitors" in any verifiable
  sense (there's no benchmark against other tools) — it just removes the
  obvious self-inflicted latency (sequential polling) and failure modes
  (unhandled rate limits, silent breakage) that were previously in the code.

## Known limitations / things to verify before relying on this

- **Rug checking is narrow, not a guarantee.** `src/rugcheck.ts` only checks
  mint/freeze authority revocation and creator-wallet holding size. It
  deliberately does **not** attempt full holder-distribution analysis —
  doing that correctly requires reliably excluding the bonding-curve-owned
  token account from "top holders" (otherwise every pre-graduation pump.fun
  token looks like a rug, since the curve legitimately holds most of the
  supply), which needs a confirmed PDA derivation this project doesn't rely
  on. A "no flags" result means "no crude red flags found," not "verified
  safe."
- **Risk sizing and stop-loss are static formulas, not advice.** They scale
  with conviction and get cut for rug-flagged tokens, but the base
  percentages, caps, and stop-loss level are all just numbers you configure
  in `.env` — sanity-check them against your own risk tolerance.
- **Paper trading approximates PnL from market cap, not actual fill price.**
  It doesn't model slippage, the bonding-curve price impact of your own
  hypothetical trade size, or the fact that pump.fun's public market-cap
  figure can lag the real-time curve state. Treat `/paperstats` as directional
  evidence, not an exact simulation of what you'd have made.
- **Backtest tells you frequency, not quality.** See the section above —
  there's no historical price feed behind it.
- **Discovery is a heuristic, not a guarantee.** `/discover` and `npm run
  rank` surface candidates worth reviewing — they don't identify "the best"
  wallets. See the Wallet discovery section above for the sampling caveats.
- **Third-party APIs can change.** The Helius enhanced-transactions response
  shape (`src/helius.ts`), Helius's RPC endpoint used for rug checks
  (`src/rugcheck.ts`), and pump.fun's public endpoints (`src/pumpfun.ts`,
  `src/discover.ts` — all against `frontend-api.pump.fun`, undocumented) may
  change field names, paths, or behavior without notice. If alerts stop
  showing token names/market cap, rug checks start erroring, or discovery
  stops returning candidates, check those first against the current Helius
  docs and pump.fun site.
- **No execution path.** By design there is no swap-building or transaction-
  signing code here. Adding auto-execution means handling a private key and
  real slippage/MEV risk — treat that as a separate, much higher-stakes
  decision if you ever want it; it was deliberately kept out of this project.
