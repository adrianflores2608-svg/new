// --- Intro foam-cannon animation ---------------------------------------
(function () {
  var intro = document.getElementById("intro");
  if (!intro) return;
  var skip = document.getElementById("skip-intro");
  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.classList.add("intro-lock");

  function endIntro() {
    intro.classList.add("done");
    document.body.classList.remove("intro-lock");
  }

  // CSS fades the overlay out at ~3s; remove it from the layout just after.
  var timer = setTimeout(endIntro, reduce ? 600 : 3700);

  if (skip) {
    skip.addEventListener("click", function () {
      clearTimeout(timer);
      endIntro();
    });
  }
})();

// --- Scroll reveal ------------------------------------------------------
(function () {
  var els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) {
    for (var i = 0; i < els.length; i++) els[i].classList.add("in");
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  els.forEach(function (el) { io.observe(el); });
})();

// --- Config -------------------------------------------------------------
// Change this to the email address where you want booking requests sent.
var OWNER_EMAIL = "adrian.flores2608@gmail.com";

// --- Elements -----------------------------------------------------------
var form = document.getElementById("booking-form");
var totalEl = document.getElementById("total");
var quoteNote = document.getElementById("quote-note");
var oilStain = document.getElementById("oil-stain");
var errorEl = document.getElementById("form-error");
var confirmationEl = document.getElementById("confirmation");
var confirmationText = document.getElementById("confirmation-text");
var bookAnotherBtn = document.getElementById("book-another");

document.getElementById("year").textContent = new Date().getFullYear();

// Prevent picking a date in the past.
var dateInput = document.getElementById("date");
dateInput.min = new Date().toISOString().split("T")[0];

// --- Pricing ------------------------------------------------------------
function selectedServices() {
  var result = { items: [], total: 0, needsQuote: false };
  var selects = form.querySelectorAll("select[data-svc]");

  for (var i = 0; i < selects.length; i++) {
    var sel = selects[i];
    var opt = sel.options[sel.selectedIndex];
    if (!opt || opt.value === "") continue;

    var label = sel.getAttribute("data-svc") + ": " + opt.text.trim();
    if (opt.getAttribute("data-quote") === "1") {
      result.needsQuote = true;
      result.items.push({ label: label, amount: null });
    } else {
      var price = parseInt(opt.getAttribute("data-price"), 10) || 0;
      result.total += price;
      result.items.push({ label: label, amount: price });
    }
  }

  if (oilStain.checked) {
    var add = parseInt(oilStain.getAttribute("data-price"), 10) || 0;
    result.total += add;
    result.items.push({ label: "Add-on: Oil Stain Treatment", amount: add });
  }

  return result;
}

function calcTotal() {
  var r = selectedServices();
  totalEl.textContent = "$" + r.total + (r.needsQuote ? " + free quote" : "");
  quoteNote.hidden = !r.needsQuote;
  return r;
}

form.addEventListener("change", calcTotal);
form.addEventListener("input", calcTotal);

// --- Submit -------------------------------------------------------------
form.addEventListener("submit", function (e) {
  e.preventDefault();
  errorEl.hidden = true;

  var r = selectedServices();
  if (r.items.length === 0) {
    errorEl.textContent = "Please select at least one service.";
    errorEl.hidden = false;
    return;
  }
  if (!form.checkValidity()) {
    errorEl.textContent = "Please fill in all required fields.";
    errorEl.hidden = false;
    form.reportValidity();
    return;
  }

  var el = form.elements;
  var data = {
    name: el["name"].value.trim(),
    phone: el["phone"].value.trim(),
    email: el["email"].value.trim(),
    address: el["address"].value.trim(),
    date: el["date"].value,
    time: el["time"].value,
    notes: el["notes"].value.trim()
  };

  var lines = [];
  lines.push("New Pressure Washing Booking");
  lines.push("============================");
  lines.push("");
  lines.push("Services:");
  for (var i = 0; i < r.items.length; i++) {
    var amt = r.items[i].amount === null ? "Free quote" : "$" + r.items[i].amount;
    lines.push("  - " + r.items[i].label + ": " + amt);
  }
  lines.push("");
  lines.push("Estimated total: $" + r.total + (r.needsQuote ? " + free quote" : ""));
  lines.push("");
  lines.push("Date: " + data.date);
  lines.push("Time: " + data.time);
  lines.push("");
  lines.push("Name: " + data.name);
  lines.push("Phone: " + data.phone);
  lines.push("Email: " + data.email);
  lines.push("Address: " + data.address);
  lines.push("Notes: " + (data.notes || "(none)"));

  var subject = "Booking: " + data.name + " - " + data.date;
  var body = lines.join("\n");
  var mailto =
    "mailto:" + OWNER_EMAIL +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body);

  // Open the customer's email client with the booking pre-filled.
  window.location.href = mailto;

  form.hidden = true;
  confirmationText.textContent =
    "Thanks, " + data.name + "! Your request for " + data.date + " at " +
    data.time + " (estimated $" + r.total +
    (r.needsQuote ? " + free quote" : "") +
    ") is ready in your email app. Press send to finish, and we'll text you to confirm.";
  confirmationEl.hidden = false;
  confirmationEl.scrollIntoView({ behavior: "smooth" });
});

bookAnotherBtn.addEventListener("click", function () {
  form.reset();
  calcTotal();
  confirmationEl.hidden = true;
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth" });
});

calcTotal();
