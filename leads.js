// ============================================================================
// Prestige Power Washing — Lead & Job Manager
//
// This is a client-side-only tool: all lead data lives in this browser's
// localStorage. Nothing is uploaded anywhere. That means:
//   - Data does NOT sync between your phone and laptop unless you export/
//     import a backup between them.
//   - Clearing browser data / a new browser / incognito mode = empty list.
//     Use "Export Backup" regularly (weekly is a good habit).
//   - The PIN below is a light deterrent, NOT real security — this file is
//     part of a public GitHub repo, so anyone could read the PIN in source.
//     CHANGE THE DEFAULT PIN, but don't treat this page as a secure vault.
// ============================================================================

var DASH_PIN = "2608"; // <-- change me

var OWNER_NAME = "Adrian";
var OWNER_PHONE_DISPLAY = "(956) 202-2106";
var OWNER_PHONE_TEL = "+19562022106";
var OWNER_EMAIL = "adrian.flores2608@gmail.com";
var BUSINESS_NAME = "Prestige Power Washing";
var GOOGLE_REVIEW_LINK = ""; // paste your Google review link here once you have one

var STORAGE_KEY = "ppw_leads_v1";

var STATUSES = ["new", "contacted", "quoted", "scheduled", "completed", "paid", "lost"];
var STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  scheduled: "Scheduled",
  completed: "Completed",
  paid: "Paid",
  lost: "Lost"
};

// ---------------------------------------------------------------------------
// Lock screen
// ---------------------------------------------------------------------------
(function () {
  var pinInput = document.getElementById("pin-input");
  var unlockBtn = document.getElementById("unlock-btn");
  var pinError = document.getElementById("pin-error");
  var lockBtn = document.getElementById("lock-btn");

  function tryUnlock() {
    if (pinInput.value === DASH_PIN) {
      try { sessionStorage.setItem("ppw_leads_unlocked", "1"); } catch (e) {}
      document.documentElement.classList.add("unlocked");
      pinError.hidden = true;
      render();
    } else {
      pinError.hidden = false;
    }
  }

  unlockBtn.addEventListener("click", tryUnlock);
  pinInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryUnlock();
  });

  if (lockBtn) {
    lockBtn.addEventListener("click", function () {
      try { sessionStorage.removeItem("ppw_leads_unlocked"); } catch (e) {}
      document.documentElement.classList.remove("unlocked");
    });
  }
})();

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
function loadLeads() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLeads(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

var leads = loadLeads();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function daysSince(iso) {
  if (!iso) return null;
  var ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

function needsFollowUp(lead) {
  if (["completed", "paid", "lost"].indexOf(lead.status) !== -1) return false;
  var lastTouch = lead.lastContactedAt || lead.createdAt;
  var d = daysSince(lastTouch);
  return d !== null && d >= 2;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
function buildTemplate(key, lead) {
  var service = lead.service || "your service";
  var name = lead.name || "there";
  var addr = lead.address ? " at " + lead.address : "";

  var templates = {
    quote_followup: {
      subject: "Your " + service + " Quote from " + BUSINESS_NAME,
      body:
        "Hi " + name + ",\n\n" +
        "Thanks for reaching out to " + BUSINESS_NAME + "! Following up on your request for " +
        service + addr + ".\n\n" +
        "We'd love to get you on the schedule — just reply with a date/time that works, " +
        "or text/call us at " + OWNER_PHONE_DISPLAY + " for the fastest response.\n\n" +
        "Thanks,\n" + OWNER_NAME + "\n" + BUSINESS_NAME + "\n" + OWNER_PHONE_DISPLAY
    },
    still_interested: {
      subject: "Still interested in your " + service + "?",
      body:
        "Hi " + name + ",\n\n" +
        "Just checking in — are you still interested in getting your " + service +
        " taken care of? We still have openings this week and would love to get it on the books.\n\n" +
        "Reply here or text us at " + OWNER_PHONE_DISPLAY + " and we'll get it scheduled.\n\n" +
        "Thanks,\n" + OWNER_NAME + "\n" + BUSINESS_NAME
    },
    appointment_reminder: {
      subject: "Reminder: your appointment with " + BUSINESS_NAME,
      body:
        "Hi " + name + ",\n\n" +
        "Just a friendly reminder about your upcoming " + service + " appointment" + addr + ".\n\n" +
        "If anything's changed or you need to reschedule, text us at " + OWNER_PHONE_DISPLAY + ".\n\n" +
        "See you soon!\n" + OWNER_NAME + "\n" + BUSINESS_NAME
    },
    review_request: {
      subject: "Thanks for choosing " + BUSINESS_NAME + "!",
      body:
        "Hi " + name + ",\n\n" +
        "Thanks so much for trusting us with your " + service + "! We hope you love the results.\n\n" +
        (GOOGLE_REVIEW_LINK
          ? "If you have 30 seconds, a quick review would mean a lot to us: " + GOOGLE_REVIEW_LINK + "\n\n"
          : "If you have 30 seconds, a quick Google review would mean a lot to us!\n\n") +
        "Also — refer a neighbor and you'll both save on your next service. Just have them mention your name.\n\n" +
        "Thanks again,\n" + OWNER_NAME + "\n" + BUSINESS_NAME + "\n" + OWNER_PHONE_DISPLAY
    },
    commercial_proposal: {
      subject: "Pressure Washing Proposal for " + name,
      body:
        "Hi " + name + ",\n\n" +
        "Thanks for the opportunity to bid on pressure washing services" + addr + ".\n\n" +
        "We offer flexible monthly and quarterly plans for parking lots, sidewalks, storefronts, " +
        "dumpster pads, and common areas, and we're fully licensed and insured " +
        "(certificate of insurance available on request).\n\n" +
        "I'd love to set up a quick walkthrough so we can put together an exact quote — " +
        "what day works for you this week?\n\n" +
        "Best,\n" + OWNER_NAME + "\n" + BUSINESS_NAME + "\n" + OWNER_PHONE_DISPLAY + "\n" + OWNER_EMAIL
    },
    custom: { subject: "", body: "" }
  };

  return templates[key] || templates.custom;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
var state = { statusFilter: "all", typeFilter: "all", search: "" };

function renderStats() {
  var el = document.getElementById("stats");
  var active = leads.filter(function (l) { return l.status !== "lost"; });
  var followUps = leads.filter(needsFollowUp);
  var commercial = leads.filter(function (l) { return l.type === "commercial"; });
  var monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  var thisMonth = leads.filter(function (l) { return new Date(l.createdAt) >= monthStart; });

  var boxes = [
    { n: leads.length, label: "Total Leads" },
    { n: active.filter(function (l) { return l.status === "new"; }).length, label: "New" },
    { n: followUps.length, label: "Needs Follow-up", warn: true },
    { n: active.filter(function (l) { return l.status === "quoted"; }).length, label: "Quoted" },
    { n: active.filter(function (l) { return l.status === "scheduled"; }).length, label: "Scheduled" },
    { n: active.filter(function (l) { return l.status === "completed" || l.status === "paid"; }).length, label: "Completed" },
    { n: commercial.length, label: "Commercial" },
    { n: thisMonth.length, label: "This Month" }
  ];

  el.innerHTML = boxes.map(function (b) {
    return '<div class="stat-box' + (b.warn && b.n > 0 ? " warn" : "") + '"><strong>' + b.n +
      "</strong><span>" + b.label + "</span></div>";
  }).join("");
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function renderList() {
  var container = document.getElementById("lead-list");
  var filtered = leads.filter(function (l) {
    if (state.statusFilter === "followup") return needsFollowUp(l);
    if (state.statusFilter !== "all" && l.status !== state.statusFilter) return false;
    if (state.typeFilter !== "all" && l.type !== state.typeFilter) return false;
    if (state.search) {
      var hay = [l.name, l.phone, l.email, l.address, l.notes].join(" ").toLowerCase();
      if (hay.indexOf(state.search.toLowerCase()) === -1) return false;
    }
    return true;
  });

  filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">No leads match this filter yet.</p>';
    return;
  }

  container.innerHTML = filtered.map(function (l) {
    var created = daysSince(l.createdAt);
    var lastTouch = l.lastContactedAt
      ? daysSince(l.lastContactedAt) + " day(s) ago"
      : "never";
    var followup = needsFollowUp(l);

    var contactLinks = [];
    if (l.phone) {
      contactLinks.push('<a href="tel:' + escapeHtml(l.phone) + '">Call</a>');
      contactLinks.push('<a href="sms:' + escapeHtml(l.phone) + '">Text</a>');
    }
    if (l.email) contactLinks.push('<a href="mailto:' + escapeHtml(l.email) + '">' + escapeHtml(l.email) + "</a>");

    var statusOptions = STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === l.status ? " selected" : "") + '>' + STATUS_LABELS[s] + "</option>";
    }).join("");

    return (
      '<div class="lead-card status-' + l.status + '" data-id="' + l.id + '">' +
        '<div class="lead-top">' +
          '<div><span class="lead-name">' + escapeHtml(l.name) + '</span>' +
            (l.type === "commercial" ? '<span class="pill commercial">Commercial</span>' : "") +
            (followup ? '<span class="pill followup">Needs Follow-up</span>' : "") +
          '</div>' +
          '<div class="lead-meta">Added ' + (created === 0 ? "today" : created + "d ago") + '</div>' +
        '</div>' +
        '<div class="lead-meta">' +
          (l.service ? escapeHtml(l.service) + " &middot; " : "") +
          (l.address ? escapeHtml(l.address) + " &middot; " : "") +
          (l.source ? "via " + escapeHtml(l.source) + " &middot; " : "") +
          "Last contacted: " + lastTouch +
        '</div>' +
        '<div class="lead-meta">' + contactLinks.join(" &middot; ") + '</div>' +
        (l.notes ? '<div class="lead-notes">' + escapeHtml(l.notes) + '</div>' : "") +
        '<div class="lead-actions">' +
          '<select class="status-select" data-id="' + l.id + '">' + statusOptions + '</select>' +
          '<button class="btn btn-sm-outline email-btn" data-id="' + l.id + '"' + (l.email ? "" : " disabled") + '>Email</button>' +
          '<button class="btn btn-sm-outline edit-btn" data-id="' + l.id + '">Edit</button>' +
          '<button class="btn btn-danger delete-btn" data-id="' + l.id + '">Delete</button>' +
        '</div>' +
      '</div>'
    );
  }).join("");
}

function render() {
  renderStats();
  renderList();
}

// ---------------------------------------------------------------------------
// Quick add / edit form
// ---------------------------------------------------------------------------
var form = document.getElementById("lead-form");
var editingId = null;
var formTitle = document.getElementById("form-title");
var cancelEditBtn = document.getElementById("cancel-edit-btn");

form.addEventListener("submit", function (e) {
  e.preventDefault();
  var el = form.elements;
  var data = {
    name: el["name"].value.trim(),
    phone: el["phone"].value.trim(),
    email: el["email"].value.trim(),
    address: el["address"].value.trim(),
    type: el["type"].value,
    service: el["service"].value.trim(),
    source: el["source"].value,
    notes: el["notes"].value.trim()
  };
  if (!data.name) return;

  if (editingId) {
    leads = leads.map(function (l) {
      if (l.id !== editingId) return l;
      return Object.assign({}, l, data);
    });
    editingId = null;
    formTitle.textContent = "Quick Add Lead";
    cancelEditBtn.hidden = true;
  } else {
    data.id = uid();
    data.status = "new";
    data.createdAt = new Date().toISOString();
    data.lastContactedAt = null;
    leads.push(data);
  }

  saveLeads(leads);
  form.reset();
  render();
});

cancelEditBtn.addEventListener("click", function () {
  editingId = null;
  formTitle.textContent = "Quick Add Lead";
  cancelEditBtn.hidden = true;
  form.reset();
});

// ---------------------------------------------------------------------------
// List interactions (event delegation)
// ---------------------------------------------------------------------------
document.getElementById("lead-list").addEventListener("change", function (e) {
  if (!e.target.classList.contains("status-select")) return;
  var id = e.target.getAttribute("data-id");
  leads = leads.map(function (l) {
    if (l.id !== id) return l;
    return Object.assign({}, l, { status: e.target.value });
  });
  saveLeads(leads);
  render();
});

document.getElementById("lead-list").addEventListener("click", function (e) {
  var id = e.target.getAttribute("data-id");
  if (!id) return;

  if (e.target.classList.contains("delete-btn")) {
    var lead = leads.filter(function (l) { return l.id === id; })[0];
    if (lead && confirm("Delete lead for " + lead.name + "? This can't be undone.")) {
      leads = leads.filter(function (l) { return l.id !== id; });
      saveLeads(leads);
      render();
    }
  }

  if (e.target.classList.contains("edit-btn")) {
    var l2 = leads.filter(function (l) { return l.id === id; })[0];
    if (!l2) return;
    editingId = id;
    formTitle.textContent = "Edit Lead";
    cancelEditBtn.hidden = false;
    var el = form.elements;
    el["name"].value = l2.name || "";
    el["phone"].value = l2.phone || "";
    el["email"].value = l2.email || "";
    el["address"].value = l2.address || "";
    el["type"].value = l2.type || "residential";
    el["service"].value = l2.service || "";
    el["source"].value = l2.source || "";
    el["notes"].value = l2.notes || "";
    form.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.classList.contains("email-btn")) {
    openEmailModal(id);
  }
});

// ---------------------------------------------------------------------------
// Email modal
// ---------------------------------------------------------------------------
var modal = document.getElementById("email-modal");
var templateSelect = document.getElementById("template-select");
var subjectInput = document.getElementById("email-subject");
var bodyInput = document.getElementById("email-body");
var sendBtn = document.getElementById("send-email-btn");
var cancelModalBtn = document.getElementById("cancel-email-btn");
var currentLeadId = null;

function openEmailModal(id) {
  var lead = leads.filter(function (l) { return l.id === id; })[0];
  if (!lead) return;
  currentLeadId = id;
  var defaultKey = lead.type === "commercial" ? "commercial_proposal" : "quote_followup";
  templateSelect.value = defaultKey;
  applyTemplate();
  modal.hidden = false;
}

function applyTemplate() {
  var lead = leads.filter(function (l) { return l.id === currentLeadId; })[0];
  if (!lead) return;
  var t = buildTemplate(templateSelect.value, lead);
  subjectInput.value = t.subject;
  bodyInput.value = t.body;
}

templateSelect.addEventListener("change", applyTemplate);

cancelModalBtn.addEventListener("click", function () {
  modal.hidden = true;
  currentLeadId = null;
});

sendBtn.addEventListener("click", function () {
  var lead = leads.filter(function (l) { return l.id === currentLeadId; })[0];
  if (!lead) return;
  var mailto = "mailto:" + encodeURIComponent(lead.email) +
    "?subject=" + encodeURIComponent(subjectInput.value) +
    "&body=" + encodeURIComponent(bodyInput.value);
  window.location.href = mailto;

  leads = leads.map(function (l) {
    if (l.id !== currentLeadId) return l;
    var updated = Object.assign({}, l, { lastContactedAt: new Date().toISOString() });
    if (updated.status === "new") updated.status = "contacted";
    return updated;
  });
  saveLeads(leads);
  modal.hidden = true;
  currentLeadId = null;
  render();
});

// ---------------------------------------------------------------------------
// Toolbar: filters + search
// ---------------------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    state.statusFilter = btn.getAttribute("data-status");
    render();
  });
});

document.getElementById("type-filter").addEventListener("change", function (e) {
  state.typeFilter = e.target.value;
  render();
});

document.getElementById("search-input").addEventListener("input", function (e) {
  state.search = e.target.value;
  render();
});

// ---------------------------------------------------------------------------
// Backup: export / import
// ---------------------------------------------------------------------------
document.getElementById("export-btn").addEventListener("click", function () {
  var blob = new Blob([JSON.stringify(leads, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "ppw-leads-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-input").addEventListener("change", function (e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Invalid file");
      var existingIds = {};
      leads.forEach(function (l) { existingIds[l.id] = true; });
      imported.forEach(function (l) {
        if (l && l.id && !existingIds[l.id]) leads.push(l);
      });
      saveLeads(leads);
      render();
      alert("Imported " + imported.length + " lead(s) (duplicates skipped).");
    } catch (err) {
      alert("Couldn't read that file — make sure it's a backup exported from this page.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ---------------------------------------------------------------------------
render();
