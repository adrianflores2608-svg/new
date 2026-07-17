# Memecoin Wallet Bot — pump.fun overlay extension

Shows the bot's BUY/SELL signals directly on pump.fun coin pages: a status
banner (top-right of the page) and a small colored marker on the detected
chart element. Requires the bot (`npm run dev` in the parent folder) running
locally — the extension only talks to `http://127.0.0.1:4756`, never the
internet.

## Important: the chart-marker part is unverified

This was built without network access to pump.fun, so `content.js`'s guesses
at the chart container's CSS selector (`findChartContainer()`) and the
mint-address URL pattern (`extractMintFromUrl()`) have not been tested
against the real site. Expected behavior once you install it:

- **The banner should always work** — it's just a fixed corner overlay, not
  dependent on finding anything in the page.
- **The colored dot on the chart may not appear** if none of the guessed
  selectors match pump.fun's actual chart element. That's a cosmetic miss,
  not a failure — the banner still carries the real information.

If the banner never leaves "no active signal" even for a coin you know has
one, the mint-extraction regex is probably wrong for pump.fun's current URL
structure — check what `window.location.pathname` actually looks like on a
coin page (open devtools console, type `location.pathname`) and compare
against the regex in `extractMintFromUrl()`.

If the dot never shows up on the chart, open devtools, inspect the chart
element, and check its class/id against the `candidateSelectors` list in
`findChartContainer()` — add a matching selector if needed.

## Install (Chrome/Edge, unpacked)

1. Make sure the bot is running (`npm run dev` — see the main README).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on "Developer mode" (top-right toggle).
4. Click "Load unpacked" and select this `extension/` folder.
5. Visit a pump.fun coin page — you should see a banner appear top-right
   within a few seconds.

## If you changed `LOCAL_SERVER_PORT`

Update the port in two places to match your `.env`:
- `manifest.json` → `host_permissions`
- `background.js` → `LOCAL_SERVER_BASE`

Then reload the extension from `chrome://extensions`.
