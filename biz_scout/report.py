"""Render audit results to JSON, Markdown, and standalone HTML."""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .analyzer import BusinessProfile
from .scoring import Scorecard
from .recommendations import Recommendation

TEMPLATES_DIR = Path(__file__).parent / "templates"


def to_json(profile: BusinessProfile, scorecard: Scorecard, recs: list[Recommendation]) -> str:
    payload = {
        "profile": profile.to_dict(),
        "scorecard": scorecard.to_dict(),
        "recommendations": [r.to_dict() for r in recs],
    }
    return json.dumps(payload, indent=2, default=str)


def to_markdown(profile: BusinessProfile, scorecard: Scorecard, recs: list[Recommendation]) -> str:
    lines: list[str] = []
    lines.append(f"# Audit: {profile.name or profile.domain or profile.url}")
    lines.append("")
    lines.append(f"- **URL:** {profile.final_url or profile.url}")
    if profile.tagline:
        lines.append(f"- **Title:** {profile.tagline}")
    if profile.description:
        lines.append(f"- **Description:** {profile.description}")
    lines.append(f"- **Pages crawled:** {profile.pages_crawled}")
    lines.append("")
    lines.append("## Scorecard")
    lines.append("")
    lines.append(f"**Overall: {scorecard.total}/100 — Grade {scorecard.grade}**")
    lines.append("")
    lines.append("| Pillar | Score |")
    lines.append("|---|---|")
    lines.append(f"| SEO | {scorecard.seo} |")
    lines.append(f"| Content | {scorecard.content} |")
    lines.append(f"| Conversion | {scorecard.conversion} |")
    lines.append(f"| Tech | {scorecard.tech} |")
    lines.append(f"| Trust | {scorecard.trust} |")
    lines.append("")
    lines.append("## Snapshot")
    lines.append("")
    lines.append(f"- **HTTPS:** {'yes' if profile.https else 'no'}")
    lines.append(f"- **Mobile viewport:** {'yes' if profile.mobile_viewport else 'no'}")
    lines.append(f"- **Page load:** {profile.page_load_ms} ms")
    lines.append(f"- **Homepage size:** {profile.homepage_size_kb} KB")
    lines.append(f"- **CMS:** {profile.cms or 'not detected'}")
    lines.append(f"- **Tech stack:** {', '.join(profile.tech_stack) or 'none detected'}")
    lines.append(f"- **Analytics:** {'yes' if profile.has_analytics else 'no'}")
    lines.append(f"- **Retargeting pixel:** {'yes' if profile.has_pixel else 'no'}")
    lines.append("")
    lines.append("## Contact")
    lines.append("")
    lines.append(f"- **Emails:** {', '.join(profile.emails) or 'none found'}")
    lines.append(f"- **Phones:** {', '.join(profile.phones) or 'none found'}")
    lines.append(f"- **Addresses:** {', '.join(profile.addresses) or 'none found'}")
    lines.append(f"- **Contact form:** {'yes' if profile.contact_form_present else 'no'}")
    lines.append("")
    lines.append("## Social")
    lines.append("")
    if profile.social_links:
        for name, link in profile.social_links.items():
            lines.append(f"- **{name}:** {link}")
    else:
        lines.append("- No social profiles found.")
    lines.append("")
    lines.append("## Recommendations")
    lines.append("")
    for r in recs:
        lines.append(f"### [{r.priority.upper()}] {r.title} ({r.pillar})")
        lines.append(f"- **Why:** {r.why}")
        lines.append(f"- **Action:** {r.action}")
        lines.append(f"- **Impact:** {r.estimated_impact}")
        lines.append("")
    return "\n".join(lines)


def to_html(profile: BusinessProfile, scorecard: Scorecard, recs: list[Recommendation]) -> str:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("report.html")
    return template.render(
        profile=profile,
        scorecard=scorecard,
        recs=recs,
    )


def write_outputs(out_dir: Path, slug: str, profile, scorecard, recs) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "json": out_dir / f"{slug}.json",
        "md": out_dir / f"{slug}.md",
        "html": out_dir / f"{slug}.html",
    }
    paths["json"].write_text(to_json(profile, scorecard, recs))
    paths["md"].write_text(to_markdown(profile, scorecard, recs))
    paths["html"].write_text(to_html(profile, scorecard, recs))
    return paths
