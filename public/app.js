const STORAGE_KEY = "prospects.v1";
const SETTINGS_KEY = "settings.v1";

const state = {
  prospects: loadProspects(),
  lastPlace: null,
  activeShopId: null,
};

const els = {
  senderName: document.getElementById("sender-name"),
  demoUrl: document.getElementById("demo-url"),
  tone: document.getElementById("tone"),
  city: document.getElementById("city"),
  radius: document.getElementById("radius"),
  searchForm: document.getElementById("search-form"),
  searchBtn: document.getElementById("search-btn"),
  searchStatus: document.getElementById("search-status"),
  results: document.getElementById("results"),
  filterNoWebsite: document.getElementById("filter-nowebsite"),
  clearBtn: document.getElementById("clear-btn"),
  // stats
  statProspects: document.getElementById("stat-prospects"),
  statNoSite: document.getElementById("stat-nosite"),
  statSent: document.getElementById("stat-sent"),
  statClosed: document.getElementById("stat-closed"),
  // modal
  modal: document.getElementById("email-modal"),
  modalClose: document.getElementById("modal-close"),
  toEmail: document.getElementById("to-email"),
  subject: document.getElementById("subject"),
  body: document.getElementById("body"),
  regenerate: document.getElementById("regenerate"),
  copyEmail: document.getElementById("copy-email"),
  openMail: document.getElementById("open-mail"),
};

loadSettings();
render();
bind();

function bind() {
  for (const el of [els.senderName, els.demoUrl, els.tone]) {
    el.addEventListener("input", saveSettings);
  }

  els.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await runSearch();
  });

  els.filterNoWebsite.addEventListener("change", render);

  els.clearBtn.addEventListener("click", () => {
    if (!state.prospects.length) return;
    if (!confirm("Clear all tracked prospects? Stats will reset.")) return;
    state.prospects = [];
    persist();
    render();
  });

  els.modalClose.addEventListener("click", closeModal);
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.classList.contains("hidden")) closeModal();
  });

  els.regenerate.addEventListener("click", () => generateEmail(state.activeShopId, true));
  els.copyEmail.addEventListener("click", copyEmail);
  els.openMail.addEventListener("click", openMailAndMarkSent);

  els.results.addEventListener("click", onResultsClick);
}

function onResultsClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = btn.closest("[data-id]");
  if (!card) return;
  const id = card.dataset.id;
  const action = btn.dataset.action;
  const shop = state.prospects.find((s) => s.id === id);
  if (!shop) return;

  if (action === "email") openEmailModal(shop);
  else if (action === "close") toggleClosed(shop);
  else if (action === "remove") {
    state.prospects = state.prospects.filter((s) => s.id !== id);
    persist();
    render();
  } else if (action === "sent") {
    shop.status = shop.status === "sent" ? "new" : "sent";
    shop.sentAt = shop.status === "sent" ? Date.now() : null;
    persist();
    render();
  }
}

async function runSearch() {
  const city = els.city.value.trim();
  if (!city) return;
  const radius = els.radius.value;

  els.searchBtn.disabled = true;
  els.searchStatus.classList.remove("error");
  els.searchStatus.innerHTML = `<span class="spinner"></span> Searching ${escape(city)}...`;

  try {
    const r = await fetch(`/api/shops?city=${encodeURIComponent(city)}&radius=${radius}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Search failed");

    state.lastPlace = data.place;
    let added = 0;
    for (const shop of data.shops) {
      const existing = state.prospects.find((p) => p.id === shop.id);
      if (existing) {
        Object.assign(existing, shop, { city });
      } else {
        state.prospects.push({
          ...shop,
          city,
          status: "new",
          sentAt: null,
          closedAt: null,
          emailAddress: shop.email || "",
        });
        added++;
      }
    }
    persist();
    render();

    els.searchStatus.textContent = `Found ${data.total} shops in ${data.place.displayName.split(",").slice(0, 2).join(",")} (${data.noWebsiteCount} with no website). Added ${added} new.`;
  } catch (err) {
    els.searchStatus.classList.add("error");
    els.searchStatus.textContent = err.message;
  } finally {
    els.searchBtn.disabled = false;
  }
}

function render() {
  renderStats();
  renderCards();
}

function renderStats() {
  const total = state.prospects.length;
  const noSite = state.prospects.filter((s) => s.noWebsite).length;
  const sent = state.prospects.filter((s) => s.sentAt).length;
  const closed = state.prospects.filter((s) => s.status === "closed").length;
  els.statProspects.textContent = total;
  els.statNoSite.textContent = noSite;
  els.statSent.textContent = sent;
  els.statClosed.textContent = closed;
}

function renderCards() {
  const onlyNoWebsite = els.filterNoWebsite.checked;
  const visible = state.prospects
    .filter((s) => !onlyNoWebsite || s.noWebsite)
    .sort((a, b) => {
      const score = (s) => (s.status === "closed" ? 2 : s.sentAt ? 1 : 0);
      if (score(a) !== score(b)) return score(a) - score(b);
      if (a.noWebsite !== b.noWebsite) return a.noWebsite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  if (!visible.length) {
    els.results.innerHTML = `<p class="empty">${state.prospects.length ? "No prospects match the current filter." : "Search a city to pull barbershops. Targets (no website) bubble to the top."}</p>`;
    return;
  }

  els.results.innerHTML = visible.map(cardHtml).join("");
}

function cardHtml(s) {
  const classes = ["card"];
  if (s.status === "closed") classes.push("closed");
  else if (s.sentAt) classes.push("sent");
  else if (s.noWebsite) classes.push("target");

  const tags = [];
  if (s.noWebsite) tags.push(`<span class="tag target">No website</span>`);
  if (s.status === "closed") tags.push(`<span class="tag closed">Closed</span>`);
  else if (s.sentAt) tags.push(`<span class="tag sent">Sent</span>`);

  const links = [];
  if (s.phone) links.push(`<a href="tel:${escape(s.phone)}">${escape(s.phone)}</a>`);
  if (s.website) links.push(`<a target="_blank" rel="noopener" href="${escape(s.website)}">website</a>`);
  if (s.facebook) links.push(`<a target="_blank" rel="noopener" href="${escape(fbUrl(s.facebook))}">facebook</a>`);
  if (s.instagram) links.push(`<a target="_blank" rel="noopener" href="${escape(igUrl(s.instagram))}">instagram</a>`);
  if (s.lat && s.lon) links.push(`<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}">map</a>`);

  return `
    <article class="${classes.join(" ")}" data-id="${escape(s.id)}">
      <h3>${escape(s.name)} ${tags.join(" ")}</h3>
      ${s.address ? `<div class="addr">${escape(s.address)}</div>` : ""}
      ${links.length ? `<div class="links">${links.join(" · ")}</div>` : ""}
      <div class="actions">
        <button data-action="email" class="email-btn" title="Generate cold email">✉ Email</button>
        <button data-action="sent" title="Toggle sent">${s.sentAt ? "↩ Undo sent" : "✓ Mark sent"}</button>
        <button data-action="close" class="close-btn" title="Mark closed">${s.status === "closed" ? "↩ Reopen" : "💰 Closed"}</button>
        <button data-action="remove" title="Remove from list">Remove</button>
      </div>
    </article>
  `;
}

function toggleClosed(shop) {
  if (shop.status === "closed") {
    shop.status = shop.sentAt ? "sent" : "new";
    shop.closedAt = null;
  } else {
    shop.status = "closed";
    shop.closedAt = Date.now();
  }
  persist();
  render();
}

function openEmailModal(shop) {
  state.activeShopId = shop.id;
  els.toEmail.value = shop.emailAddress || "";
  els.subject.value = "";
  els.body.value = "";
  els.modal.classList.remove("hidden");
  generateEmail(shop.id, false);
}

function closeModal() {
  els.modal.classList.add("hidden");
  state.activeShopId = null;
}

async function generateEmail(id, regenerate) {
  if (!id) return;
  const shop = state.prospects.find((s) => s.id === id);
  if (!shop) return;

  const demoUrl = els.demoUrl.value.trim();
  const senderName = els.senderName.value.trim();
  if (!demoUrl || !senderName) {
    els.subject.value = "";
    els.body.value = "Fill in your name and demo website URL at the top, then click Regenerate.";
    return;
  }

  els.body.value = "Generating...";
  els.regenerate.disabled = true;
  try {
    const r = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: shop.name,
        city: shop.city || "",
        demoUrl,
        senderName,
        tone: els.tone.value.trim() || undefined,
        shopDetails: shop.address || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Generation failed");
    els.subject.value = data.subject;
    els.body.value = data.body;
  } catch (err) {
    els.body.value = "Error: " + err.message;
  } finally {
    els.regenerate.disabled = false;
  }
}

async function copyEmail() {
  const text = `Subject: ${els.subject.value}\n\n${els.body.value}`;
  try {
    await navigator.clipboard.writeText(text);
    els.copyEmail.textContent = "Copied!";
    setTimeout(() => (els.copyEmail.textContent = "Copy"), 1200);
  } catch {
    els.copyEmail.textContent = "Copy failed";
  }
}

function openMailAndMarkSent() {
  const shop = state.prospects.find((s) => s.id === state.activeShopId);
  if (!shop) return;
  const to = els.toEmail.value.trim();
  const subject = els.subject.value.trim();
  const body = els.body.value.trim();
  if (!to) {
    alert("Add a recipient email first.");
    return;
  }
  shop.emailAddress = to;
  shop.status = "sent";
  shop.sentAt = Date.now();
  persist();
  render();

  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
  closeModal();
}

function loadProspects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prospects)); }

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (s.senderName) els.senderName.value = s.senderName;
    if (s.demoUrl) els.demoUrl.value = s.demoUrl;
    if (s.tone) els.tone.value = s.tone;
  } catch {}
}
function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      senderName: els.senderName.value.trim(),
      demoUrl: els.demoUrl.value.trim(),
      tone: els.tone.value.trim(),
    }),
  );
}

function escape(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fbUrl(v) { return /^https?:/.test(v) ? v : `https://facebook.com/${v.replace(/^\/+/, "")}`; }
function igUrl(v) { return /^https?:/.test(v) ? v : `https://instagram.com/${v.replace(/^@|^\/+/, "")}`; }
