import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const USER_AGENT = "ai-prospecting-tool/1.0 (contact: user@example.com)";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function geocodeCity(city) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", city);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const results = await res.json();
  if (!results.length) throw new Error(`Could not find a place named "${city}"`);
  const r = results[0];
  return {
    lat: Number(r.lat),
    lon: Number(r.lon),
    displayName: r.display_name,
    boundingbox: r.boundingbox?.map(Number),
  };
}

async function findBarbershopsNear({ lat, lon, radiusMeters = 12000 }) {
  const query = `
    [out:json][timeout:25];
    (
      node["shop"="hairdresser"](around:${radiusMeters},${lat},${lon});
      node["shop"="beauty"](around:${radiusMeters},${lat},${lon});
      node["amenity"="hairdresser"](around:${radiusMeters},${lat},${lon});
      node["craft"="barber"](around:${radiusMeters},${lat},${lon});
      way["shop"="hairdresser"](around:${radiusMeters},${lat},${lon});
      way["craft"="barber"](around:${radiusMeters},${lat},${lon});
    );
    out center tags 200;
  `;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let lastErr;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`Overpass error ${res.status}`);
      const data = await res.json();
      return (data.elements || [])
        .map((el) => {
          const t = el.tags || {};
          const name = t.name || t["name:en"];
          if (!name) return null;

          const isBarber =
            t["craft"] === "barber" ||
            /barber/i.test(name) ||
            /barbershop|barber shop/i.test(t.description || "") ||
            t["shop"] === "hairdresser";

          if (!isBarber) return null;

          const website = t.website || t["contact:website"] || t.url || null;
          const phone = t.phone || t["contact:phone"] || null;
          const email = t.email || t["contact:email"] || null;
          const facebook = t["contact:facebook"] || t.facebook || null;
          const instagram = t["contact:instagram"] || t.instagram || null;

          const address = [
            t["addr:housenumber"],
            t["addr:street"],
            t["addr:city"],
            t["addr:state"],
          ]
            .filter(Boolean)
            .join(" ");

          return {
            id: `${el.type}/${el.id}`,
            name,
            lat: el.lat ?? el.center?.lat,
            lon: el.lon ?? el.center?.lon,
            address: address || null,
            phone,
            email,
            website,
            facebook,
            instagram,
            noWebsite: !website,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a.noWebsite === b.noWebsite ? a.name.localeCompare(b.name) : a.noWebsite ? -1 : 1));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Overpass request failed");
}

app.get("/api/shops", async (req, res) => {
  const city = (req.query.city || "").toString().trim();
  const radius = Math.min(Math.max(Number(req.query.radius) || 12000, 1000), 40000);
  if (!city) return res.status(400).json({ error: "Missing ?city=" });

  try {
    const place = await geocodeCity(city);
    const shops = await findBarbershopsNear({ lat: place.lat, lon: place.lon, radiusMeters: radius });
    res.json({
      place: { displayName: place.displayName, lat: place.lat, lon: place.lon },
      total: shops.length,
      noWebsiteCount: shops.filter((s) => s.noWebsite).length,
      shops,
    });
  } catch (err) {
    console.error("shops error:", err);
    res.status(502).json({ error: err.message || "Failed to fetch shops" });
  }
});

const EMAIL_STAGE_INSTRUCTIONS = {
  "initial": `Stage: INITIAL cold email.
- Subject should be casual, lowercase-friendly, 4-7 words, not salesy. No "Re:".
- Body under 120 words.
- Mention the shop by name naturally once.
- One concrete offer: you built a quick demo site for them and would love to show it in person.
- Ask for a 10-minute in-person stop-by, not a call.`,
  "followup-3": `Stage: DAY 3 FOLLOW-UP. The initial email got no reply 3 days ago.
- Subject must start with "Re: " and reuse the initial subject style (keep it short).
- Body under 70 words. Shorter than the first email.
- Acknowledge you're bumping this up, no guilt-trip.
- Re-offer the demo link once.
- Ask again for a 10-minute in-person stop-by this week.
- Do not repeat the full pitch.`,
  "breakup-7": `Stage: DAY 7 BREAKUP. No response after a week.
- Subject must start with "Re: " and feel like a soft close.
- Body under 55 words.
- Polite goodbye. Make it easy to say no.
- Say you'll stop following up but the demo link is still there if they ever want a look.
- End warm, not passive-aggressive. No guilt.`,
};

app.post("/api/email", async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
    });
  }

  const { shopName, city, demoUrl, senderName, tone, shopDetails, stage: rawStage, previousSubject } = req.body || {};
  const stage = EMAIL_STAGE_INSTRUCTIONS[rawStage] ? rawStage : "initial";
  if (!shopName || !senderName || !demoUrl) {
    return res.status(400).json({ error: "shopName, senderName, and demoUrl are required" });
  }

  const system = `You are a ghostwriter for a young, local web developer who cold-emails small barbershops offering to build them a website. Your goal: write short, warm, human-sounding emails that feel like a real local kid wrote them — not a corporate sales pitch. Never use emojis, buzzwords ("synergy", "leverage", "solutions"), or phrases like "I hope this email finds you well." Keep sentences short. No fake personalization. Do not invent specific facts about the shop you weren't given.`;

  const user = `Write a cold email to a barbershop.

Shop name: ${shopName}
City: ${city || "(unspecified)"}
Extra shop details (optional, only use if clearly factual): ${shopDetails || "(none)"}
Sender name: ${senderName}
Demo website to link: ${demoUrl}
Tone: ${tone || "friendly, local, humble, concise"}
${previousSubject ? `Previous subject used in this thread: "${previousSubject}"` : ""}

${EMAIL_STAGE_INSTRUCTIONS[stage]}

Universal requirements:
- Subject line on the first line, prefixed with "Subject: ".
- Sign off with just the sender's first name.
- Plain text only. No markdown, no emojis, no bullet lists, no headers.`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
    const subject = subjectMatch ? subjectMatch[1].trim() : `Quick idea for ${shopName}`;
    const body = text.replace(/^Subject:.*$/im, "").trim();

    res.json({ subject, body, raw: text, model: MODEL, stage });
  } catch (err) {
    console.error("email error:", err);
    res.status(502).json({ error: err.message || "Failed to generate email" });
  }
});

app.post("/api/dm", async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
    });
  }

  const { shopName, city, demoUrl, senderName, tone } = req.body || {};
  if (!shopName || !senderName || !demoUrl) {
    return res.status(400).json({ error: "shopName, senderName, and demoUrl are required" });
  }

  const system = `You ghostwrite Instagram DMs for a young, local web developer reaching out to small barbershops. DMs are way shorter and more casual than email. Sound like a real kid from town, not a marketer. No emojis, no hashtags, no sales buzzwords, no "I hope this message finds you well", no "reaching out". Never lie about their page or pretend to know their barbers by name.`;

  const user = `Write exactly TWO Instagram DM variants for this shop.

Shop name: ${shopName}
City: ${city || "(unspecified)"}
Sender name: ${senderName}
Demo site link: ${demoUrl}
Tone: ${tone || "casual, local, humble"}

Rules for each variant:
- Under 280 characters total, including the link.
- 2-4 short sentences max.
- Mention the shop by name ONCE, naturally.
- One clear ask: a 10-minute in-person stop-by (not a call, not a Zoom).
- Include the demo link as plain text.
- Sign off with just the first name on a new line.
- Plain text only. No emojis, no bullets, no markdown.

Output format, exactly:
---VARIANT 1---
<text>
---VARIANT 2---
<text>`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parts = text.split(/---VARIANT\s*\d+---/i).map((s) => s.trim()).filter(Boolean);
    const variants = parts.length >= 2 ? parts.slice(0, 2) : [text];

    res.json({ variants, raw: text, model: MODEL });
  } catch (err) {
    console.error("dm error:", err);
    res.status(502).json({ error: err.message || "Failed to generate DM" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
});

app.listen(PORT, () => {
  console.log(`AI prospecting tool running on http://localhost:${PORT}`);
  if (!anthropic) console.log("Warning: ANTHROPIC_API_KEY not set — email generation will fail.");
});
