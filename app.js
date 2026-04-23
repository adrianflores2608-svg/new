/* ============================================================
   ELITE CUTS BARBERSHOP — Main JS
   ============================================================ */

// ── Navbar scroll effect ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Hamburger menu ──
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', navLinks.classList.contains('open'));
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Set minimum booking date to today ──
const dateInput = document.getElementById('apptDate');
if (dateInput) {
  const today = new Date();
  // Don't allow Sunday (0) or Monday (1)
  const dayOfWeek = today.getDay();
  const minDate = new Date(today);
  if (dayOfWeek === 0) minDate.setDate(minDate.getDate() + 2);
  else if (dayOfWeek === 1) minDate.setDate(minDate.getDate() + 1);
  dateInput.min = minDate.toISOString().split('T')[0];

  // Block Sundays and Mondays
  dateInput.addEventListener('input', () => {
    const chosen = new Date(dateInput.value + 'T00:00:00');
    const d = chosen.getDay();
    if (d === 0 || d === 1) {
      showFieldError('apptDate', 'We are closed Sunday & Monday. Please pick Tue–Sat.');
      dateInput.value = '';
    } else {
      clearFieldError('apptDate');
    }
  });
}

// ── Scroll fade animations ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll(
  '.feature-card, .service-card, .review-card, .gallery-item, .contact-item'
).forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// ── Booking Form Validation ──
const form = document.getElementById('bookingForm');
const successPanel = document.getElementById('bookingSuccess');

function showFieldError(fieldId, message) {
  const errEl = document.getElementById(fieldId + 'Error');
  const inputEl = document.getElementById(fieldId);
  if (errEl) errEl.textContent = message;
  if (inputEl) inputEl.classList.add('invalid');
}
function clearFieldError(fieldId) {
  const errEl = document.getElementById(fieldId + 'Error');
  const inputEl = document.getElementById(fieldId);
  if (errEl) errEl.textContent = '';
  if (inputEl) inputEl.classList.remove('invalid');
}
function clearAllErrors() {
  ['firstName','lastName','phone','email','service','apptDate','apptTime','smsConsent','policyConsent']
    .forEach(clearFieldError);
}

function validatePhone(phone) {
  return /^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/.test(phone.replace(/\s/g,''));
}
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

form && form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearAllErrors();

  const firstName     = document.getElementById('firstName').value.trim();
  const lastName      = document.getElementById('lastName').value.trim();
  const phone         = document.getElementById('phone').value.trim();
  const email         = document.getElementById('email').value.trim();
  const service       = document.getElementById('service').value;
  const apptDate      = document.getElementById('apptDate').value;
  const apptTime      = document.getElementById('apptTime').value;
  const smsConsent    = document.getElementById('smsConsent').checked;
  const policyConsent = document.getElementById('policyConsent').checked;

  let valid = true;

  if (!firstName) { showFieldError('firstName', 'First name is required.'); valid = false; }
  if (!lastName)  { showFieldError('lastName', 'Last name is required.');   valid = false; }
  if (!phone) {
    showFieldError('phone', 'Phone number is required.'); valid = false;
  } else if (!validatePhone(phone)) {
    showFieldError('phone', 'Enter a valid 10-digit phone number.'); valid = false;
  }
  if (!email) {
    showFieldError('email', 'Email is required.'); valid = false;
  } else if (!validateEmail(email)) {
    showFieldError('email', 'Enter a valid email address.'); valid = false;
  }
  if (!service)   { showFieldError('service', 'Please select a service.');    valid = false; }
  if (!apptDate)  { showFieldError('apptDate', 'Please pick a date.');        valid = false; }
  if (!apptTime)  { showFieldError('apptTime', 'Please pick a time.');        valid = false; }
  if (!smsConsent) {
    showFieldError('smsConsent', 'You must agree to receive text reminders.'); valid = false;
  }
  if (!policyConsent) {
    showFieldError('policyConsent', 'Please acknowledge our no-show policy.'); valid = false;
  }

  if (!valid) {
    form.querySelector('.invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  submitBooking({ firstName, lastName, phone, email, service, apptDate, apptTime });
});

function submitBooking(data) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Booking...';

  // Simulate async API call (replace with real backend integration)
  setTimeout(() => {
    const serviceLabel = document.getElementById('service').selectedOptions[0].text;
    const dateFormatted = new Date(data.apptDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const details = document.getElementById('successDetails');
    details.innerHTML = `
      <strong>${data.firstName} ${data.lastName}</strong>, your appointment is confirmed!<br/>
      <span style="color:#c9a84c">&#128336; ${dateFormatted} at ${data.apptTime}</span><br/>
      <span>${serviceLabel}</span>
    `;

    form.style.display = 'none';
    successPanel.style.display = 'block';
    successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Simulated reminder system output
    scheduleReminders(data);
  }, 1200);
}

function scheduleReminders(data) {
  // In production, this is handled server-side via Twilio / SendGrid etc.
  // Here we log the actions that would be triggered.
  const confirmPayload = {
    to: data.phone,
    message: `Hi ${data.firstName}! Your appointment at Notorious Cutz on ${data.apptDate} at ${data.apptTime} is confirmed. Reply CANCEL to cancel (must be 2+ hrs before). (956) 873-2957`
  };
  const reminder24Payload = {
    to: data.phone,
    message: `Reminder: You have an appointment at Notorious Cutz tomorrow at ${data.apptTime}. Need to cancel? Call (956) 873-2957 at least 2 hrs before.`
  };
  const reminder2hPayload = {
    to: data.phone,
    message: `Your Notorious Cutz appointment is in 2 hours (${data.apptTime})! See you soon. Call (956) 873-2957 if you need to reschedule.`
  };

  console.info('[Notorious Cutz] SMS Confirmation queued:', confirmPayload);
  console.info('[Notorious Cutz] 24-hr Reminder queued:', reminder24Payload);
  console.info('[Notorious Cutz] 2-hr Reminder queued:', reminder2hPayload);
  console.info('[Notorious Cutz] Email confirmation queued to:', data.email);
}

function resetForm() {
  form.reset();
  form.style.display = 'block';
  successPanel.style.display = 'none';
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('submitBtn').textContent = 'Confirm Appointment';
  clearAllErrors();
  document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
}

// Expose globally for inline onclick
window.resetForm = resetForm;

// ── Smooth active nav highlight ──
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navItems.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? 'var(--gold)' : '';
  });
}, { passive: true });
