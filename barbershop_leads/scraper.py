"""
Scrapes barbershop leads using Google Places API.
Visits business websites to extract contact emails.
"""

import os
import re
import time
import logging
import requests
from typing import Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)

PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def search_barbershops(city: str, api_key: str, max_results: int = 20) -> list[dict]:
    """
    Returns raw Places results for barbershops in a city.
    Handles pagination up to max_results.
    """
    results = []
    params = {
        "query": f"barbershop {city}",
        "key": api_key,
        "type": "hair_care",
    }
    url = f"{PLACES_BASE}/textsearch/json"

    while len(results) < max_results:
        resp = _get(url, params=params)
        if resp is None:
            break
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.warning("Places API error for %s: %s", city, data.get("status"))
            break

        batch = data.get("results", [])
        results.extend(batch)

        next_token = data.get("next_page_token")
        if not next_token or len(results) >= max_results:
            break

        time.sleep(2)  # required delay before next_page_token is valid
        params = {"key": api_key, "pagetoken": next_token}

    return results[:max_results]


def get_place_details(place_id: str, api_key: str) -> dict:
    """Fetches detailed info including website and phone for a place."""
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total",
        "key": api_key,
    }
    resp = _get(f"{PLACES_BASE}/details/json", params=params)
    if resp is None:
        return {}
    data = resp.json()
    return data.get("result", {})


def extract_email_from_website(url: str, timeout: int = 8) -> Optional[str]:
    """
    Fetches a business website and extracts the first email address found.
    Also checks /contact and /about pages.
    """
    if not url:
        return None
    try:
        emails = _scrape_emails(url, timeout)
        if emails:
            return _best_email(emails)

        # Try common contact pages
        for path in ("/contact", "/contact-us", "/about", "/about-us"):
            contact_url = urljoin(url, path)
            emails = _scrape_emails(contact_url, timeout)
            if emails:
                return _best_email(emails)
    except Exception as exc:
        logger.debug("Email extraction failed for %s: %s", url, exc)
    return None


def build_lead(city: str, place: dict, details: dict, email: Optional[str]) -> dict:
    return {
        "business_name": details.get("name") or place.get("name", ""),
        "address": details.get("formatted_address") or place.get("formatted_address", ""),
        "city": city,
        "phone": details.get("formatted_phone_number", ""),
        "website": details.get("website", ""),
        "email": email or "",
        "rating": details.get("rating", ""),
        "review_count": details.get("user_ratings_total", ""),
        "place_id": place.get("place_id", ""),
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _get(url: str, params: dict, retries: int = 3) -> Optional[requests.Response]:
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=10, headers=HEADERS)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            logger.debug("HTTP error (attempt %d): %s", attempt + 1, exc)
            time.sleep(1.5 ** attempt)
    return None


def _scrape_emails(url: str, timeout: int) -> list[str]:
    resp = requests.get(url, timeout=timeout, headers=HEADERS)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    text = soup.get_text(separator=" ")
    # Also check mailto hrefs
    mailto = [
        a["href"].replace("mailto:", "").split("?")[0].strip()
        for a in soup.find_all("a", href=re.compile(r"^mailto:", re.I))
    ]
    found = EMAIL_PATTERN.findall(text) + mailto
    return list(dict.fromkeys(found))  # dedupe, preserve order


def _best_email(emails: list[str]) -> str:
    """Prefer contact/info/hello addresses over noreply/support."""
    preferred = [e for e in emails if re.search(r"contact|info|hello|booking|barber", e, re.I)]
    excluded = [e for e in emails if re.search(r"noreply|no-reply|example\.com|sentry|wix", e, re.I)]
    candidates = preferred or [e for e in emails if e not in excluded]
    return candidates[0] if candidates else emails[0]
