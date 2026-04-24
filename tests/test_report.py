from pathlib import Path

from biz_scout.analyzer import analyze
from biz_scout.scoring import score
from biz_scout.recommendations import recommend
from biz_scout.report import to_json, to_markdown, to_html, write_outputs
from biz_scout.scraper import SiteSnapshot, PageSnapshot

FIXTURE = Path(__file__).parent / "fixtures" / "sample_home.html"


def _profile():
    html = FIXTURE.read_text()
    page = PageSnapshot(
        url="https://acmebakery.example.com",
        final_url="https://acmebakery.example.com/",
        status=200, elapsed_ms=420, bytes=len(html.encode()),
        html=html, headers={"Content-Type": "text/html"},
    )
    snap = SiteSnapshot(url="https://acmebakery.example.com",
                        homepage=page, pages=[page], sitemap_found=True)
    p = analyze(snap)
    return p, score(p), recommend(p)


def test_renders_all_three_formats(tmp_path):
    p, sc, recs = _profile()
    j = to_json(p, sc, recs)
    assert '"scorecard"' in j and '"recommendations"' in j
    md = to_markdown(p, sc, recs)
    assert md.startswith("# Audit:")
    html = to_html(p, sc, recs)
    assert "<title>" in html and "Scorecard" in html
    paths = write_outputs(tmp_path, "acme", p, sc, recs)
    for k in ("json", "md", "html"):
        assert paths[k].exists() and paths[k].stat().st_size > 0
