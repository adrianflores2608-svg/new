/* ============================================================
   TEXAS BRANDING IRON BURGERS — App JS
   Edit config.js to update business info.
   ============================================================ */

// ── Navbar scroll ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Hamburger ──
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Build Menu from Config ──
function buildMenu() {
  if (typeof SHOP === 'undefined' || !SHOP.menu) return;

  const panelsEl = document.getElementById('menuPanels');
  const tabsEl   = document.getElementById('menuTabs');
  if (!panelsEl || !tabsEl) return;

  panelsEl.innerHTML = '';
  tabsEl.innerHTML   = '';

  SHOP.menu.forEach((cat, i) => {
    // Tab
    const tab = document.createElement('button');
    tab.className = 'tab-btn' + (i === 0 ? ' active' : '');
    tab.dataset.cat = i;
    tab.textContent = `${cat.icon} ${cat.category}`;
    tabsEl.appendChild(tab);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'menu-panel' + (i === 0 ? ' active' : '');
    panel.dataset.panel = i;

    cat.items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'menu-item' + (item.popular ? ' popular' : '');
      div.innerHTML = `
        ${item.popular ? '<span class="popular-tag">Popular</span>' : ''}
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-desc">${item.desc}</div>
        </div>
        <div class="item-price">${item.price}</div>
      `;
      panel.appendChild(div);
    });

    panelsEl.appendChild(panel);
  });

  // Tab click
  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const idx = btn.dataset.cat;
    tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    panelsEl.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    panelsEl.querySelector(`[data-panel="${idx}"]`).classList.add('active');
  });
}
buildMenu();

// ── Build Gallery from Config ──
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

document.querySelectorAll('.highlight-card, .menu-item, .review-card, .c-item').forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// ── Active Nav Highlight ──
const sections = document.querySelectorAll('section[id]');
const navItems  = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navItems.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? 'var(--amber)' : '';
  });
}, { passive: true });
