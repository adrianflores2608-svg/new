"""biz-scout: small-business website intelligence and scaling recommendations."""
from .scraper import fetch_site, SiteSnapshot
from .analyzer import analyze
from .scoring import score
from .recommendations import recommend

__version__ = "0.1.0"
__all__ = ["fetch_site", "SiteSnapshot", "analyze", "score", "recommend"]
