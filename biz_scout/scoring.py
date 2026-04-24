"""Score a BusinessProfile across five scaling pillars."""
from __future__ import annotations

from dataclasses import dataclass, asdict

from .analyzer import BusinessProfile


@dataclass
class Scorecard:
    seo: int
    content: int
    conversion: int
    tech: int
    trust: int
    total: int
    grade: str

    def to_dict(self) -> dict:
        return asdict(self)


def _clamp(v: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, v))


def _grade(total: int) -> str:
    if total >= 90: return "A"
    if total >= 80: return "B"
    if total >= 70: return "C"
    if total >= 60: return "D"
    return "F"


def _seo_score(p: BusinessProfile) -> int:
    s = 0
    s += 15 if 30 <= p.title_length <= 65 else (5 if p.title_length else 0)
    s += 15 if 70 <= p.description_length <= 160 else (5 if p.description_length else 0)
    s += 10 if p.h1_count == 1 else (5 if p.h1_count > 0 else 0)
    s += 10 if p.canonical_present else 0
    s += 10 if p.open_graph_present else 0
    s += 5 if p.twitter_card_present else 0
    s += 10 if p.sitemap_found else 0
    s += 5 if p.robots_present else 0
    s += 10 if p.schema_org_types else 0
    if p.images_total:
        ratio = 1 - (p.images_missing_alt / p.images_total)
        s += int(10 * ratio)
    else:
        s += 5
    return _clamp(s)


def _content_score(p: BusinessProfile) -> int:
    s = 0
    s += 25 if p.has_blog else 0
    s += 20 if p.has_testimonials else 0
    s += 15 if p.has_pricing else 0
    s += 15 if p.has_email_capture else 0
    s += 10 if p.description else 0
    s += min(15, p.pages_crawled * 3)
    return _clamp(s)


def _conversion_score(p: BusinessProfile) -> int:
    s = 0
    s += min(30, p.cta_count * 5)
    s += 15 if p.contact_form_present else 0
    s += 15 if p.emails else 0
    s += 15 if p.phones else 0
    s += 10 if p.has_booking else 0
    s += 10 if p.has_payments else 0
    s += 5 if p.has_chat else 0
    return _clamp(s)


def _tech_score(p: BusinessProfile) -> int:
    s = 0
    s += 20 if p.https else 0
    s += 15 if p.mobile_viewport else 0
    s += 15 if p.has_analytics else 0
    s += 10 if p.has_pixel else 0
    if p.page_load_ms:
        if p.page_load_ms < 800: s += 20
        elif p.page_load_ms < 1500: s += 15
        elif p.page_load_ms < 3000: s += 10
        else: s += 5
    if p.homepage_size_kb:
        if p.homepage_size_kb < 500: s += 10
        elif p.homepage_size_kb < 1500: s += 7
        elif p.homepage_size_kb < 3000: s += 4
        else: s += 1
    s += 10 if p.cms else 5
    return _clamp(s)


def _trust_score(p: BusinessProfile) -> int:
    s = 0
    s += min(35, len(p.social_links) * 7)
    s += 15 if p.addresses else 0
    s += 10 if "google_business" in p.social_links or "google_maps" in p.social_links else 0
    s += 10 if "yelp" in p.social_links else 0
    s += 15 if p.has_testimonials else 0
    s += 10 if p.https else 0
    s += 5 if p.schema_org_types else 0
    return _clamp(s)


def score(profile: BusinessProfile) -> Scorecard:
    if profile.flags.get("unreachable"):
        return Scorecard(0, 0, 0, 0, 0, 0, "F")

    seo = _seo_score(profile)
    content = _content_score(profile)
    conversion = _conversion_score(profile)
    tech = _tech_score(profile)
    trust = _trust_score(profile)
    total = round((seo + content + conversion + tech + trust) / 5)
    return Scorecard(seo, content, conversion, tech, trust, total, _grade(total))
