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

var AGENT_ORDER = ["orchestrator", "bug-tracker", "youtube-content", "lead-research", "goals-tracker"];

var AGENT_SPRITES = {
  "bug-tracker": "\u{1F41B}",
  "youtube-content": "\u{1F3AC}",
  "lead-research": "\u{1F9FD}",
  "goals-tracker": "\u{1F3AF}",
  "orchestrator": "\u{1F9ED}"
};

var STATE_MOOD = { ok: "⚡", stale: "\u{1F4A4}", never: "\u{1F319}" };

function agentState(a) {
  if (!a || !a.last_run) return "never";
  return Date.now() - new Date(a.last_run).getTime() > 1000 * 60 * 60 * 6 ? "stale" : "ok";
}

// ---------------------------------------------------------------------------
// The Ecosystem — one shared canvas scene. Zone agents wander their own
// zone; when they've just run (state "ok") they occasionally walk over to
// the orchestrator's hub, "report in", then walk home. Stale agents wander
// slower and never visit. Never-run agents sit frozen and grayed out.
// ---------------------------------------------------------------------------
var Scene = (function () {
  var W = 900, H = 440;
  var HUB = { x: 450, y: 220, r: 46 };
  var ZONES = {
    "bug-tracker": { rect: { x: 30, y: 30, w: 250, h: 160 }, label: "Bug Den", emoji: "\u{1F41B}", color: "#ffe9e9", hubSlot: { x: HUB.x - 34, y: HUB.y - 26 } },
    "youtube-content": { rect: { x: 620, y: 30, w: 250, h: 160 }, label: "YouTube Studio", emoji: "\u{1F3AC}", color: "#e7ecff", hubSlot: { x: HUB.x + 34, y: HUB.y - 26 } },
    "lead-research": { rect: { x: 30, y: 250, w: 250, h: 160 }, label: "Lead Map Table", emoji: "\u{1F9FD}", color: "#e5f7ec", hubSlot: { x: HUB.x - 34, y: HUB.y + 26 } },
    "goals-tracker": { rect: { x: 620, y: 250, w: 250, h: 160 }, label: "Goals Board", emoji: "\u{1F3AF}", color: "#fff3d9", hubSlot: { x: HUB.x + 34, y: HUB.y + 26 } }
  };
  var ZONE_KEYS = Object.keys(ZONES);
  var STATE_COLOR = { ok: "#1aa260", stale: "#b8860b", never: "#9aa2ad" };

  var canvas, ctx, ents = {}, started = false, reduced = false, dpr = 1;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function randomPointInRect(rect, pad) {
    return { x: rand(rect.x + pad, rect.x + rect.w - pad), y: rand(rect.y + pad, rect.y + rect.h - pad) };
  }

  function zoneCenter(zone) { return { x: zone.rect.x + zone.rect.w / 2, y: zone.rect.y + zone.rect.h / 2 }; }

  function makeEntity(key) {
    if (key === "orchestrator") {
      var start = { x: HUB.x, y: HUB.y };
      return { key: key, x: start.x, y: start.y, tx: start.x, ty: start.y, phase: "wander", wait: 0, state: "never" };
    }
    var zone = ZONES[key];
    var start = zoneCenter(zone);
    return { key: key, x: start.x, y: start.y, tx: start.x, ty: start.y, phase: "wander", wait: 0, state: "never" };
  }

  ZONE_KEYS.concat(["orchestrator"]).forEach(function (key) { ents[key] = makeEntity(key); });

  function pickNextTarget(e) {
    if (e.key === "orchestrator") {
      if (e.phase === "wander") {
        if (e.state === "ok" && Math.random() < 0.3) {
          var toZone = ZONES[ZONE_KEYS[Math.floor(Math.random() * ZONE_KEYS.length)]];
          e.phase = "patrol"; var c = zoneCenter(toZone); e.tx = c.x; e.ty = c.y;
        } else {
          e.tx = HUB.x + rand(-20, 20); e.ty = HUB.y + rand(-16, 16);
        }
      } else if (e.phase === "patrol") {
        e.phase = "patrol_wait"; e.wait = 45 + rand(0, 30);
      } else if (e.phase === "return") {
        e.phase = "wander"; e.tx = HUB.x + rand(-20, 20); e.ty = HUB.y + rand(-16, 16);
      }
      return;
    }
    var zone = ZONES[e.key];
    if (e.phase === "wander") {
      if (e.state === "ok" && Math.random() < 0.45) {
        e.phase = "travel_to_hub"; e.tx = zone.hubSlot.x; e.ty = zone.hubSlot.y;
      } else {
        var p = randomPointInRect(zone.rect, 26); e.tx = p.x; e.ty = p.y;
      }
    } else if (e.phase === "travel_to_hub") {
      e.phase = "at_hub"; e.wait = 55 + rand(0, 35);
    } else if (e.phase === "travel_home") {
      e.phase = "wander"; var p2 = randomPointInRect(zone.rect, 26); e.tx = p2.x; e.ty = p2.y;
    }
  }

  function step() {
    ZONE_KEYS.concat(["orchestrator"]).forEach(function (key) {
      var e = ents[key];
      if (e.state === "never") return;
      if (e.phase === "at_hub" || e.phase === "patrol_wait") {
        e.wait--;
        if (e.wait <= 0) { e.phase = e.phase === "at_hub" ? "travel_home" : "return"; pickNextTarget(e); }
        return;
      }
      var ease = e.state === "ok" ? 0.045 : 0.018;
      var dx = e.tx - e.x, dy = e.ty - e.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) { pickNextTarget(e); return; }
      e.x += dx * ease; e.y += dy * ease;
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#eef3ff";
    ctx.fillRect(0, 0, W, H);

    ZONE_KEYS.forEach(function (key) {
      var zone = ZONES[key];
      var state = ents[key].state;
      ctx.fillStyle = zone.color;
      roundRect(zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h, 16);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = STATE_COLOR[state];
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "16px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
      ctx.fillText(zone.emoji, zone.rect.x + 14, zone.rect.y + 10);
      ctx.fillStyle = "#2a3550";
      ctx.font = "700 14px Poppins, sans-serif";
      ctx.fillText(zone.label, zone.rect.x + 38, zone.rect.y + 12);
    });

    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(HUB.x, HUB.y, HUB.r, 0, Math.PI * 2);
    ctx.strokeStyle = STATE_COLOR[ents.orchestrator.state];
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#5b6a8a";
    ctx.font = "700 11px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HQ", HUB.x, HUB.y - HUB.r - 14);

    ZONE_KEYS.concat(["orchestrator"]).forEach(function (key) {
      var e = ents[key];
      var frozen = e.state === "never";
      ctx.save();
      if (frozen) ctx.globalAlpha = 0.45;

      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 14, 13, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20,30,50,0.18)";
      ctx.fill();

      ctx.font = "28px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (frozen) ctx.filter = "grayscale(1)";
      ctx.fillText(AGENT_SPRITES[key], e.x, e.y);
      ctx.filter = "none";

      ctx.font = "13px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
      ctx.fillText(STATE_MOOD[e.state], e.x + 16, e.y - 15);

      ctx.font = "600 10px Poppins, sans-serif";
      ctx.fillStyle = "#3c4a6b";
      ctx.fillText(AGENT_LABELS[key] || key, e.x, e.y + 24);
      ctx.restore();
    });
  }

  function tick() {
    step();
    draw();
    requestAnimationFrame(tick);
  }

  function setupCanvas() {
    canvas = document.getElementById("ecosystem-scene");
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  }

  function start() {
    if (started || !canvas) return;
    started = true;
    if (reduced) { draw(); return; }
    requestAnimationFrame(tick);
  }

  function update(statusData, bugs, youtube, leads, goals) {
    if (!canvas) setupCanvas();
    var agents = (statusData && statusData.agents) || {};
    ZONE_KEYS.concat(["orchestrator"]).forEach(function (key) {
      ents[key].state = agentState(agents[key]);
    });
    start();
    if (reduced || !started) draw();
  }

  return { update: update };
})();

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
    renderHud(results[0], results[1], results[2], results[3], results[4]);
    Scene.update(results[0], results[1], results[2], results[3], results[4]);
    renderBugs(results[1]);
    renderYoutube(results[2]);
    renderLeads(results[3]);
    renderGoals(results[4]);
  });
}

function renderStatus(data) {
  var el = document.getElementById("agent-status");
  var agents = (data && data.agents) || {};
  el.innerHTML = AGENT_ORDER.map(function (key) {
    var a = agents[key] || {};
    var state = agentState(a);
    var flags = (a.flags || []).map(function (f) { return esc(f); }).join("<br>");
    return '<div class="agent-card ' + state + '">' +
      '<div class="agent-name">' + esc(AGENT_LABELS[key] || key) + "</div>" +
      '<div class="agent-summary">' + esc(a.summary || "Not yet run.") + "</div>" +
      '<div class="agent-time">' + esc(timeAgo(a.last_run)) + "</div>" +
      (flags ? '<div class="agent-flags">' + flags + "</div>" : "") +
      "</div>";
  }).join("");
}

function agentCaption(key, state, statusData, bugs, youtube, leads, goals) {
  var a = ((statusData && statusData.agents) || {})[key] || {};
  if (key === "bug-tracker") {
    var open = ((bugs && bugs.bugs) || []).filter(function (b) { return b.status === "open"; }).length;
    return state === "never" ? "hasn't scanned yet" : open + " open bug" + (open === 1 ? "" : "s");
  }
  if (key === "youtube-content") {
    var ideas = (youtube && youtube.content_ideas || []).length;
    if (youtube && youtube.channel_status === "not_launched" && !ideas) return "channel not launched yet";
    return ideas + " idea" + (ideas === 1 ? "" : "s") + " queued";
  }
  if (key === "lead-research") {
    var areas = (leads && leads.target_neighborhoods || []).length;
    return state === "never" ? "hasn't researched yet" : areas + " area" + (areas === 1 ? "" : "s") + " tracked";
  }
  if (key === "goals-tracker") {
    var objs = (goals && goals.objectives || []).length;
    return state === "never" ? "no goals set yet" : objs + " goal" + (objs === 1 ? "" : "s") + " tracked";
  }
  if (key === "orchestrator") {
    var agents = (statusData && statusData.agents) || {};
    var healthy = AGENT_ORDER.filter(function (k) { return agentState(agents[k]) === "ok"; }).length;
    return healthy + "/" + AGENT_ORDER.length + " agents healthy";
  }
  return a.summary || "";
}

function renderHud(statusData, bugs, youtube, leads, goals) {
  var el = document.getElementById("scene-hud");
  var agents = (statusData && statusData.agents) || {};
  el.innerHTML = AGENT_ORDER.map(function (key) {
    var a = agents[key] || {};
    var state = agentState(a);
    return "<li><span class=\"hud-dot state-" + state + "\"></span>" +
      "<strong>" + esc(AGENT_LABELS[key] || key) + "</strong> — " +
      esc(agentCaption(key, state, statusData, bugs, youtube, leads, goals)) +
      " · " + esc(timeAgo(a.last_run)) + "</li>";
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
