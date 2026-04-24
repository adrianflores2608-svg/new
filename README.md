# biz-scout

**Audit small business websites and get a prioritized scaling plan in seconds.**

`biz-scout` crawls a business website, extracts everything useful (contact, social, tech stack, SEO, performance, conversion signals), scores it across five growth pillars, and outputs an actionable list of fixes ranked from critical → low.

Use it to:

- Audit your own business and find what's holding it back.
- Audit prospects/leads before a sales call.
- Run a batch over a CSV of competitors and rank them.

---

## Quick start

```bash
git clone https://github.com/adrianflores2608-svg/new.git
cd new
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -e .

# Single-site audit (writes JSON, Markdown, HTML to ./reports/)
biz-scout audit https://example.com

# Batch from CSV (column `url`) or plain text (one URL per line)
biz-scout batch examples/businesses.csv

# Local web UI — paste a URL, get an instant report
biz-scout serve
# open http://127.0.0.1:8000
```

You can also invoke without installing:

```bash
python -m biz_scout audit https://example.com
```

---

## What it captures

| Pillar      | Signals |
|-------------|---------|
| **SEO**         | title length, meta description, H1 count, image alt coverage, canonical, Open Graph, Twitter card, schema.org JSON-LD, sitemap.xml, robots.txt |
| **Content**     | blog/resources, testimonials, pricing, email capture, page count, description quality |
| **Conversion**  | CTAs (count + examples), contact form, public email/phone, online booking, payments, live chat |
| **Tech**        | HTTPS, mobile viewport, page load, page weight, CMS, JS frameworks, analytics, retargeting pixel |
| **Trust**       | social profile coverage (FB/IG/LI/YT/TikTok/Pinterest/Yelp/Google Business), address presence, schema, reviews |

Tech fingerprinting recognizes WordPress, Shopify, Squarespace, Wix, Webflow, React, Next.js, Vue, jQuery, Bootstrap, Tailwind, Cloudflare, GA, GTM, Meta Pixel, HubSpot, Mailchimp, Stripe, Intercom, Drift, Calendly, and more.

---

## Output

For every audit you get three files in `./reports/<domain>.{json,md,html}`:

- **HTML** — standalone dark-themed report with scorecard, snapshot, and ranked recommendations. Open in any browser, no server required.
- **Markdown** — paste into Notion / Slack / a sales call doc.
- **JSON** — machine-readable for downstream pipelines or dashboards.

Batch mode also writes `reports/summary.csv` ranking every site by score.

---

## Example

```bash
$ biz-scout audit https://example.com
→ Auditing https://example.com
  ✓ Example  score=42 grade=F  (14 recs) → reports/example.com.html
```

A snippet of the recommendations:

```
[CRITICAL] Not mobile-optimized (tech)
  Why: 60%+ of small business traffic is mobile. No viewport meta = broken layouts.
  Action: Add <meta name="viewport" content="width=device-width, initial-scale=1">
  Impact: Mobile bounce rate typically drops 20-40%.

[HIGH] No analytics installed (tech)
  Why: You can't scale what you can't measure.
  Action: Install Google Analytics 4 via GTM. Track form submits and key clicks.
  Impact: Foundation for every other growth experiment.
```

---

## Architecture

```
biz_scout/
├── scraper.py          # polite multi-page crawl with robots/sitemap discovery
├── analyzer.py         # extracts contacts, socials, tech, SEO, perf, conversion
├── scoring.py          # 0-100 per pillar + grade A-F
├── recommendations.py  # rule engine: gap → why/action/impact
├── report.py           # JSON / Markdown / Jinja HTML
├── cli.py              # `audit`, `batch`, `serve`
├── web.py              # Flask UI
└── templates/report.html
```

No headless browser — pure HTTP + lxml/BeautifulSoup, so it's fast and runs anywhere (incl. CI). Adds polite defaults: identifiable User-Agent, configurable delay, max-pages cap.

---

## Development

```bash
pip install -r requirements.txt pytest
pip install -e .
pytest -q
```

CI runs on Python 3.10, 3.11, and 3.12 via GitHub Actions.

---

## Roadmap (good first issues)

- Lighthouse / PageSpeed Insights integration for real Core Web Vitals.
- Screenshot capture (Playwright) embedded in the HTML report.
- Competitor diff: pass two URLs, get side-by-side scorecards.
- Slack / Discord webhook on batch completion.
- WHOIS + DNS metadata.
- Detect e-commerce category & rough product count.

---

## License

MIT.
