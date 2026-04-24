"""Extract structured business intelligence from a SiteSnapshot."""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup
import tldextract

from .scraper import SiteSnapshot, PageSnapshot

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)\d{3}[\s\-.]?\d{4}"
)
ADDRESS_HINTS = re.compile(
    r"\b\d{1,6}\s+[A-Z][A-Za-z0-9.\-]+(?:\s[A-Z][A-Za-z0-9.\-]+){0,5}\s+"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Suite|Ste)\b",
    re.IGNORECASE,
)

SOCIAL_DOMAINS = {
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "linkedin.com": "linkedin",
    "youtube.com": "youtube",
    "tiktok.com": "tiktok",
    "pinterest.com": "pinterest",
    "yelp.com": "yelp",
    "g.page": "google_business",
    "maps.google.com": "google_maps",
    "github.com": "github",
}

TECH_FINGERPRINTS = {
    "WordPress": [r"wp-content/", r"wp-includes/", r'name="generator"\s+content="WordPress'],
    "Shopify": [r"cdn\.shopify\.com", r"Shopify\.theme", r"x-shopid"],
    "Squarespace": [r"static\.squarespace\.com", r"squarespace\.com"],
    "Wix": [r"static\.wixstatic\.com", r"wix-bolt"],
    "Webflow": [r"webflow\.js", r"data-wf-site"],
    "React": [r"react(-dom)?(\.production)?\.min\.js", r"__REACT_DEVTOOLS"],
    "Next.js": [r"_next/static/", r'id="__NEXT_DATA__"'],
    "Vue": [r"vue(\.runtime)?(\.min)?\.js", r"__VUE__"],
    "jQuery": [r"jquery(-\d[\d.]*)?(\.min)?\.js"],
    "Bootstrap": [r"bootstrap(\.bundle)?(\.min)?\.(js|css)"],
    "Tailwind": [r"tailwind"],
    "Cloudflare": [r"__cfduid", r"cf-ray"],
    "Google Analytics": [r"google-analytics\.com/(ga|analytics)\.js", r"gtag\(", r"googletagmanager\.com/gtag/js"],
    "Google Tag Manager": [r"googletagmanager\.com/gtm\.js", r'GTM-[A-Z0-9]+'],
    "Meta Pixel": [r"connect\.facebook\.net/.+/fbevents\.js", r"fbq\("],
    "HubSpot": [r"js\.hs-scripts\.com", r"hubspot"],
    "Mailchimp": [r"mailchimp\.com", r"chimpstatic"],
    "Stripe": [r"js\.stripe\.com"],
    "Intercom": [r"widget\.intercom\.io"],
    "Drift": [r"js\.driftt\.com"],
    "Calendly": [r"assets\.calendly\.com"],
}

CTA_PATTERNS = re.compile(
    r"\b(buy now|shop now|get started|sign up|subscribe|book now|contact us|"
    r"request (a )?(quote|demo|consultation)|schedule|call now|order now|free trial|"
    r"download|get a free)\b",
    re.IGNORECASE,
)


@dataclass
class BusinessProfile:
    url: str
    final_url: str = ""
    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    keywords: list[str] = field(default_factory=list)
    domain: str = ""
    favicon: str | None = None

    # Contact
    emails: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    addresses: list[str] = field(default_factory=list)
    contact_form_present: bool = False

    # Social
    social_links: dict[str, str] = field(default_factory=dict)

    # SEO
    title_length: int = 0
    description_length: int = 0
    h1_count: int = 0
    h1_text: list[str] = field(default_factory=list)
    images_total: int = 0
    images_missing_alt: int = 0
    canonical_present: bool = False
    open_graph_present: bool = False
    twitter_card_present: bool = False
    schema_org_types: list[str] = field(default_factory=list)
    sitemap_found: bool = False
    robots_present: bool = False

    # Tech
    tech_stack: list[str] = field(default_factory=list)
    cms: str | None = None
    has_analytics: bool = False
    has_pixel: bool = False
    has_chat: bool = False
    has_booking: bool = False
    has_payments: bool = False

    # Performance
    https: bool = False
    page_load_ms: int = 0
    homepage_size_kb: int = 0
    mobile_viewport: bool = False
    pages_crawled: int = 0
    avg_page_size_kb: int = 0

    # Conversion
    cta_count: int = 0
    cta_examples: list[str] = field(default_factory=list)
    has_blog: bool = False
    has_testimonials: bool = False
    has_pricing: bool = False
    has_email_capture: bool = False

    # Raw flags for downstream scoring
    flags: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _meta(soup: BeautifulSoup, name: str) -> str | None:
    tag = soup.find("meta", attrs={"name": name}) or soup.find("meta", attrs={"property": name})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def _all_text(snap: SiteSnapshot) -> str:
    chunks = []
    for p in snap.pages:
        if p.html:
            chunks.append(p.soup().get_text(" ", strip=True))
    return "\n".join(chunks)


def _detect_tech(snap: SiteSnapshot) -> list[str]:
    blob_parts = []
    for p in snap.pages:
        if p.html:
            blob_parts.append(p.html)
        for k, v in p.headers.items():
            blob_parts.append(f"{k}: {v}")
    blob = "\n".join(blob_parts)
    found: list[str] = []
    for tech, patterns in TECH_FINGERPRINTS.items():
        if any(re.search(p, blob, re.IGNORECASE) for p in patterns):
            found.append(tech)
    return found


def _detect_socials(snap: SiteSnapshot) -> dict[str, str]:
    out: dict[str, str] = {}
    for p in snap.pages:
        if not p.html:
            continue
        for a in p.soup().find_all("a", href=True):
            href = a["href"]
            for domain, name in SOCIAL_DOMAINS.items():
                if domain in href and name not in out:
                    out[name] = href
    return out


def _extract_contacts(snap: SiteSnapshot) -> tuple[list[str], list[str], list[str], bool]:
    emails: set[str] = set()
    phones: set[str] = set()
    addresses: set[str] = set()
    contact_form = False

    for p in snap.pages:
        if not p.html:
            continue
        text = p.soup().get_text(" ", strip=True)

        for m in EMAIL_RE.findall(text):
            if not m.lower().endswith((".png", ".jpg", ".gif", ".svg", ".webp")):
                emails.add(m.lower())
        for a in p.soup().find_all("a", href=True):
            if a["href"].startswith("mailto:"):
                emails.add(a["href"][7:].split("?")[0].lower())
            if a["href"].startswith("tel:"):
                phones.add(a["href"][4:])

        for m in PHONE_RE.findall(text):
            cleaned = re.sub(r"[^\d+]", "", m)
            if 10 <= len(cleaned) <= 15:
                phones.add(m.strip())

        for m in ADDRESS_HINTS.findall(text):
            addresses.add(m.strip())

        for form in p.soup().find_all("form"):
            inputs = " ".join(
                (i.get("name", "") + " " + i.get("id", "") + " " + i.get("placeholder", ""))
                for i in form.find_all(["input", "textarea"])
            ).lower()
            if any(k in inputs for k in ("email", "message", "name", "phone")):
                contact_form = True

    return sorted(emails)[:10], sorted(phones)[:10], sorted(addresses)[:5], contact_form


def _schema_types(soup: BeautifulSoup) -> list[str]:
    types: set[str] = set()
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = tag.string or tag.get_text() or ""
        for m in re.findall(r'"@type"\s*:\s*"([^"]+)"', raw):
            types.add(m)
    for tag in soup.find_all(attrs={"itemtype": True}):
        types.add(tag["itemtype"].split("/")[-1])
    return sorted(types)


def _content_signals(text: str) -> dict[str, bool]:
    lower = text.lower()
    return {
        "has_blog": any(k in lower for k in ("blog", "latest articles", "recent posts", "news")),
        "has_testimonials": any(k in lower for k in ("testimonial", "what our clients say", "reviews")),
        "has_pricing": any(k in lower for k in ("pricing", "our plans", "$ ", "/month", "per month")),
        "has_email_capture": any(k in lower for k in ("subscribe", "newsletter", "join our list", "get updates")),
    }


def analyze(snap: SiteSnapshot) -> BusinessProfile:
    profile = BusinessProfile(url=snap.url)

    home = snap.homepage
    if not home or home.error or not home.html:
        profile.flags["unreachable"] = True
        return profile

    profile.final_url = home.final_url
    profile.https = home.final_url.startswith("https://")
    profile.page_load_ms = home.elapsed_ms
    profile.homepage_size_kb = home.bytes // 1024
    profile.pages_crawled = len([p for p in snap.pages if p.html])

    sizes = [p.bytes for p in snap.pages if p.html]
    profile.avg_page_size_kb = (sum(sizes) // len(sizes) // 1024) if sizes else 0

    soup = home.soup()

    # Identity
    title = soup.title.get_text(strip=True) if soup.title else ""
    profile.name = title.split("|")[0].split("-")[0].strip() or tldextract.extract(home.final_url).domain.title()
    profile.tagline = title
    profile.title_length = len(title)
    description = _meta(soup, "description") or _meta(soup, "og:description") or ""
    profile.description = description or None
    profile.description_length = len(description)
    keywords = _meta(soup, "keywords") or ""
    profile.keywords = [k.strip() for k in keywords.split(",") if k.strip()][:20]
    extracted = tldextract.extract(home.final_url)
    profile.domain = getattr(extracted, "top_domain_under_public_suffix", None) or extracted.registered_domain

    icon = soup.find("link", rel=lambda v: v and "icon" in v.lower())
    if icon and icon.get("href"):
        profile.favicon = icon["href"]

    # SEO
    h1s = soup.find_all("h1")
    profile.h1_count = len(h1s)
    profile.h1_text = [h.get_text(strip=True) for h in h1s][:5]

    images = soup.find_all("img")
    profile.images_total = len(images)
    profile.images_missing_alt = sum(1 for i in images if not (i.get("alt") or "").strip())

    profile.canonical_present = soup.find("link", rel="canonical") is not None
    profile.open_graph_present = soup.find("meta", attrs={"property": re.compile(r"^og:")}) is not None
    profile.twitter_card_present = soup.find("meta", attrs={"name": re.compile(r"^twitter:")}) is not None
    profile.schema_org_types = _schema_types(soup)
    profile.sitemap_found = snap.sitemap_found
    profile.robots_present = snap.robots_txt is not None

    viewport = soup.find("meta", attrs={"name": "viewport"})
    profile.mobile_viewport = bool(viewport and "width" in (viewport.get("content") or ""))

    # Contact
    profile.emails, profile.phones, profile.addresses, profile.contact_form_present = _extract_contacts(snap)

    # Social
    profile.social_links = _detect_socials(snap)

    # Tech
    profile.tech_stack = _detect_tech(snap)
    cms_options = ("WordPress", "Shopify", "Squarespace", "Wix", "Webflow")
    profile.cms = next((t for t in profile.tech_stack if t in cms_options), None)
    profile.has_analytics = any(t in profile.tech_stack for t in ("Google Analytics", "Google Tag Manager"))
    profile.has_pixel = "Meta Pixel" in profile.tech_stack
    profile.has_chat = any(t in profile.tech_stack for t in ("Intercom", "Drift"))
    profile.has_booking = "Calendly" in profile.tech_stack
    profile.has_payments = "Stripe" in profile.tech_stack

    # Conversion
    text = _all_text(snap)
    cta_matches = CTA_PATTERNS.findall(text)
    profile.cta_count = len(cta_matches)
    seen_cta: list[str] = []
    for m in cta_matches:
        phrase = m if isinstance(m, str) else m[0]
        if phrase and phrase not in seen_cta:
            seen_cta.append(phrase.strip())
        if len(seen_cta) >= 6:
            break
    profile.cta_examples = seen_cta

    signals = _content_signals(text)
    profile.has_blog = signals["has_blog"]
    profile.has_testimonials = signals["has_testimonials"]
    profile.has_pricing = signals["has_pricing"]
    profile.has_email_capture = signals["has_email_capture"]

    return profile
