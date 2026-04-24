"""Minimal Flask UI: paste a URL, get a live audit report."""
from __future__ import annotations

from flask import Flask, request, render_template_string, abort

from .scraper import fetch_site
from .analyzer import analyze
from .scoring import score
from .recommendations import recommend
from .report import to_html

INDEX = """<!doctype html>
<html><head>
<meta charset="utf-8"><title>biz-scout</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; font:16px/1.5 -apple-system, Segoe UI, Roboto, sans-serif;
         background:#0b0d12; color:#e7ecf3; }
  .wrap { max-width:720px; margin:10vh auto; padding:24px; }
  h1 { font-size:32px; margin:0 0 8px; }
  p.lead { color:#8d96a7; margin:0 0 32px; }
  form { display:flex; gap:8px; }
  input[type=url] { flex:1; padding:14px 16px; border-radius:10px;
                    border:1px solid #232936; background:#141821; color:#e7ecf3;
                    font-size:16px; }
  button { padding:14px 22px; border:0; border-radius:10px; background:#6ee7b7;
           color:#06281d; font-weight:700; font-size:16px; cursor:pointer; }
  .opts { margin-top:12px; color:#8d96a7; font-size:14px; }
  label { margin-right:12px; }
  input[type=number] { width:64px; background:#141821; color:#e7ecf3;
                       border:1px solid #232936; border-radius:6px; padding:4px 6px; }
  .err { color:#f87171; margin-top:16px; }
  .footer { margin-top:48px; color:#8d96a7; font-size:12px; text-align:center; }
</style>
</head><body>
<div class="wrap">
  <h1>biz-scout</h1>
  <p class="lead">Paste a small business website. Get a 5-pillar audit and a prioritized scaling plan.</p>
  <form method="get" action="/audit">
    <input type="url" name="url" placeholder="https://example.com" required autofocus>
    <button type="submit">Audit</button>
  </form>
  <div class="opts">
    <small>The /audit page accepts <code>?url=...&n=5</code> (n = max pages to crawl, default 5, max 10).</small>
  </div>
  {% if error %}<p class="err">{{ error }}</p>{% endif %}
  <div class="footer">biz-scout · run <code>biz-scout audit &lt;url&gt;</code> from the CLI for saved reports.</div>
</div>
</body></html>"""


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def index():
        return render_template_string(INDEX, error=None)

    @app.get("/audit")
    def audit():
        url = (request.args.get("url") or "").strip()
        if not url:
            return render_template_string(INDEX, error="Provide a URL."), 400
        try:
            n = max(1, min(10, int(request.args.get("n", 5))))
        except ValueError:
            n = 5
        try:
            snap = fetch_site(url, max_pages=n)
        except Exception as e:
            return render_template_string(INDEX, error=f"Fetch failed: {e}"), 502
        profile = analyze(snap)
        scorecard = score(profile)
        recs = recommend(profile)
        return to_html(profile, scorecard, recs)

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    return app
