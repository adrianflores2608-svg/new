from pathlib import Path

from biz_scout.analyzer import analyze
from biz_scout.scraper import SiteSnapshot, PageSnapshot

FIXTURE = Path(__file__).parent / "fixtures" / "sample_home.html"


def _make_snapshot() -> SiteSnapshot:
    html = FIXTURE.read_text()
    page = PageSnapshot(
        url="https://acmebakery.example.com",
        final_url="https://acmebakery.example.com/",
        status=200,
        elapsed_ms=420,
        bytes=len(html.encode()),
        html=html,
        headers={"Content-Type": "text/html"},
    )
    return SiteSnapshot(
        url="https://acmebakery.example.com",
        homepage=page,
        pages=[page],
        sitemap_found=True,
        robots_txt="User-agent: *\nAllow: /",
    )


def test_analyze_extracts_identity():
    snap = _make_snapshot()
    p = analyze(snap)
    assert "Acme Bakery" in (p.name or "")
    assert p.https is True
    assert p.mobile_viewport is True
    assert p.canonical_present is True
    assert p.open_graph_present is True
    assert p.twitter_card_present is True
    assert "LocalBusiness" in p.schema_org_types


def test_analyze_extracts_contacts():
    p = analyze(_make_snapshot())
    assert "hello@acmebakery.example.com" in p.emails
    assert any("555-0182" in ph for ph in p.phones)
    assert any("Main Street" in a for a in p.addresses)
    assert p.contact_form_present is True


def test_analyze_detects_socials_and_tech():
    p = analyze(_make_snapshot())
    assert "facebook" in p.social_links
    assert "instagram" in p.social_links
    assert "google_business" in p.social_links
    assert "Google Analytics" in p.tech_stack or "Google Tag Manager" in p.tech_stack
    assert "Stripe" in p.tech_stack
    assert p.has_payments is True
    assert p.has_analytics is True


def test_analyze_finds_ctas_and_signals():
    p = analyze(_make_snapshot())
    assert p.cta_count >= 2
    assert p.has_testimonials is True
    assert p.images_total == 2
    assert p.images_missing_alt == 1
