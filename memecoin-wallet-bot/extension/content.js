// UNVERIFIED AGAINST THE LIVE PUMP.FUN SITE — built without network access to
// inspect pump.fun's actual DOM/chart library. The mint-extraction regex and
// chart-container selectors below are best-effort guesses. If the banner
// shows up but never finds a coin (always says "no active signal" even for a
// token you know has one) or the colored dot never appears on the chart, the
// selectors below need adjusting — open devtools on a pump.fun coin page,
// inspect the chart element and the URL, and update the two functions below.

const POLL_MS = 5000;

function extractMintFromUrl() {
  // Solana addresses are base58 (no 0/O/I/l), 32-44 chars. Matches the mint
  // wherever it appears in the path, regardless of a /coin/ or similar prefix.
  const match = window.location.pathname.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : null;
}

function findChartContainer() {
  const candidateSelectors = [
    ".tv-lightweight-charts",
    "[class*='lightweight-charts']",
    "[class*='chart-container']",
    "[id*='chart']",
    "[class*='chart']",
  ];
  for (const selector of candidateSelectors) {
    const el = document.querySelector(selector);
    if (el && el.clientWidth > 100 && el.clientHeight > 100) return el;
  }
  return null;
}

function ensureBanner() {
  let banner = document.getElementById("mwb-signal-banner");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = "mwb-signal-banner";
  banner.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    padding: 10px 14px;
    border-radius: 8px;
    color: #fff;
    background: rgba(18, 18, 18, 0.92);
    border: 1px solid rgba(255,255,255,0.15);
    max-width: 280px;
    pointer-events: none;
  `;
  banner.textContent = "Memecoin bot: connecting...";
  document.documentElement.appendChild(banner);
  return banner;
}

function ensureChartMarker(container) {
  const existing = document.getElementById("mwb-chart-marker");
  if (!container) {
    if (existing) existing.style.display = "none";
    return null;
  }

  let marker = existing;
  if (!marker) {
    marker = document.createElement("div");
    marker.id = "mwb-chart-marker";
    marker.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2147483646;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      pointer-events: none;
      box-shadow: 0 0 8px currentColor;
    `;
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }
    container.appendChild(marker);
  }
  marker.style.display = "block";
  return marker;
}

function render(status) {
  const banner = ensureBanner();
  const marker = ensureChartMarker(findChartContainer());

  if (!status || !status.hasSignal) {
    banner.textContent = "Memecoin bot: no active signal for this coin.";
    banner.style.borderColor = "rgba(255,255,255,0.15)";
    if (marker) marker.style.color = "transparent";
    return;
  }

  const isOpen = status.status === "open";
  const color = isOpen ? "#22c55e" : "#ef4444";
  const label = isOpen ? "🟢 BUY signal active" : "🔴 Tracked wallets have sold";

  banner.style.borderColor = color;
  banner.innerHTML =
    `<div style="font-weight:600;color:${color}">${label}</div>` +
    `<div>${status.buyersCount ?? 0} buyer(s) / ${status.sellersCount ?? 0} sold</div>` +
    (status.rugFlagged ? `<div style="color:#f59e0b">⚠️ rug flags present</div>` : "") +
    (status.suggestedSizeSol
      ? `<div>Suggested size: ~${Number(status.suggestedSizeSol).toFixed(3)} SOL</div>`
      : "") +
    `<div style="opacity:0.6;font-size:11px;margin-top:4px">Not financial advice.</div>`;

  if (marker) marker.style.color = color;
}

function poll() {
  const mint = extractMintFromUrl();
  if (!mint) return;

  chrome.runtime.sendMessage({ type: "GET_SIGNAL", mint }, (response) => {
    if (chrome.runtime.lastError) {
      // Background worker unreachable (bot not running, extension reloaded, etc.)
      const banner = ensureBanner();
      banner.textContent = "Memecoin bot: can't reach the bot (is it running?).";
      banner.style.borderColor = "rgba(255,255,255,0.15)";
      return;
    }
    if (response?.ok) render(response.data);
  });
}

poll();
setInterval(poll, POLL_MS);
