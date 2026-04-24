"""Translate gaps in a BusinessProfile into prioritized scaling actions."""
from __future__ import annotations

from dataclasses import dataclass, asdict

from .analyzer import BusinessProfile

PRIORITY = {"critical": 0, "high": 1, "medium": 2, "low": 3}


@dataclass
class Recommendation:
    pillar: str
    priority: str
    title: str
    why: str
    action: str
    estimated_impact: str

    def to_dict(self) -> dict:
        return asdict(self)


def recommend(p: BusinessProfile) -> list[Recommendation]:
    recs: list[Recommendation] = []

    if p.flags.get("unreachable"):
        recs.append(Recommendation(
            "tech", "critical",
            "Site is unreachable",
            "We couldn't load the site. Customers won't either.",
            "Verify hosting, DNS, and SSL. Confirm the URL is publicly accessible.",
            "Blocks 100% of inbound traffic.",
        ))
        return recs

    # Tech / infrastructure
    if not p.https:
        recs.append(Recommendation(
            "tech", "critical",
            "No HTTPS / SSL",
            "Browsers flag HTTP sites as 'Not Secure', killing conversions and SEO.",
            "Install a free SSL cert (Let's Encrypt or via your host) and force HTTPS redirects.",
            "Recovers ~15-30% of lost trust-driven conversions.",
        ))
    if not p.mobile_viewport:
        recs.append(Recommendation(
            "tech", "critical",
            "Not mobile-optimized",
            "60%+ of small business traffic is mobile. No viewport meta = broken layouts.",
            'Add `<meta name="viewport" content="width=device-width, initial-scale=1">` and test with Chrome DevTools.',
            "Mobile bounce rate typically drops 20-40%.",
        ))
    if p.page_load_ms and p.page_load_ms > 3000:
        recs.append(Recommendation(
            "tech", "high",
            f"Slow homepage ({p.page_load_ms} ms)",
            "Every 1s of delay drops conversions ~7%.",
            "Compress images (WebP), enable a CDN (Cloudflare is free), defer non-critical JS.",
            "Doubling speed often lifts conversion 10-20%.",
        ))
    if p.homepage_size_kb > 3000:
        recs.append(Recommendation(
            "tech", "medium",
            f"Heavy homepage ({p.homepage_size_kb} KB)",
            "Mobile users on slow networks abandon pages over 3 MB.",
            "Audit images and third-party scripts; lazy-load below-the-fold media.",
            "Better Core Web Vitals → better SEO ranking.",
        ))
    if not p.has_analytics:
        recs.append(Recommendation(
            "tech", "high",
            "No analytics installed",
            "You can't scale what you can't measure. No GA4/GTM = flying blind.",
            "Install Google Analytics 4 via Google Tag Manager. Track form submits and key clicks.",
            "Foundation for every other growth experiment.",
        ))
    if not p.has_pixel:
        recs.append(Recommendation(
            "tech", "medium",
            "No retargeting pixel",
            "Without a Meta/Google pixel you can't retarget the 97% who don't convert first visit.",
            "Add Meta Pixel and a Google Ads tag. Build a 30-day visitor audience.",
            "Retargeting ROAS is usually 3-10x cold traffic.",
        ))

    # SEO
    if not (30 <= p.title_length <= 65):
        recs.append(Recommendation(
            "seo", "high",
            "Page title is sub-optimal",
            f"Title length {p.title_length} chars — Google truncates outside 30-65.",
            "Rewrite as `Primary Keyword | Secondary Benefit | Brand` in 50-60 chars.",
            "Better SERP CTR.",
        ))
    if not (70 <= p.description_length <= 160):
        recs.append(Recommendation(
            "seo", "high",
            "Meta description missing or wrong length",
            f"Description length {p.description_length} — sweet spot is 70-160.",
            "Write a punchy benefit + CTA in 140-160 chars per page.",
            "Higher SERP click-through.",
        ))
    if p.h1_count != 1:
        recs.append(Recommendation(
            "seo", "medium",
            f"H1 count = {p.h1_count}",
            "Each page should have exactly one H1 for clear topical signal.",
            "Use a single, keyword-rich H1 per page. Demote extras to H2.",
            "Cleaner crawl signal.",
        ))
    if p.images_total and p.images_missing_alt > 0:
        recs.append(Recommendation(
            "seo", "medium",
            f"{p.images_missing_alt}/{p.images_total} images missing alt text",
            "Hurts accessibility, image search, and Lighthouse score.",
            "Add descriptive alt text — what's in the image, not 'image1.jpg'.",
            "Better accessibility + image SEO.",
        ))
    if not p.canonical_present:
        recs.append(Recommendation(
            "seo", "low",
            "No canonical URL",
            "Helps Google pick the right version of duplicate URLs.",
            'Add `<link rel="canonical" href="...">` per page.',
            "Avoids duplicate-content dilution.",
        ))
    if not p.schema_org_types:
        recs.append(Recommendation(
            "seo", "medium",
            "No structured data (schema.org)",
            "Schema unlocks rich results (stars, prices, hours, FAQ).",
            "Add LocalBusiness + Product/Service JSON-LD. Validate at search.google.com/test/rich-results.",
            "Rich snippets can lift CTR 20-30%.",
        ))
    if not p.sitemap_found:
        recs.append(Recommendation(
            "seo", "low",
            "No sitemap.xml found",
            "Sitemaps help search engines crawl every page.",
            "Generate `/sitemap.xml` (most CMSes have a plugin) and submit in Google Search Console.",
            "Faster indexing of new pages.",
        ))

    # Conversion
    if p.cta_count < 3:
        recs.append(Recommendation(
            "conversion", "high",
            f"Only {p.cta_count} clear CTAs detected",
            "Visitors need to be told what to do — multiple times.",
            "Add a primary CTA above the fold, mid-page, and in the footer (e.g., 'Get a Free Quote').",
            "Adding CTAs typically lifts conversions 10-30%.",
        ))
    if not p.contact_form_present:
        recs.append(Recommendation(
            "conversion", "high",
            "No contact form found",
            "Phone tag and email loops kill leads. Forms capture intent 24/7.",
            "Add a short form (Name, Email, Message) on /contact and embed in the footer.",
            "Captures the ~40% who won't call or email cold.",
        ))
    if not p.emails:
        recs.append(Recommendation(
            "conversion", "medium",
            "No public email address",
            "Some customers prefer email — missing it filters them out.",
            "Publish a hello@ or info@ address in the footer.",
            "Removes a conversion barrier.",
        ))
    if not p.phones:
        recs.append(Recommendation(
            "conversion", "medium",
            "No public phone number",
            "Local/service businesses lose 30%+ of leads without click-to-call.",
            "Add `tel:` link in the header on every page.",
            "Captures phone-first buyers, especially mobile.",
        ))
    if not p.has_booking:
        recs.append(Recommendation(
            "conversion", "medium",
            "No online booking",
            "Friction kills bookings; back-and-forth scheduling loses leads.",
            "Embed Calendly / Cal.com / Square Appointments on the contact page.",
            "Booking automation often 2-3x conversion vs phone-only.",
        ))
    if not p.has_email_capture:
        recs.append(Recommendation(
            "conversion", "medium",
            "No email capture / newsletter",
            "An owned audience is the cheapest growth channel you'll ever have.",
            "Add a newsletter signup with a lead magnet (checklist, discount, guide).",
            "Email ROI is typically $36 per $1 spent.",
        ))

    # Content
    if not p.has_testimonials:
        recs.append(Recommendation(
            "content", "high",
            "No visible testimonials",
            "Social proof is the #1 trust lever for small businesses.",
            "Add 3-6 customer testimonials with photo + name + result on the homepage.",
            "Trust → conversion lift 10-25%.",
        ))
    if not p.has_blog:
        recs.append(Recommendation(
            "content", "medium",
            "No blog / resources section",
            "Content marketing compounds — no posts means no organic traffic moat.",
            "Publish 1-2 SEO-targeted posts per month around customer questions.",
            "Compounds organic traffic 6-18 months out.",
        ))
    if not p.has_pricing:
        recs.append(Recommendation(
            "content", "low",
            "No pricing info on site",
            "Hiding pricing filters out price-sensitive but also serious buyers.",
            "At minimum publish 'Starting at $X' or a pricing range.",
            "Pre-qualifies leads, saves sales time.",
        ))

    # Trust / off-site
    if len(p.social_links) < 3:
        recs.append(Recommendation(
            "trust", "high",
            f"Only {len(p.social_links)} social profiles linked",
            "Customers verify legitimacy via social. Empty = sketchy.",
            "Claim & link Facebook, Instagram, LinkedIn, and Google Business at minimum.",
            "Higher trust + extra discovery surface area.",
        ))
    if "google_business" not in p.social_links and "google_maps" not in p.social_links:
        recs.append(Recommendation(
            "trust", "high",
            "No Google Business Profile linked",
            "GBP is the #1 local-search asset and free.",
            "Claim your profile at business.google.com, link it on the site, request reviews.",
            "Drives the majority of local 'near me' clicks.",
        ))
    if "yelp" not in p.social_links and not p.has_testimonials:
        recs.append(Recommendation(
            "trust", "low",
            "No third-party reviews surfaced",
            "Independent reviews carry more weight than testimonials.",
            "Embed Google review badge or Yelp widget on the site.",
            "Lifts conversion among first-time visitors.",
        ))

    recs.sort(key=lambda r: PRIORITY.get(r.priority, 9))
    return recs
