"""
Sends personalized demo pitch emails to barbershop leads.
Supports Gmail SMTP, Outlook SMTP, and SendGrid.
"""

import logging
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)


SUBJECT_TEMPLATE = "Quick question about {business_name}'s online bookings"

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: Arial, sans-serif; font-size: 15px; color: #222; line-height: 1.6; }}
    .container {{ max-width: 580px; margin: 0 auto; padding: 24px; }}
    .cta {{ display: inline-block; background: #1a1a1a; color: #fff !important;
             padding: 12px 28px; border-radius: 6px; text-decoration: none;
             font-weight: bold; margin-top: 16px; }}
    .footer {{ color: #888; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee;
               padding-top: 12px; }}
  </style>
</head>
<body>
<div class="container">
  <p>Hey {first_name},</p>

  <p>I came across <strong>{business_name}</strong> and noticed you're doing great work
  {city_line}. I wanted to reach out because we help barbershops like yours get
  <strong>more repeat clients and fill empty slots automatically</strong> — without
  chasing people down on the phone.</p>

  <p>We built a simple system specifically for barbers that handles:</p>
  <ul>
    <li>Automated appointment reminders (cuts no-shows by ~40%)</li>
    <li>Review follow-ups after each visit (boosts Google rating fast)</li>
    <li>Rebooking nudges sent 3–4 weeks after a haircut</li>
    <li>A clean booking page linked to your existing schedule</li>
  </ul>

  <p>I put together a quick <strong>free personalized demo</strong> showing exactly how it
  would look for {business_name} — no commitment, takes about 15 minutes.</p>

  <p>
    <a class="cta" href="{demo_link}">Watch the Free Demo →</a>
  </p>

  <p>If it's not a fit, no worries at all. But if you're curious, I'd love to show you
  what it looks like in action.</p>

  <p>— {sender_name}<br>
  {sender_title}<br>
  {sender_phone}</p>

  <div class="footer">
    You're receiving this because {business_name} is listed publicly on Google Maps.<br>
    <a href="{unsubscribe_link}">Unsubscribe</a>
  </div>
</div>
</body>
</html>
"""

PLAIN_TEMPLATE = """\
Hey {first_name},

I came across {business_name} and noticed you're doing great work {city_line}.

I wanted to reach out because we help barbershops get more repeat clients and fill
empty slots automatically — without chasing people down on the phone.

We built a system for barbers that handles:
- Automated appointment reminders (cuts no-shows by ~40%)
- Review follow-ups after each visit
- Rebooking nudges sent 3-4 weeks after a haircut
- A clean booking page linked to your existing schedule

I put together a free personalized demo showing exactly how it would look for
{business_name}. Takes about 15 minutes, no commitment.

Demo link: {demo_link}

— {sender_name}
{sender_title}
{sender_phone}

---
You're receiving this because {business_name} is listed on Google Maps.
Unsubscribe: {unsubscribe_link}
"""


class EmailSender:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self._conn: Optional[smtplib.SMTP] = None

    def connect(self):
        provider = self.cfg.get("provider", "smtp").lower()
        if provider == "sendgrid":
            # SendGrid uses SMTP relay
            self._conn = smtplib.SMTP("smtp.sendgrid.net", 587, timeout=15)
            self._conn.ehlo()
            self._conn.starttls()
            self._conn.login("apikey", self.cfg["sendgrid_api_key"])
        elif provider in ("gmail", "smtp"):
            host = self.cfg.get("smtp_host", "smtp.gmail.com")
            port = int(self.cfg.get("smtp_port", 587))
            self._conn = smtplib.SMTP(host, port, timeout=15)
            self._conn.ehlo()
            self._conn.starttls()
            self._conn.login(self.cfg["smtp_user"], self.cfg["smtp_password"])
        elif provider == "outlook":
            self._conn = smtplib.SMTP("smtp.office365.com", 587, timeout=15)
            self._conn.ehlo()
            self._conn.starttls()
            self._conn.login(self.cfg["smtp_user"], self.cfg["smtp_password"])
        else:
            raise ValueError(f"Unknown email provider: {provider}")
        logger.info("SMTP connection established (%s)", provider)

    def disconnect(self):
        if self._conn:
            try:
                self._conn.quit()
            except Exception:
                pass
            self._conn = None

    def send(self, lead: dict, dry_run: bool = False) -> bool:
        """Sends one email to a lead. Returns True on success."""
        recipient = lead.get("email", "")
        if not recipient:
            logger.debug("Skipping %s — no email", lead.get("business_name"))
            return False

        subject, html_body, plain_body = self._render(lead)

        if dry_run:
            logger.info("[DRY RUN] Would email %s <%s>", lead["business_name"], recipient)
            return True

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.cfg['sender_name']} <{self.cfg['smtp_user']}>"
        msg["To"] = recipient
        msg["Reply-To"] = self.cfg.get("reply_to", self.cfg["smtp_user"])
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        for attempt in range(3):
            try:
                self._conn.sendmail(self.cfg["smtp_user"], recipient, msg.as_string())
                logger.info("Sent to %s <%s>", lead["business_name"], recipient)
                return True
            except smtplib.SMTPServerDisconnected:
                logger.warning("SMTP disconnected, reconnecting…")
                self.connect()
            except smtplib.SMTPException as exc:
                logger.error("SMTP error (attempt %d): %s", attempt + 1, exc)
                time.sleep(2 ** attempt)
        return False

    def _render(self, lead: dict) -> tuple[str, str, str]:
        name = lead.get("business_name", "there")
        city = lead.get("city", "")
        first_name = _guess_first_name(name)
        city_line = f"in {city}" if city else "in your area"
        demo_link = self.cfg.get("demo_link", "https://yourdomain.com/demo")
        unsubscribe = self.cfg.get("unsubscribe_link", f"{demo_link}/unsubscribe")

        ctx = {
            "first_name": first_name,
            "business_name": name,
            "city_line": city_line,
            "demo_link": demo_link,
            "unsubscribe_link": unsubscribe,
            "sender_name": self.cfg.get("sender_name", "Alex"),
            "sender_title": self.cfg.get("sender_title", "Founder, BarberGrow"),
            "sender_phone": self.cfg.get("sender_phone", ""),
        }
        subject = SUBJECT_TEMPLATE.format(business_name=name)
        html_body = HTML_TEMPLATE.format(**ctx)
        plain_body = PLAIN_TEMPLATE.format(**ctx)
        return subject, html_body, plain_body


def _guess_first_name(business_name: str) -> str:
    """
    Tries to extract a human first name from a business name.
    Falls back to 'there' so the greeting still reads naturally.
    """
    # Patterns like "Mike's Barbershop", "Tony & Sons"
    import re
    match = re.match(r"^([A-Z][a-z]{2,})'s?\b", business_name)
    if match:
        return match.group(1)
    return "there"
