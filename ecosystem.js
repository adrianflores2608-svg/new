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
  goals: "ecosystem/goals.json",
  activity: "ecosystem/activity_log.json"
};

var HORIZON_ORDER = ["day", "week", "month", "year"];

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

var ZONE_LOG_COLOR = {
  "bug-tracker": "#ff5d6c",
  "youtube-content": "#c86bff",
  "lead-research": "#3ddc97",
  "goals-tracker": "#ffd166",
  "orchestrator": "#7ef7ff"
};

function agentState(a) {
  if (!a || !a.last_run) return "never";
  return Date.now() - new Date(a.last_run).getTime() > 1000 * 60 * 60 * 6 ? "stale" : "ok";
}

// ---------------------------------------------------------------------------
// The Ecosystem — one shared cyberpunk command-center scene. Zone agents
// wander their own zone; when they've just run (state "ok") they walk a
// data-line over to the orchestrator's HQ hub, "report in", then walk home.
// Stale agents wander slower and never visit. Never-run agents freeze
// grayscale. Everything below is canvas primitives — no image assets.
// ---------------------------------------------------------------------------
var Scene = (function () {
  var W = 900, H = 480;
  var HUB = { x: 450, y: 220, r: 50 };
  var EMOJI_FONT = "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
  var ZONES = {
    "bug-tracker": { rect: { x: 30, y: 30, w: 250, h: 160 }, label: "BUG DEN", emoji: "\u{1F41B}", accent: "#ff5d6c", hubSlot: { x: HUB.x - 36, y: HUB.y - 28 } },
    "youtube-content": { rect: { x: 620, y: 30, w: 250, h: 160 }, label: "YOUTUBE STUDIO", emoji: "\u{1F3AC}", accent: "#c86bff", hubSlot: { x: HUB.x + 36, y: HUB.y - 28 } },
    "lead-research": { rect: { x: 30, y: 250, w: 250, h: 160 }, label: "LEAD MAP TABLE", emoji: "\u{1F9FD}", accent: "#3ddc97", hubSlot: { x: HUB.x - 36, y: HUB.y + 28 } },
    "goals-tracker": { rect: { x: 620, y: 250, w: 250, h: 160 }, label: "GOALS BOARD", emoji: "\u{1F3AF}", accent: "#ffd166", hubSlot: { x: HUB.x + 36, y: HUB.y + 28 } }
  };
  var ZONE_KEYS = Object.keys(ZONES);
  var ALL_KEYS = ZONE_KEYS.concat(["orchestrator"]);
  var HQ_ACCENT = "#7ef7ff";
  var STATE_COLOR = { ok: "#3ddc97", stale: "#ffd166", never: "#5c667f" };
  var STATE_MAX_PARTICLES = { ok: 7, stale: 2, never: 0 };
  var STATE_PARTICLE_SPEED = { ok: 0.55, stale: 0.22, never: 0 };

  var canvas, ctx, ents = {}, particles = {}, pulses = {}, started = false, reduced = false, dpr = 1;
  var frame = 0, radarAngle = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function beat(phase) {
    var t = frame * 0.06, p = phase || 0;
    return 0.5 + 0.25 * Math.sin(t + p) + 0.15 * Math.sin(t * 2.3 + p * 1.7) + 0.1 * Math.sin(t * 4.1 + p * 0.6);
  }
  function randomPointInRect(rect, pad) {
    return { x: rand(rect.x + pad, rect.x + rect.w - pad), y: rand(rect.y + pad, rect.y + rect.h - pad) };
  }
  function zoneCenter(zone) { return { x: zone.rect.x + zone.rect.w / 2, y: zone.rect.y + zone.rect.h / 2 }; }
  function edgePoint(from, to, inset) {
    var dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return { x: from.x + (dx / d) * inset, y: from.y + (dy / d) * inset };
  }

  ZONE_KEYS.forEach(function (key) { particles[key] = []; pulses[key] = []; });

  function makeEntity(key) {
    var start = key === "orchestrator" ? { x: HUB.x, y: HUB.y } : zoneCenter(ZONES[key]);
    return { key: key, x: start.x, y: start.y, tx: start.x, ty: start.y, phase: "wander", wait: 0, state: "never" };
  }
  ALL_KEYS.forEach(function (key) { ents[key] = makeEntity(key); });

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
        pulses[e.key].push({ t: 0 });
      } else {
        var p = randomPointInRect(zone.rect, 30); e.tx = p.x; e.ty = p.y;
      }
    } else if (e.phase === "travel_to_hub") {
      e.phase = "at_hub"; e.wait = 55 + rand(0, 35);
    } else if (e.phase === "travel_home") {
      e.phase = "wander"; var p2 = randomPointInRect(zone.rect, 30); e.tx = p2.x; e.ty = p2.y;
    }
  }

  function stepEntities() {
    ALL_KEYS.forEach(function (key) {
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

  function stepParticles() {
    ZONE_KEYS.forEach(function (key) {
      var zone = ZONES[key], state = ents[key].state, list = particles[key];
      var max = STATE_MAX_PARTICLES[state], speed = STATE_PARTICLE_SPEED[state];
      if (list.length < max && Math.random() < 0.12) {
        list.push({ x: rand(zone.rect.x + 16, zone.rect.x + zone.rect.w - 16), y: zone.rect.y + zone.rect.h - 8, life: 1 });
      }
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.y -= speed; p.life -= 1 / 130;
        if (p.life <= 0 || p.y < zone.rect.y + 20) list.splice(i, 1);
      }
    });
  }

  function stepPulses() {
    ZONE_KEYS.forEach(function (key) {
      var list = pulses[key];
      for (var i = list.length - 1; i >= 0; i--) {
        list[i].t += 0.028;
        if (list[i].t >= 1) list.splice(i, 1);
      }
    });
  }

  function chamferRect(x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  }

  function drawCornerTicks(x, y, w, h, len, color) {
    var pts = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    pts.forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] + len * p[3]);
      ctx.lineTo(p[0], p[1]);
      ctx.lineTo(p[0] + len * p[2], p[1]);
      ctx.stroke();
    });
  }

  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",") + "," + a + ")";
  }

  function drawBackground() {
    var grad = ctx.createRadialGradient(HUB.x, HUB.y, 30, W / 2, H / 2, 640);
    grad.addColorStop(0, "#0c1433");
    grad.addColorStop(1, "#03050f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = "rgba(126,247,255,0.05)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= W; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy <= H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    ctx.strokeStyle = "rgba(126,247,255,0.045)";
    [90, 180, 280, 380].forEach(function (r) {
      ctx.beginPath(); ctx.arc(HUB.x, HUB.y, r, 0, Math.PI * 2); ctx.stroke();
    });
    for (var s = 0; s < 12; s++) {
      var a = (s / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(HUB.x + Math.cos(a) * 90, HUB.y + Math.sin(a) * 90);
      ctx.lineTo(HUB.x + Math.cos(a) * 380, HUB.y + Math.sin(a) * 380);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawConnectors() {
    ZONE_KEYS.forEach(function (key) {
      var zone = ZONES[key];
      var c = zoneCenter(zone);
      var a = edgePoint(c, HUB, 95);
      var b = edgePoint(HUB, c, HUB.r);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = hexToRgba(zone.accent, 0.08 + beat(key.length) * 0.1);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawPulseStrip() {
    var barCount = 26, gap = 2.5, totalW = 340;
    var bw = (totalW - gap * (barCount - 1)) / barCount;
    var startX = W / 2 - totalW / 2;
    var stripY = H - 40, stripH = 22;
    var activeCount = ALL_KEYS.filter(function (k) { return ents[k].state === "ok"; }).length;
    var boost = 0.35 + activeCount * 0.14;
    var colors = [ZONES["bug-tracker"].accent, ZONES["youtube-content"].accent, HQ_ACCENT, ZONES["lead-research"].accent, ZONES["goals-tracker"].accent];
    ctx.save();
    ctx.font = "600 9px 'Share Tech Mono', monospace";
    ctx.fillStyle = "rgba(126,247,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText("SYSTEM PULSE", W / 2, stripY - 10);
    for (var i = 0; i < barCount; i++) {
      var amp = Math.max(0.06, beat(i * 0.8) * boost);
      var bh = 2 + amp * stripH;
      var color = colors[i % colors.length];
      var bx = startX + i * (bw + gap);
      ctx.fillStyle = hexToRgba(color, 0.85);
      ctx.shadowColor = color; ctx.shadowBlur = 5;
      ctx.fillRect(bx, stripY + stripH - bh, bw, bh);
    }
    ctx.restore();
  }

  function drawZoneProps(key) {
    var zone = ZONES[key], rect = zone.rect, ac = zone.accent, state = ents[key].state;
    var active = state !== "never";
    ctx.save();
    ctx.strokeStyle = hexToRgba(ac, 0.55);
    ctx.fillStyle = hexToRgba(ac, 0.35);

    if (key === "bug-tracker") {
      for (var i = 0; i < 3; i++) {
        var rx = rect.x + rect.w - 46 + i * 13;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(rx, rect.y + 20, 9, 34);
        ctx.fillStyle = (frame + i * 20) % 60 < 30 ? hexToRgba(ac, 0.9) : hexToRgba(ac, 0.2);
        ctx.fillRect(rx + 2, rect.y + 24, 5, 3);
      }
      var tx = rect.x + 16, ty = rect.y + rect.h - 50;
      ctx.strokeStyle = hexToRgba(ac, 0.5); ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, 78, 36);
      for (var li = 0; li < 3; li++) {
        var lw = active ? 16 + ((frame + li * 11) % 46) : 20;
        ctx.beginPath(); ctx.moveTo(tx + 7, ty + 9 + li * 9); ctx.lineTo(tx + 7 + lw, ty + 9 + li * 9);
        ctx.strokeStyle = hexToRgba(ac, 0.65); ctx.lineWidth = 2; ctx.stroke();
      }
      if (state === "ok" && frame % 50 < 28) {
        var wx = rect.x + rect.w - 20, wy = rect.y + rect.h - 44, hr = 9;
        ctx.beginPath();
        for (var hi = 0; hi < 6; hi++) {
          var ha = hi * (Math.PI / 3) - Math.PI / 2;
          var hpx = wx + Math.cos(ha) * hr, hpy = wy + Math.sin(ha) * hr;
          if (hi === 0) ctx.moveTo(hpx, hpy); else ctx.lineTo(hpx, hpy);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255,209,102,0.16)"; ctx.fill();
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1.3;
        ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffd166"; ctx.font = "700 10px 'Share Tech Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("!", wx, wy + 1);
      }
    } else if (key === "youtube-content") {
      var cx = rect.x + rect.w - 34, cy = rect.y + 34;
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - 7); ctx.lineTo(cx - 5, cy + 7); ctx.lineTo(cx + 8, cy); ctx.closePath();
      ctx.fillStyle = hexToRgba(ac, 0.8); ctx.fill();
      if (active && frame % 40 < 22) {
        ctx.beginPath(); ctx.arc(rect.x + 20, rect.y + 20, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3b3b"; ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffb3b3"; ctx.font = "700 8px 'Share Tech Mono', monospace"; ctx.textAlign = "left";
        ctx.fillText("REC", rect.x + 28, rect.y + 17);
      }
      var vuX = rect.x + 16, vuY = rect.y + rect.h - 20;
      for (var vb = 0; vb < 8; vb++) {
        var amp = active ? beat(vb * 0.9 + key.length) : 0.1;
        var bh = 3 + amp * 20;
        ctx.fillStyle = hexToRgba(ac, 0.75);
        ctx.fillRect(vuX + vb * 7, vuY - bh, 4, bh);
      }
    } else if (key === "lead-research") {
      var bx = rect.x + rect.w - 56, by = rect.y + 18;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 40, 32);
      for (var gxp = bx; gxp <= bx + 40; gxp += 10) { ctx.beginPath(); ctx.moveTo(gxp, by); ctx.lineTo(gxp, by + 32); ctx.stroke(); }
      for (var gyp = by; gyp <= by + 32; gyp += 8) { ctx.beginPath(); ctx.moveTo(bx, gyp); ctx.lineTo(bx + 40, gyp); ctx.stroke(); }
      var pin1 = { x: bx + 12, y: by + 10 }, pin2 = { x: bx + 28, y: by + 22 };
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(pin1.x, pin1.y); ctx.lineTo(pin2.x, pin2.y);
      ctx.strokeStyle = hexToRgba(ac, 0.6); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = hexToRgba(ac, 0.85);
      ctx.beginPath(); ctx.arc(pin1.x, pin1.y, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pin2.x, pin2.y, 2.4, 0, Math.PI * 2); ctx.fill();

      var rcx = rect.x + 30, rcy = rect.y + rect.h - 34, rr = 16, ang = frame * (active ? 0.015 : 0.004);
      ctx.strokeStyle = hexToRgba(ac, 0.55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
      for (var tick = 0; tick < 4; tick++) {
        var ta = ang + tick * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(rcx + Math.cos(ta) * (rr - 5), rcy + Math.sin(ta) * (rr - 5));
        ctx.lineTo(rcx + Math.cos(ta) * (rr + 3), rcy + Math.sin(ta) * (rr + 3));
        ctx.strokeStyle = tick === 0 ? hexToRgba("#ff5d6c", 0.9) : hexToRgba(ac, 0.7);
        ctx.lineWidth = 1.6; ctx.stroke();
      }
    } else if (key === "goals-tracker") {
      var tgx = rect.x + rect.w - 34, tgy = rect.y + 34;
      [15, 10, 5].forEach(function (r, idx) {
        ctx.beginPath(); ctx.arc(tgx, tgy, r, 0, Math.PI * 2);
        ctx.strokeStyle = idx % 2 === 0 ? hexToRgba(ac, 0.6) : hexToRgba(ac, 0.9);
        ctx.lineWidth = 2; ctx.stroke();
      });
      var bcx = rect.x + 18, bcy = rect.y + rect.h - 18;
      var heights = [10, 18, 13, 22];
      heights.forEach(function (h, idx) {
        ctx.fillStyle = hexToRgba(ac, 0.35 + idx * 0.15);
        ctx.fillRect(bcx + idx * 10, bcy - h, 6, h);
      });
    }
    ctx.restore();
  }

  function drawZones() {
    ZONE_KEYS.forEach(function (key) {
      var zone = ZONES[key], rect = zone.rect, state = ents[key].state;
      var pulse = beat(key.length);
      ctx.save();
      ctx.fillStyle = hexToRgba(zone.accent, 0.055);
      chamferRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.shadowColor = zone.accent;
      ctx.shadowBlur = state === "ok" ? 10 + pulse * 8 : 4;
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = hexToRgba(zone.accent, state === "never" ? 0.3 : 0.8);
      ctx.stroke();
      ctx.shadowBlur = 0;
      chamferRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 9);
      ctx.strokeStyle = hexToRgba(zone.accent, state === "never" ? 0.14 : 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      drawCornerTicks(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, 9, hexToRgba(zone.accent, 0.9));
      ctx.restore();

      drawZoneProps(key);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "15px " + EMOJI_FONT;
      ctx.globalAlpha = 0.85;
      ctx.fillText(zone.emoji, zone.rect.x + 16, zone.rect.y + 11);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#dfe6ff";
      ctx.font = "700 11px Orbitron, sans-serif";
      ctx.fillText(zone.label, zone.rect.x + 39, zone.rect.y + 13);
      ctx.fillStyle = hexToRgba(zone.accent, 0.55);
      ctx.font = "600 8px 'Share Tech Mono', monospace";
      ctx.fillText("SECTOR " + (ZONE_KEYS.indexOf(key) + 1).toString().padStart(2, "0"), zone.rect.x + 39, zone.rect.y + 27);

      var led = STATE_COLOR[state];
      ctx.save();
      ctx.translate(zone.rect.x + zone.rect.w - 16, zone.rect.y + 17);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = led;
      ctx.shadowColor = led; ctx.shadowBlur = 7;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    });
  }

  function drawParticles() {
    ZONE_KEYS.forEach(function (key) {
      var zone = ZONES[key];
      particles[key].forEach(function (p) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = zone.accent;
        ctx.shadowColor = zone.accent; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    });
  }

  function drawPulses() {
    ZONE_KEYS.forEach(function (key) {
      var zone = ZONES[key];
      var c = zoneCenter(zone);
      var a = edgePoint(c, HUB, 95);
      var b = edgePoint(HUB, c, HUB.r);
      var ang = Math.atan2(b.y - a.y, b.x - a.x);
      pulses[key].forEach(function (pu) {
        ctx.save();
        ctx.shadowColor = zone.accent; ctx.shadowBlur = 8;
        [0, -0.05, -0.1].forEach(function (dt, idx) {
          var t = Math.max(0, Math.min(1, pu.t + dt));
          var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ang);
          ctx.globalAlpha = 1 - idx * 0.35;
          ctx.beginPath();
          ctx.moveTo(-4, -4); ctx.lineTo(3, 0); ctx.lineTo(-4, 4);
          ctx.strokeStyle = zone.accent; ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();
      });
    });
  }

  function drawHub() {
    var state = ents.orchestrator.state;
    var live = state !== "never";
    var core = 9 + beat(0) * 2.5;

    // outer instrument bezel — fixed tick-mark dial
    var bezelR = HUB.r + 16;
    for (var t = 0; t < 60; t++) {
      var ta = (t / 60) * Math.PI * 2;
      var major = t % 5 === 0;
      var r1 = bezelR - (major ? 7 : 4), r2 = bezelR;
      ctx.beginPath();
      ctx.moveTo(HUB.x + Math.cos(ta) * r1, HUB.y + Math.sin(ta) * r1);
      ctx.lineTo(HUB.x + Math.cos(ta) * r2, HUB.y + Math.sin(ta) * r2);
      ctx.strokeStyle = hexToRgba(HQ_ACCENT, major ? 0.55 : 0.22);
      ctx.lineWidth = major ? 1.4 : 0.8;
      ctx.stroke();
    }

    // radar sweep — fading trail of thin arcs, clipped to the mid ring
    if (live) {
      ctx.save();
      ctx.beginPath(); ctx.arc(HUB.x, HUB.y, HUB.r, 0, Math.PI * 2); ctx.clip();
      for (var s = 0; s < 10; s++) {
        var a0 = radarAngle - s * 0.09;
        ctx.beginPath();
        ctx.arc(HUB.x, HUB.y, HUB.r, a0 - 0.05, a0);
        ctx.strokeStyle = hexToRgba(HQ_ACCENT, 0.5 * (1 - s / 10));
        ctx.lineWidth = HUB.r;
        ctx.stroke();
      }
      ctx.restore();
    }

    // mid ring — slow counter-rotation with satellite ticks
    ctx.beginPath(); ctx.arc(HUB.x, HUB.y, HUB.r, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(HQ_ACCENT, 0.75);
    ctx.shadowColor = HQ_ACCENT; ctx.shadowBlur = 12;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    var midAngle = -frame * 0.012;
    for (var m = 0; m < 6; m++) {
      var ma = midAngle + m * (Math.PI / 3);
      ctx.save();
      ctx.translate(HUB.x + Math.cos(ma) * HUB.r, HUB.y + Math.sin(ma) * HUB.r);
      ctx.rotate(ma + Math.PI / 4);
      ctx.fillStyle = hexToRgba(HQ_ACCENT, live ? 0.85 : 0.25);
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }

    // inner ring — faster counter-rotation
    var innerR = HUB.r * 0.62;
    ctx.beginPath(); ctx.arc(HUB.x, HUB.y, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(HQ_ACCENT, 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // crosshair breaking past the bezel
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(function (ca) {
      ctx.beginPath();
      ctx.moveTo(HUB.x + Math.cos(ca) * (bezelR + 2), HUB.y + Math.sin(ca) * (bezelR + 2));
      ctx.lineTo(HUB.x + Math.cos(ca) * (bezelR + 10), HUB.y + Math.sin(ca) * (bezelR + 10));
      ctx.strokeStyle = hexToRgba(HQ_ACCENT, 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // reactor core
    var coreGrad = ctx.createRadialGradient(HUB.x, HUB.y, 0, HUB.x, HUB.y, core * 2.4);
    coreGrad.addColorStop(0, hexToRgba(HQ_ACCENT, live ? 0.85 : 0.3));
    coreGrad.addColorStop(1, hexToRgba(HQ_ACCENT, 0));
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(HUB.x, HUB.y, core * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    for (var hi = 0; hi < 6; hi++) {
      var ha = hi * (Math.PI / 3) - Math.PI / 2 + midAngle;
      var hp = { x: HUB.x + Math.cos(ha) * core, y: HUB.y + Math.sin(ha) * core };
      if (hi === 0) ctx.moveTo(hp.x, hp.y); else ctx.lineTo(hp.x, hp.y);
    }
    ctx.closePath();
    ctx.fillStyle = "#eafcff";
    ctx.fill();

    ctx.fillStyle = "#c9f7ff";
    ctx.font = "700 11px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("H · Q", HUB.x, HUB.y - bezelR - 12);
  }

  function drawEntities() {
    ALL_KEYS.forEach(function (key) {
      var e = ents[key];
      var ac = ZONE_LOG_COLOR[key] || HQ_ACCENT;
      var frozen = e.state === "never";
      var ringR = 17;
      ctx.save();
      if (frozen) ctx.globalAlpha = 0.4;

      // reticle ring: solid arc = status, dim dashed remainder = untracked
      var sweep = e.state === "ok" ? Math.PI * 1.5 : e.state === "stale" ? Math.PI * 0.7 : 0;
      if (sweep > 0) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, ringR, -Math.PI / 2, -Math.PI / 2 + sweep);
        ctx.strokeStyle = ac;
        ctx.shadowColor = ac; ctx.shadowBlur = 7;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = hexToRgba(ac, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // rotating corner brackets — lock-on indicator
      var bAngle = frozen ? 0 : frame * (e.state === "ok" ? 0.02 : 0.008);
      for (var c = 0; c < 4; c++) {
        var ca = bAngle + c * (Math.PI / 2);
        ctx.save();
        ctx.translate(e.x + Math.cos(ca) * ringR, e.y + Math.sin(ca) * ringR);
        ctx.rotate(ca);
        ctx.strokeStyle = hexToRgba(ac, 0.8);
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(0, -4); ctx.moveTo(-4, -4); ctx.lineTo(-4, 0);
        ctx.stroke();
        ctx.restore();
      }

      ctx.font = "22px " + EMOJI_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (frozen) ctx.filter = "grayscale(1)";
      ctx.fillText(AGENT_SPRITES[key], e.x, e.y);
      ctx.filter = "none";

      // projection beam base instead of a cartoon shadow
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + ringR);
      ctx.lineTo(e.x, e.y + ringR + 8);
      ctx.strokeStyle = hexToRgba(ac, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x - 5, e.y + ringR + 8); ctx.lineTo(e.x, e.y + ringR + 4); ctx.lineTo(e.x + 5, e.y + ringR + 8);
      ctx.strokeStyle = hexToRgba(ac, 0.55);
      ctx.stroke();

      ctx.font = "600 9px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#c9d3ff";
      ctx.fillText(AGENT_LABELS[key] || key, e.x, e.y + ringR + 21);
      ctx.restore();
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawConnectors();
    drawZones();
    drawParticles();
    drawPulses();
    drawHub();
    drawEntities();
    drawPulseStrip();
  }

  function tick() {
    frame++;
    radarAngle = (radarAngle + 0.045) % (Math.PI * 2);
    stepEntities();
    stepParticles();
    stepPulses();
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
    ALL_KEYS.forEach(function (key) { ents[key].state = agentState(agents[key]); });
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
    fetchJSON(DATA_FILES.goals).catch(function () { return null; }),
    fetchJSON(DATA_FILES.activity).catch(function () { return null; })
  ]).then(function (results) {
    renderStatus(results[0]);
    renderHud(results[0], results[1], results[2], results[3], results[4]);
    Scene.update(results[0], results[1], results[2], results[3], results[4]);
    Ticker.update(buildTickerLines(results[0]));
    renderBugs(results[1]);
    renderYoutube(results[2]);
    renderLeads(results[3]);
    renderGoals(results[4]);
    renderActivityLog(results[5]);
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

var Ticker = (function () {
  var el, lines = ["booting mission control"], idx = 0, timer = null;
  function render() {
    if (!el) el = document.getElementById("terminal-ticker");
    if (!el || !lines.length) return;
    el.textContent = "> " + lines[idx % lines.length];
  }
  function update(newLines) {
    lines = newLines.length ? newLines : ["standing by — no agents have run yet"];
    idx = 0;
    render();
    if (!timer) timer = setInterval(function () { idx++; render(); }, 4000);
  }
  return { update: update };
})();

function buildTickerLines(statusData) {
  // Plain text only — Ticker.render() assigns via textContent, so no HTML escaping needed here.
  var agents = (statusData && statusData.agents) || {};
  var lines = [];
  AGENT_ORDER.forEach(function (key) {
    var a = agents[key];
    if (a && a.last_run) {
      lines.push(AGENT_LABELS[key] + ": " + (a.summary || "ran") + " (" + timeAgo(a.last_run) + ")");
      (a.flags || []).forEach(function (f) { lines.push("ALERT — " + AGENT_LABELS[key] + ": " + f); });
    }
  });
  return lines;
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

function renderObjective(g) {
  var pct = Math.max(0, Math.min(100, g.progress_pct || 0));
  var steps = (g.steps || []).map(function (s) {
    return '<li class="' + (s.done ? "step-done" : "") + '">' + (s.done ? "☑" : "☐") + " " + esc(s.text) + "</li>";
  }).join("");
  return '<div class="stack-item">' +
    '<div class="item-top"><span class="item-title">' + esc(g.title) +
    '</span><span class="pill">' + esc(g.status || "") + "</span></div>" +
    (g.description ? '<div class="item-body">' + esc(g.description) + "</div>" : "") +
    '<div class="goal-progress-track"><div class="goal-progress-fill" style="width:' + pct + '%"></div></div>' +
    (steps ? '<ul class="step-list">' + steps + "</ul>" : "") +
  "</div>";
}

function renderGoals(data) {
  var el = document.getElementById("goals-list");
  var horizons = (data && data.horizons) || {};
  el.innerHTML = HORIZON_ORDER.map(function (h) {
    var horizon = horizons[h] || { label: h, objectives: [] };
    var objs = horizon.objectives || [];
    var body = objs.length ? objs.map(renderObjective).join("") : emptyState("No " + (horizon.label || h).toLowerCase() + " goals set yet.");
    return '<div class="horizon-panel" data-horizon="' + h + '"' + (h === "day" ? "" : ' hidden') + '>' + body + "</div>";
  }).join("");

  var buttons = document.querySelectorAll("[data-goal-horizon]");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var horizon = btn.getAttribute("data-goal-horizon");
      el.querySelectorAll(".horizon-panel").forEach(function (p) {
        p.hidden = p.getAttribute("data-horizon") !== horizon;
      });
    });
  });
}

function renderActivityLog(data) {
  var el = document.getElementById("activity-log");
  var entries = ((data && data.entries) || []).slice().sort(function (a, b) {
    return new Date(b.ts).getTime() - new Date(a.ts).getTime();
  });
  var activeBtn = document.querySelector("[data-log-filter].active");
  renderLogEntries(entries, activeBtn ? activeBtn.getAttribute("data-log-filter") : "all");

  var buttons = document.querySelectorAll("[data-log-filter]");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      renderLogEntries(entries, btn.getAttribute("data-log-filter"));
    });
  });
}

function renderLogEntries(entries, filter) {
  var el = document.getElementById("activity-log");
  var filtered = (filter && filter !== "all") ? entries.filter(function (e) { return e.agent === filter; }) : entries;
  if (!filtered.length) { el.innerHTML = emptyState("No activity logged yet."); return; }
  el.innerHTML = filtered.slice(0, 80).map(function (e) {
    var icon = e.type === "next" ? "⏳" : "✅";
    return '<div class="log-line">' +
      '<span class="log-ts">' + esc(timeAgo(e.ts)) + "</span>" +
      '<span class="log-agent" style="color:' + esc(ZONE_LOG_COLOR[e.agent] || "#7ef7ff") + '">' + esc(AGENT_LABELS[e.agent] || e.agent) + "</span>" +
      "<span>" + icon + " " + esc(e.text) + "</span>" +
    "</div>";
  }).join("");
}
