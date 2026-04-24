/* ============================================================
   ROV LUXURY NAILS — App JS
   ============================================================ */

// ── Navbar scroll ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Hamburger ──
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Build Services ──
function buildServices() {
  if (typeof SHOP === 'undefined' || !SHOP.services) return;
  const panels = document.getElementById('servicesPanels');
  const select = document.getElementById('serviceSelect');
  if (!panels) return;

  panels.innerHTML = '';

  SHOP.services.forEach(cat => {
    const section = document.createElement('div');
    section.className = 'service-category';

    const title = document.createElement('div');
    title.className = 'service-cat-title';
    title.innerHTML = `<span class="service-cat-icon">${cat.icon}</span>${cat.category}`;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'service-grid';

    cat.items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'service-item';
      div.innerHTML = `
        <div class="service-name">${item.name}</div>
        <div class="service-desc">${item.desc}</div>
      `;
      grid.appendChild(div);

      if (select) {
        const opt = document.createElement('option');
        opt.value = item.name;
        opt.textContent = `${cat.icon} ${item.name}`;
        select.appendChild(opt);
      }
    });

    section.appendChild(grid);
    panels.appendChild(section);
  });
}
buildServices();

// ── Date & Time Picker ──
const dateInput = document.getElementById('dateInput');
const timeSelect = document.getElementById('timeSelect');

if (dateInput) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;

  dateInput.addEventListener('change', () => {
    const date = new Date(dateInput.value + 'T00:00:00');
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = dayNames[date.getDay()];

    timeSelect.innerHTML = '';

    if (dayName === 'Monday') {
      timeSelect.innerHTML = '<option value="">Closed on Mondays</option>';
      return;
    }

    const slots = (SHOP.timeSlots && SHOP.timeSlots[dayName]) || [];
    if (slots.length === 0) {
      timeSelect.innerHTML = '<option value="">No slots available</option>';
      return;
    }

    timeSelect.innerHTML = '<option value="">Select a time...</option>';
    slots.forEach(slot => {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = slot;
      timeSelect.appendChild(opt);
    });
  });
}

// ── Booking Form Submit ──
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
      const formData = new FormData(bookingForm);
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        bookingForm.innerHTML = `
          <div class="form-success" style="display:block">
            <div style="font-size:2.5rem;margin-bottom:1rem">✦</div>
            <strong style="font-size:1.2rem;color:var(--white)">Appointment Requested!</strong>
            <p style="margin-top:0.75rem;color:var(--cream-dim)">We'll call or text to confirm within 1 hour during business hours.</p>
          </div>
        `;
      } else {
        btn.textContent = '✦ Request Appointment';
        btn.disabled = false;
        alert('Something went wrong. Please call us at (956) 440-8400.');
      }
    } catch {
      btn.textContent = '✦ Request Appointment';
      btn.disabled = false;
      alert('Something went wrong. Please call us at (956) 440-8400.');
    }
  });
}

// ── Build Gallery ──
function buildGallery() {
  if (typeof SHOP === 'undefined' || !SHOP.gallery) return;
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const layouts = ['g-tall', '', '', 'g-wide', ''];
  grid.innerHTML = '';
  SHOP.gallery.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = `g-item ${layouts[i] || ''}`;
    div.innerHTML = `
      <img src="${item.file}" alt="${item.label}" onerror="this.parentElement.style.opacity='0.3'" />
      <div class="g-overlay">${item.label}</div>
    `;
    grid.appendChild(div);
  });
}
buildGallery();

// ── Scroll Animations ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });

document.querySelectorAll('.highlight-card, .service-item, .review-card, .c-item').forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// ── Active Nav ──
const sections = document.querySelectorAll('section[id]');
const navItems  = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navItems.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? 'var(--rose)' : '';
  });
}, { passive: true });
