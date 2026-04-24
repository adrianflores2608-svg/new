'use strict';

/* ── Navbar scroll ── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* ── Mobile burger ── */
const burger   = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');

burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('mobile-open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
});

// Close on link click
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('mobile-open');
    burger.classList.remove('open');
  });
});

// Close on outside click
document.addEventListener('click', e => {
  if (!navbar.contains(e.target)) {
    navLinks.classList.remove('mobile-open');
    burger.classList.remove('open');
  }
});

/* ── Scroll-in animation ── */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const delay = Number(el.dataset.delay || 0);
    setTimeout(() => el.classList.add('visible'), delay);
    observer.unobserve(el);
  });
}, { threshold: 0.1 });

document.querySelectorAll('.svc-card').forEach(el => observer.observe(el));

/* ── Date picker setup ── */
const dateInput = document.getElementById('date');
const timeSelect = document.getElementById('time');
const dateHint   = document.getElementById('dateHint');

// Min date = today
const today = new Date();
const todayStr = today.toISOString().split('T')[0];
dateInput.setAttribute('min', todayStr);

const TUE_TO_SAT_TIMES = [
  '9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
  '12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM',
  '2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM',
  '5:00 PM','5:30 PM'
];
const SUNDAY_TIMES = ['11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM'];

function buildTimeOptions(times) {
  timeSelect.innerHTML = '<option value="" disabled selected>Choose a time…</option>';
  times.forEach(t => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = t;
    timeSelect.appendChild(opt);
  });
}

function handleDateChange() {
  if (!dateInput.value) return;
  const d = new Date(dateInput.value + 'T12:00:00');
  const day = d.getDay(); // 0=Sun,1=Mon

  dateHint.textContent = '';
  timeSelect.value = '';

  if (day === 1) {
    dateHint.textContent = 'We are closed on Mondays. Please pick another day.';
    dateInput.value = '';
    buildTimeOptions([]);
    return;
  }

  if (day === 0) {
    dateHint.textContent = 'Sunday hours: 11:30 AM – 2:00 PM';
    buildTimeOptions(SUNDAY_TIMES);
  } else {
    buildTimeOptions(TUE_TO_SAT_TIMES);
  }
}

dateInput.addEventListener('change', handleDateChange);
buildTimeOptions(TUE_TO_SAT_TIMES); // default

/* ── Booking form submission ── */
const form        = document.getElementById('bookingForm');
const submitBtn   = document.getElementById('submitBtn');
const submitText  = document.getElementById('submitText');
const submitSpinner = document.getElementById('submitSpinner');
const formSuccess = document.getElementById('formSuccess');
const formError   = document.getElementById('formError');

form.addEventListener('submit', async e => {
  e.preventDefault();
  formError.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitText.hidden   = true;
  submitSpinner.hidden = false;
  submitBtn.disabled  = true;

  // If Formspree ID is still placeholder, simulate success locally
  const action = form.getAttribute('action');
  if (action.includes('YOUR_FORM_ID')) {
    await new Promise(r => setTimeout(r, 900));
    showSuccess();
    return;
  }

  // Real Formspree submission
  try {
    const data = new FormData(form);
    const res  = await fetch(action, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      showSuccess();
    } else {
      showError();
    }
  } catch {
    showError();
  }
});

function showSuccess() {
  form.querySelectorAll('.form-grid, .form-footer').forEach(el => el.style.display = 'none');
  formSuccess.hidden = false;
  formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showError() {
  submitText.hidden    = false;
  submitSpinner.hidden = true;
  submitBtn.disabled   = false;
  formError.hidden     = false;
}

/* ── Highlight current open/closed status ── */
function updateOpenStatus() {
  const now = new Date();
  const day  = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  let isOpen = false;
  if (day >= 2 && day <= 6) isOpen = mins >= 570 && mins < 1080; // 9:30–18:00
  if (day === 0)             isOpen = mins >= 690 && mins < 840;  // 11:30–14:00

  const badge = document.createElement('span');
  badge.className = 'open-badge';
  badge.style.cssText = `
    display:inline-block; padding:3px 12px; border-radius:50px; font-size:0.72rem;
    font-weight:600; letter-spacing:0.06em; margin-left:12px; vertical-align:middle;
    background:${isOpen ? '#2ecc71' : '#e74c3c'}; color:#fff;
  `;
  badge.textContent = isOpen ? 'Open Now' : 'Closed';

  const heroH1 = document.querySelector('.hero-content h1');
  if (heroH1 && !document.querySelector('.open-badge')) heroH1.after(badge);
}

updateOpenStatus();
