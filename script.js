// --- Config -------------------------------------------------------------
// Change this to the email address where you want booking requests sent.
var OWNER_EMAIL = "adrian.flores2608@gmail.com";

// --- Elements -----------------------------------------------------------
var form = document.getElementById("booking-form");
var totalEl = document.getElementById("total");
var trashToggle = document.getElementById("trash-toggle");
var trashQty = document.getElementById("trash-qty");
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
  var items = [];
  var boxes = form.querySelectorAll('input[type="checkbox"][data-price]');
  for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i];
    if (!box.checked) continue;
    var price = parseInt(box.getAttribute("data-price"), 10);
    if (box.name === "trashcan") {
      var qty = Math.max(1, parseInt(trashQty.value, 10) || 1);
      items.push({ label: "Trash Cans x" + qty, amount: price * qty });
    } else {
      var label = box.name.charAt(0).toUpperCase() + box.name.slice(1);
      items.push({ label: label, amount: price });
    }
  }
  return items;
}

function calcTotal() {
  var items = selectedServices();
  var sum = 0;
  for (var i = 0; i < items.length; i++) sum += items[i].amount;
  totalEl.textContent = "$" + sum;
  return sum;
}

form.addEventListener("change", calcTotal);
form.addEventListener("input", calcTotal);

trashToggle.addEventListener("change", function () {
  trashQty.disabled = !trashToggle.checked;
  if (trashToggle.checked) trashQty.focus();
  calcTotal();
});

// --- Submit -------------------------------------------------------------
form.addEventListener("submit", function (e) {
  e.preventDefault();
  errorEl.hidden = true;

  var items = selectedServices();
  if (items.length === 0) {
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
  var total = calcTotal();

  var lines = [];
  lines.push("New Pressure Washing Booking");
  lines.push("============================");
  lines.push("");
  lines.push("Services:");
  for (var i = 0; i < items.length; i++) {
    lines.push("  - " + items[i].label + ": $" + items[i].amount);
  }
  lines.push("");
  lines.push("Estimated total: $" + total);
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
    data.time + " (estimated $" + total + ") is ready in your email app. " +
    "Press send to finish, and we'll text you to confirm.";
  confirmationEl.hidden = false;
  confirmationEl.scrollIntoView({ behavior: "smooth" });
});

bookAnotherBtn.addEventListener("click", function () {
  form.reset();
  trashQty.disabled = true;
  calcTotal();
  confirmationEl.hidden = true;
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth" });
});

calcTotal();
