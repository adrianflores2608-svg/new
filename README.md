# AI Prospecting Tool

An AI-powered prospecting machine for a local web-agency workflow. Research shops
in a city, auto-flag the ones with no website, generate a personalized cold email
with Claude, then show up in person and close.

## What it does

**Step 1 — Find Shops.** Type a city (McAllen, Edinburg, Pharr, etc.) and hit
*Find Shops*. It pulls barbershops from OpenStreetMap and flags the ones with no
website — those are your targets.

**Step 2 — Generate Emails.** Click the ✉ Email button on any prospect. Claude
writes a short, personalized cold email — mentions the shop name, links your demo
site, and asks for an in-person stop-by.

**Step 3 — Track & Close.** Mark shops as sent, then hit 💰 when you close. Stats
at the top update automatically.

## Setup

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
# then edit .env and paste your Anthropic API key
npm start
```

Open http://localhost:3000.

## Config

- `ANTHROPIC_API_KEY` — required. Get one at https://console.anthropic.com/.
- `ANTHROPIC_MODEL` — optional, defaults to `claude-sonnet-4-6`.
- `PORT` — optional, defaults to `3000`.

In the UI, fill in:
- **Your name** — how the email signs off.
- **Demo website URL** — the demo site you link in every email.
- **Tone** — optional; tweak if you want a different vibe.

Prospects and stats are saved in your browser (`localStorage`), not on the server.

## APIs used

- **Nominatim** (OpenStreetMap) — city → lat/lon. No key, fair-use only.
- **Overpass API** — nearby barbershops. No key, fair-use only.
- **Anthropic Messages API** — email generation.

## Notes

- Overpass data only includes shops people have mapped. Coverage varies.
- "No website" = the shop has no `website` tag in OSM. Not perfect, but a solid
  first-pass filter for targets.
- Emails are *not* sent automatically. The "Open in Mail" button drops you into
  your default mail client with the draft pre-filled.
