"""HTTP fetch + multi-page crawl with polite defaults."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Iterable
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (compatible; biz-scout/0.1; +https://github.com/) "
    "audit-bot/1.0"
)
DEFAULT_TIMEOUT = 15
DEFAULT_MAX_PAGES = 5


@dataclass
class PageSnapshot:
    url: str
    final_url: str
    status: int
    elapsed_ms: int
    bytes: int
    html: str
    headers: dict
    error: str | None = None

    def soup(self) -> BeautifulSoup:
        return BeautifulSoup(self.html or "", "lxml")


@dataclass
class SiteSnapshot:
    url: str
    homepage: PageSnapshot | None = None
    pages: list[PageSnapshot] = field(default_factory=list)
    robots_txt: str | None = None
    sitemap_found: bool = False
    sitemap_url: str | None = None
    https_redirects: bool = False
    fetched_at: float = field(default_factory=time.time)


def _normalize(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url.rstrip("/")


def _fetch(url: str, session: requests.Session, timeout: int = DEFAULT_TIMEOUT) -> PageSnapshot:
    start = time.perf_counter()
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        elapsed = int((time.perf_counter() - start) * 1000)
        return PageSnapshot(
            url=url,
            final_url=r.url,
            status=r.status_code,
            elapsed_ms=elapsed,
            bytes=len(r.content),
            html=r.text if "html" in r.headers.get("Content-Type", "").lower() else "",
            headers=dict(r.headers),
        )
    except requests.RequestException as e:
        elapsed = int((time.perf_counter() - start) * 1000)
        return PageSnapshot(
            url=url, final_url=url, status=0, elapsed_ms=elapsed,
            bytes=0, html="", headers={}, error=str(e),
        )


def _same_host(a: str, b: str) -> bool:
    return urlparse(a).netloc.replace("www.", "") == urlparse(b).netloc.replace("www.", "")


def _internal_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute, _ = urldefrag(urljoin(base_url, href))
        if not _same_host(absolute, base_url):
            continue
        if absolute not in seen:
            seen.add(absolute)
            out.append(absolute)
    return out


def fetch_site(url: str, max_pages: int = DEFAULT_MAX_PAGES, delay: float = 0.5) -> SiteSnapshot:
    """Fetch homepage + a few key internal pages (about, contact, services, etc.)."""
    url = _normalize(url)
    snap = SiteSnapshot(url=url)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})

    home = _fetch(url, session)
    snap.homepage = home
    snap.pages.append(home)

    if home.error or not home.html:
        return snap

    snap.https_redirects = home.final_url.startswith("https://") and url.startswith("https://")

    soup = home.soup()
    candidates = _internal_links(soup, home.final_url)

    priority_keywords = ("about", "contact", "service", "product", "pricing", "team")
    prioritized = [c for c in candidates if any(k in c.lower() for k in priority_keywords)]
    others = [c for c in candidates if c not in prioritized]
    queue = (prioritized + others)[: max_pages - 1]

    for page_url in queue:
        time.sleep(delay)
        snap.pages.append(_fetch(page_url, session))

    snap.robots_txt, snap.sitemap_found, snap.sitemap_url = _check_robots(url, session)
    return snap


def _check_robots(base_url: str, session: requests.Session):
    robots_url = urljoin(base_url + "/", "robots.txt")
    try:
        r = session.get(robots_url, timeout=DEFAULT_TIMEOUT)
        if r.status_code != 200:
            return None, _ping_sitemap(base_url, session), urljoin(base_url + "/", "sitemap.xml")
        body = r.text
        sitemap_url = None
        for line in body.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_url = line.split(":", 1)[1].strip()
                break
        if not sitemap_url:
            sitemap_url = urljoin(base_url + "/", "sitemap.xml")
        found = _ping_sitemap(sitemap_url, session) if sitemap_url else False
        return body, found, sitemap_url
    except requests.RequestException:
        return None, False, None


def _ping_sitemap(sitemap_url: str, session: requests.Session) -> bool:
    try:
        r = session.head(sitemap_url, timeout=DEFAULT_TIMEOUT, allow_redirects=True)
        if r.status_code == 405:
            r = session.get(sitemap_url, timeout=DEFAULT_TIMEOUT, stream=True)
        return r.status_code == 200
    except requests.RequestException:
        return False
