"""biz-scout command-line interface."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import click
from rich.console import Console
from rich.table import Table

from .scraper import fetch_site
from .analyzer import analyze
from .scoring import score
from .recommendations import recommend
from .report import write_outputs, to_markdown

console = Console()


def _slug(url: str) -> str:
    host = urlparse(url if "://" in url else "https://" + url).netloc or url
    host = host.replace("www.", "")
    return re.sub(r"[^a-z0-9.-]+", "-", host.lower()).strip("-") or "site"


def _audit_one(url: str, max_pages: int, out_dir: Path, formats: tuple[str, ...]) -> dict:
    console.print(f"[cyan]→ Auditing[/cyan] [bold]{url}[/bold]")
    snap = fetch_site(url, max_pages=max_pages)
    profile = analyze(snap)
    scorecard = score(profile)
    recs = recommend(profile)

    slug = _slug(url)
    paths = write_outputs(out_dir, slug, profile, scorecard, recs)

    if "stdout" in formats:
        console.print(to_markdown(profile, scorecard, recs))

    console.print(
        f"  [green]✓[/green] {profile.name or profile.domain}  "
        f"score=[bold]{scorecard.total}[/bold] grade=[bold]{scorecard.grade}[/bold]  "
        f"({len(recs)} recs)  → {out_dir}/{slug}.html"
    )
    return {
        "url": profile.final_url or url,
        "name": profile.name,
        "score": scorecard.total,
        "grade": scorecard.grade,
        "seo": scorecard.seo,
        "content": scorecard.content,
        "conversion": scorecard.conversion,
        "tech": scorecard.tech,
        "trust": scorecard.trust,
        "recs": len(recs),
        "report": str(paths["html"]),
    }


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
@click.version_option()
def main() -> None:
    """Audit small business websites and generate scaling recommendations."""


@main.command()
@click.argument("url")
@click.option("--max-pages", "-n", default=5, show_default=True, help="Max pages to crawl.")
@click.option("--out", "-o", "out_dir", type=click.Path(path_type=Path),
              default=Path("reports"), show_default=True, help="Output directory.")
@click.option("--print", "show_md", is_flag=True, help="Also print Markdown report to stdout.")
def audit(url: str, max_pages: int, out_dir: Path, show_md: bool) -> None:
    """Audit a single site URL."""
    formats = ("stdout",) if show_md else ()
    _audit_one(url, max_pages, out_dir, formats)


@main.command()
@click.argument("input_file", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--max-pages", "-n", default=4, show_default=True)
@click.option("--out", "-o", "out_dir", type=click.Path(path_type=Path),
              default=Path("reports"), show_default=True)
@click.option("--summary", type=click.Path(path_type=Path),
              default=Path("reports/summary.csv"), show_default=True,
              help="Where to write the multi-site summary CSV.")
def batch(input_file: Path, max_pages: int, out_dir: Path, summary: Path) -> None:
    """Audit many sites from a CSV/TXT file (one URL per line, or 'url' column)."""
    urls = _read_urls(input_file)
    if not urls:
        click.echo("No URLs found.", err=True)
        sys.exit(1)

    results: list[dict] = []
    for u in urls:
        try:
            results.append(_audit_one(u, max_pages, out_dir, ()))
        except Exception as e:
            console.print(f"  [red]✗[/red] {u}: {e}")
            results.append({"url": u, "error": str(e), "score": 0, "grade": "F"})

    summary.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["url", "name", "score", "grade", "seo", "content",
                  "conversion", "tech", "trust", "recs", "report", "error"]
    with summary.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in results:
            w.writerow(r)

    _print_summary(results)
    console.print(f"\n[green]Summary CSV:[/green] {summary}")


def _read_urls(path: Path) -> list[str]:
    text = path.read_text()
    urls: list[str] = []
    if path.suffix.lower() == ".csv":
        reader = csv.DictReader(text.splitlines())
        if reader.fieldnames and "url" in [f.lower() for f in reader.fieldnames]:
            url_field = next(f for f in reader.fieldnames if f.lower() == "url")
            urls = [row[url_field].strip() for row in reader if row.get(url_field, "").strip()]
        else:
            for line in text.splitlines():
                line = line.strip().split(",")[0]
                if line and not line.lower().startswith(("url", "#")):
                    urls.append(line)
    else:
        urls = [l.strip() for l in text.splitlines() if l.strip() and not l.strip().startswith("#")]
    return urls


def _print_summary(results: list[dict]) -> None:
    table = Table(title="Audit summary", show_lines=False)
    for col in ("URL", "Score", "Grade", "SEO", "Content", "Conv", "Tech", "Trust", "Recs"):
        table.add_column(col)
    for r in sorted(results, key=lambda x: -x.get("score", 0)):
        table.add_row(
            (r.get("url") or "")[:48],
            str(r.get("score", "")),
            str(r.get("grade", "")),
            str(r.get("seo", "")),
            str(r.get("content", "")),
            str(r.get("conversion", "")),
            str(r.get("tech", "")),
            str(r.get("trust", "")),
            str(r.get("recs", "")),
        )
    console.print(table)


@main.command()
@click.option("--host", default="127.0.0.1", show_default=True)
@click.option("--port", default=8000, show_default=True, type=int)
def serve(host: str, port: int) -> None:
    """Launch the local web UI."""
    from .web import create_app
    app = create_app()
    console.print(f"[green]biz-scout web UI[/green] running at http://{host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    main()
