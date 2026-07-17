// ============================================================================
// Prestige Power Washing — Mission Control
//
// Read-only dashboard. All data comes from JSON files in /ecosystem/, written
// by scheduled agents (bug tracker, YouTube content, lead research, goals,
// orchestrator). This page never writes anything back — it just renders.
// ============================================================================

var DASH_PIN = "2608"; // <-- change me (same convention as leads.js)

var DATA_FILES = {
  status: "ecosystem/status.json",
  bugs: "ecosystem/bugs.json",
  youtube: "ecosystem/youtube.json",
  leads: "ecosystem/leads_research.json",
  goals: "ecosystem/goals.json"
};

var AGENT_LABELS = {
  "bug-tracker": "Bug Tracker",
  "youtube-content": "YouTube Content",
  "lead-research": "RGV Lead Research",
  "goals-tracker": "Goals",
  "orchestrator": "Orchestrator"
};

// ---------------------------------------------------------------------------
// Lock screen
// ---------------------------------------------------------------------------
(function () {
  var pinInput = document.getElementById("pin-input");
  var unlockBtn = document.getElementById("unlock-btn");
  var pinError = document.getElementById("pin-error");
  var lockBtn = document.getElementById("lock-btn");
  var refreshBtn = document.getElementById("refresh-btn");

  function tryUnlock() {
    if (pinInput.value === DASH_PIN) {
      try { sessionStorage.setItem("ppw_ecosystem_unlocked", "1"); } catch (e) {}
      document.documentElement.classList.add("unlocked");
      pinError.hidden = true;
      loadAll();
    } else {
      pinError.hidden = false;
    }
  }

  unlockBtn.addEventListener("click", tryUnlock);
  pinInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryUnlock();
  });
  lockBtn.addEventListener("click", function () {
    try { sessionStorage.removeItem("ppw_ecosystem_unlocked"); } catch (e) {}
    document.documentElement.classList.remove("unlocked");
  });
  refreshBtn.addEventListener("click", loadAll);

  if (document.documentElement.classList.contains("unlocked")) loadAll();
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function fetchJSON(path) {
  return fetch(path + "?v=" + Date.now())
    .then(function (r) { if (!r.ok) throw new Error(path + " " + r.status); return r.json(); });
}

function timeAgo(iso) {
  if (!iso) return "never run";
  var ms = Date.now() - new Date(iso).getTime();
  var mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  var hrs = Math.round(mins / 60);
  if (hrs < 48) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

function emptyState(text) {
  return '<p class="empty-state">' + esc(text) + "</p>";
}

// ---------------------------------------------------------------------------
// Load + render
// ---------------------------------------------------------------------------
function loadAll() {
  Promise.all([
    fetchJSON(DATA_FILES.status).catch(function () { return null; }),
    fetchJSON(DATA_FILES.bugs).catch(function () { return null; }),
    fetchJSON(DATA_FILES.youtube).catch(function () { return null; }),
    fetchJSON(DATA_FILES.leads).catch(function () { return null; }),
    fetchJSON(DATA_FILES.goals).catch(function () { return null; })
  ]).then(function (results) {
    renderStatus(results[0]);
    renderBugs(results[1]);
    renderYoutube(results[2]);
    renderLeads(results[3]);
    renderGoals(results[4]);
  });
}

function renderStatus(data) {
  var el = document.getElementById("agent-status");
  var agents = (data && data.agents) || {};
  var order = ["orchestrator", "bug-tracker", "youtube-content", "lead-research", "goals-tracker"];
  el.innerHTML = order.map(function (key) {
    var a = agents[key] || {};
    var state = !a.last_run ? "never" :
      (Date.now() - new Date(a.last_run).getTime() > 1000 * 60 * 60 * 6 ? "stale" : "ok");
    var flags = (a.flags || []).map(function (f) { return esc(f); }).join("<br>");
    return '<div class="agent-card ' + state + '">' +
      '<div class="agent-name">' + esc(AGENT_LABELS[key] || key) + "</div>" +
      '<div class="agent-summary">' + esc(a.summary || "Not yet run.") + "</div>" +
      '<div class="agent-time">' + esc(timeAgo(a.last_run)) + "</div>" +
      (flags ? '<div class="agent-flags">' + flags + "</div>" : "") +
      "</div>";
  }).join("");
}

function renderBugs(data) {
  var el = document.getElementById("bug-list");
  var bugs = (data && data.bugs) || [];
  if (!bugs.length) { el.innerHTML = emptyState("No bugs logged yet."); return; }
  el.innerHTML = bugs.map(function (b) {
    return '<div class="stack-item bug-' + esc(b.severity || "low") + '" data-status="' + esc(b.status || "open") + '">' +
      '<div class="item-top">' +
        '<span class="item-title">' + esc(b.title) + "</span>" +
        '<span><span class="pill severity-' + esc(b.severity) + '">' + esc(b.severity) + "</span> " +
        '<span class="pill status-' + esc(b.status) + '">' + esc(b.status) + "</span></span>" +
      "</div>" +
      '<div class="item-body">' + esc(b.description || "") + "</div>" +
      '<div class="item-meta">' + esc(b.area || "") + " &middot; found " + esc(timeAgo(b.found_at)) + "</div>" +
    "</div>";
  }).join("");

  var buttons = document.querySelectorAll('[data-bug-filter]');
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var filter = btn.getAttribute("data-bug-filter");
      el.querySelectorAll(".stack-item").forEach(function (item) {
        item.style.display = (filter === "all" || item.getAttribute("data-status") === filter) ? "" : "none";
      });
    });
  });
}

function renderYoutube(data) {
  document.getElementById("youtube-status-note").textContent =
    data ? ("Channel status: " + (data.channel_status || "unknown") + (data.channel_notes ? " — " + data.channel_notes : "")) : "";

  var ideasEl = document.getElementById("youtube-ideas");
  var ideas = (data && data.content_ideas) || [];
  ideasEl.innerHTML = ideas.length ? ideas.map(function (v) {
    return '<div class="stack-item">' +
      '<div class="item-top"><span class="item-title">' + esc(v.title) + '</span>' +
      '<span class="pill">' + esc(v.status || "idea") + "</span></div>" +
      '<div class="item-body">' + esc(v.hook || "") + "</div>" +
    "</div>";
  }).join("") : emptyState("No content ideas queued yet.");

  var pubEl = document.getElementById("youtube-published");
  var pub = (data && data.published_videos) || [];
  pubEl.innerHTML = pub.length ? pub.map(function (v) {
    return '<div class="stack-item">' +
      '<div class="item-top"><span class="item-title">' + esc(v.title) + '</span>' +
      '<span class="item-meta">' + esc(v.views || 0) + " views &middot; " + esc(v.likes || 0) + " likes</span></div>" +
      '<div class="item-body">Hook: ' + esc(v.hook || "—") + "<br>" + esc(v.retention_notes || "") + "</div>" +
    "</div>";
  }).join("") : emptyState("No published videos tracked yet — nothing to compare hooks against until the channel launches.");
}

function renderLeads(data) {
  var nEl = document.getElementById("lead-neighborhoods");
  var neighborhoods = (data && data.target_neighborhoods) || [];
  nEl.innerHTML = neighborhoods.length ? neighborhoods.map(function (n) {
    return '<div class="stack-item"><div class="item-top"><span class="item-title">' + esc(n.name) +
      '</span><span class="pill">' + esc(n.priority || "") + "</span></div>" +
      '<div class="item-body">' + esc(n.why || "") + "</div></div>";
  }).join("") : emptyState("No target areas identified yet.");

  var mEl = document.getElementById("lead-notes");
  var notes = (data && data.market_notes) || [];
  mEl.innerHTML = notes.length ? notes.map(function (n) {
    return '<div class="stack-item"><div class="item-top"><span class="pill">' + esc(n.category || "") +
      '</span><span class="item-meta">' + esc(timeAgo(n.date)) + "</span></div>" +
      '<div class="item-body">' + esc(n.note) + "</div></div>";
  }).join("") : emptyState("No market notes yet.");

  var aEl = document.getElementById("lead-actions");
  var actions = (data && data.action_items) || [];
  aEl.innerHTML = actions.length ? actions.map(function (a) {
    return '<div class="stack-item"><div class="item-top"><span class="item-title">' + esc(a.text) +
      '</span><span class="pill">' + esc(a.status || "open") + "</span></div></div>";
  }).join("") : emptyState("No action items yet.");
}

function renderGoals(data) {
  var el = document.getElementById("goals-list");
  var goals = (data && data.objectives) || [];
  el.innerHTML = goals.length ? goals.map(function (g) {
    var pct = Math.max(0, Math.min(100, g.progress_pct || 0));
    return '<div class="stack-item">' +
      '<div class="item-top"><span class="item-title">' + esc(g.title) +
      '</span><span class="pill">' + esc(g.status || "") + "</span></div>" +
      '<div class="item-body">' + esc(g.description || "") + "</div>" +
      '<div class="goal-progress-track"><div class="goal-progress-fill" style="width:' + pct + '%"></div></div>' +
    "</div>";
  }).join("") : emptyState("No goals set yet.");
}
