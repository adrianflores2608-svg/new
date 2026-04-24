from pathlib import Path

from biz_scout.analyzer import analyze, BusinessProfile
from biz_scout.scraper import SiteSnapshot, PageSnapshot
from biz_scout.scoring import score
from biz_scout.recommendations import recommend

FIXTURE = Path(__file__).parent / "fixtures" / "sample_home.html"


def _good_snap() -> SiteSnapshot:
    html = FIXTURE.read_text()
    page = PageSnapshot(
        url="https://acmebakery.example.com",
        final_url="https://acmebakery.example.com/",
        status=200, elapsed_ms=420,
        bytes=len(html.encode()), html=html,
        headers={"Content-Type": "text/html"},
    )
    return SiteSnapshot(url="https://acmebakery.example.com", homepage=page,
                        pages=[page], sitemap_found=True, robots_txt="User-agent: *")


def test_unreachable_site_scores_zero_and_returns_critical_rec():
    profile = BusinessProfile(url="https://nope.invalid")
    profile.flags["unreachable"] = True
    sc = score(profile)
    assert sc.total == 0 and sc.grade == "F"
    recs = recommend(profile)
    assert any(r.priority == "critical" and "unreachable" in r.title.lower() for r in recs)


def test_decent_site_scores_above_minimum():
    profile = analyze(_good_snap())
    sc = score(profile)
    assert sc.total > 40
    assert sc.grade in {"A", "B", "C", "D", "F"}
    assert 0 <= sc.seo <= 100
    assert 0 <= sc.tech <= 100


def test_recommendations_are_prioritized():
    profile = analyze(_good_snap())
    recs = recommend(profile)
    priorities = ["critical", "high", "medium", "low"]
    indices = [priorities.index(r.priority) for r in recs]
    assert indices == sorted(indices)
