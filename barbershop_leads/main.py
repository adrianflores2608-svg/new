"""
Barbershop Leads System
=======================
1. Iterates every major US city
2. Pulls barbershop listings from Google Places API
3. Visits each business website to extract an email address
4. Sends a personalized demo pitch email
5. Saves all leads (with/without email) to leads.csv

Usage:
    python main.py                        # full run
    python main.py --dry-run              # scrape + log emails, don't send
    python main.py --cities-only          # scrape leads, save CSV, skip emailing
    python main.py --email-only           # load leads.csv and email rows that have emails
    python main.py --state TX             # restrict to one state abbreviation
    python main.py --limit 5              # only process first N cities (testing)
"""

import argparse
import csv
import logging
import os
import sys
import time
from pathlib import Path

import yaml

from cities import US_CITIES
from scraper import build_lead, extract_email_from_website, get_place_details, search_barbershops
from emailer import EmailSender

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

LEADS_FILE = Path(__file__).parent / "leads.csv"
CONFIG_FILE = Path(__file__).parent / "config.yaml"

CSV_FIELDS = [
    "business_name", "address", "city", "phone",
    "website", "email", "rating", "review_count", "place_id",
]


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        logger.error("config.yaml not found. Copy config.example.yaml and fill in your keys.")
        sys.exit(1)
    with open(CONFIG_FILE) as f:
        return yaml.safe_load(f)


def filter_cities(cities: list[str], state: str | None, limit: int | None) -> list[str]:
    if state:
        cities = [c for c in cities if c.endswith(f", {state.upper()}")]
    if limit:
        cities = cities[:limit]
    return cities


def scrape_all(cities: list[str], cfg: dict) -> list[dict]:
    api_key = cfg["google_places_api_key"]
    max_per_city = cfg.get("max_results_per_city", 20)
    delay = cfg.get("delay_between_cities", 1.0)

    leads: list[dict] = []
    seen_place_ids: set[str] = set()

    for i, city in enumerate(cities, 1):
        logger.info("[%d/%d] Scraping %s…", i, len(cities), city)
        try:
            places = search_barbershops(city, api_key, max_results=max_per_city)
        except Exception as exc:
            logger.warning("Failed to scrape %s: %s", city, exc)
            places = []

        for place in places:
            pid = place.get("place_id", "")
            if pid in seen_place_ids:
                continue
            seen_place_ids.add(pid)

            details = {}
            try:
                details = get_place_details(pid, api_key)
            except Exception as exc:
                logger.debug("Details fetch failed for %s: %s", pid, exc)

            website = details.get("website", "")
            email = None
            if website:
                try:
                    email = extract_email_from_website(website)
                except Exception as exc:
                    logger.debug("Email extraction failed: %s", exc)

            lead = build_lead(city, place, details, email)
            leads.append(lead)
            logger.info(
                "  %-40s  email: %s",
                lead["business_name"][:40],
                lead["email"] or "—",
            )

        time.sleep(delay)

    return leads


def save_leads(leads: list[dict], mode: str = "w"):
    write_header = mode == "w" or not LEADS_FILE.exists()
    with open(LEADS_FILE, mode, newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        writer.writerows(leads)
    logger.info("Saved %d leads to %s", len(leads), LEADS_FILE)


def load_leads() -> list[dict]:
    if not LEADS_FILE.exists():
        logger.error("leads.csv not found. Run without --email-only first.")
        sys.exit(1)
    with open(LEADS_FILE, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def email_leads(leads: list[dict], cfg: dict, dry_run: bool = False):
    emailable = [l for l in leads if l.get("email")]
    logger.info(
        "%d leads total, %d have emails — %s",
        len(leads),
        len(emailable),
        "DRY RUN" if dry_run else "sending…",
    )

    if not emailable:
        logger.info("Nothing to send.")
        return

    sender = EmailSender(cfg["email"])
    if not dry_run:
        sender.connect()

    delay = cfg.get("delay_between_emails", 3)
    sent = failed = skipped = 0

    for lead in emailable:
        ok = sender.send(lead, dry_run=dry_run)
        if ok:
            sent += 1
        else:
            failed += 1

        # rate limiting
        time.sleep(delay)

    if not dry_run:
        sender.disconnect()

    logger.info("Done — sent: %d  failed: %d  skipped: %d", sent, failed, skipped)


def main():
    parser = argparse.ArgumentParser(description="Barbershop leads + email system")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually send emails")
    parser.add_argument("--cities-only", action="store_true", help="Scrape only, no emailing")
    parser.add_argument("--email-only", action="store_true", help="Email from existing leads.csv")
    parser.add_argument("--state", help="Filter to one state abbreviation (e.g. TX)")
    parser.add_argument("--limit", type=int, help="Max number of cities to process")
    args = parser.parse_args()

    cfg = load_config()

    if args.email_only:
        leads = load_leads()
        email_leads(leads, cfg, dry_run=args.dry_run)
        return

    cities = filter_cities(US_CITIES, args.state, args.limit)
    logger.info("Processing %d cities…", len(cities))

    leads = scrape_all(cities, cfg)
    save_leads(leads)

    if not args.cities_only:
        email_leads(leads, cfg, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
