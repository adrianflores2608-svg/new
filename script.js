'use strict';

// Navbar scroll behavior
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// Mobile hamburger menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// Close mobile menu on outside click
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target)) {
    mobileMenu.classList.remove('open');
  }
});

// Booking form — date minimum (today)
const dateInput = document.getElementById('date');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('min', today);

  // Disable Mondays (day 1) in the date picker via change event
  dateInput.addEventListener('change', () => {
    const selected = new Date(dateInput.value + 'T12:00:00');
    if (selected.getDay() === 1) {
      showDateError('We are closed on Mondays. Please select another day.');
      dateInput.value = '';
    } else {
      clearDateError();
    }
  });
}

function showDateError(msg) {
  let err = document.getElementById('dateError');
  if (!err) {
    err = document.createElement('p');
    err.id = 'dateError';
    err.style.cssText = 'color:#c0392b;font-size:.8rem;margin-top:4px;';
    dateInput.parentNode.appendChild(err);
  }
  err.textContent = msg;
}

function clearDateError() {
  const err = document.getElementById('dateError');
  if (err) err.remove();
}

// Booking form — time slot filtering based on Sunday
const timeSelect = document.getElementById('time');
const allTimeOptions = timeSelect ? [...timeSelect.options] : [];

function filterTimeSlots() {
  if (!dateInput || !timeSelect) return;
  const selected = new Date(dateInput.value + 'T12:00:00');
  const isSunday = selected.getDay() === 0;

  // Sunday hours: 11:30 AM – 2:00 PM
  const sundaySlots = new Set(['11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM']);

  // Rebuild options
  timeSelect.innerHTML = '<option value="" disabled selected>Select a time…</option>';
  allTimeOptions.forEach(opt => {
    if (opt.value === '') return;
    if (isSunday && !sundaySlots.has(opt.text)) return;
    timeSelect.appendChild(opt.cloneNode(true));
  });
}

dateInput?.addEventListener('change', filterTimeSlots);

// Booking form submission
const form = document.getElementById('bookingForm');
const formSuccess = document.getElementById('formSuccess');

form?.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.textContent = 'Sending…';
  btn.disabled = true;

  // Simulate async submit (replace with real backend/API call)
  setTimeout(() => {
    form.style.display = 'none';
    formSuccess.hidden = false;
    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 900);
});

// Intersection Observer — fade-in on scroll
const observerOpts = { threshold: 0.12 };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOpts);

document.querySelectorAll('.service-card, .about-text, .about-img-wrap, .hours-block, .location-block, .badge')
  .forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    observer.observe(el);
  });

document.addEventListener('animationend', () => {}, { once: true });

// Add .visible class styles inline (avoids needing extra CSS)
const style = document.createElement('style');
style.textContent = '.visible { opacity: 1 !important; transform: none !important; }';
document.head.appendChild(style);
