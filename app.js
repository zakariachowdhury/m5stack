// M5Stack DIY Lab — client-side app (no deps)

import { EXTRA_ICONS } from './assets/extra-icons.js';

const state = {
  products: null,   // { devices: [], caps: [], units: [], extras: [], generatedAt }
  projects: null,   // { projects: [] }
  productsById: {}, // id -> product
  projectCountByProduct: {}, // product id -> # of projects that use it
  selection: {
    device: null,         // product id or null
    parts: new Set(),     // set of cap/unit ids
  },
  filters: {
    difficulty: 'all',
    ageGroup: 'all',
    tag: null,           // active tag filter (or null)
    search: '',          // search query
  },
  lastReadyCount: 0,
};

const TOP_TAGS = ['home', 'learning', 'fun', 'automation', 'school', 'outdoors', 'smart-home', 'productivity', 'prototyping', 'green', 'off-grid', 'music', 'lighting', 'art', 'security', 'health', 'game'];

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

(async function init() {
  const [productsRes, projectsRes, extrasRes] = await Promise.all([
    fetch('data/products.json').then((r) => r.json()),
    fetch('data/projects.json').then((r) => r.json()),
    fetch('data/extras.json').then((r) => r.json()),
  ]);
  state.products = { ...productsRes, extras: extrasRes.extras || [] };
  state.projects = projectsRes;

  for (const p of [
    ...state.products.devices,
    ...state.products.caps,
    ...state.products.units,
    ...state.products.extras,
  ]) {
    state.productsById[p.id] = p;
  }

  computeProjectCounts();

  renderStats();
  renderCatalog('devices');
  renderCatalog('caps');
  renderCatalog('units');
  renderCatalog('extras');
  renderPickers();
  renderTagBar();
  renderFooter();
  renderSpotlight();
  wireFilters();
  wirePickerActions();
  wireModalClose();
  wireHero();
  wireSearch();
  wireFab();
  wireKeyboard();
  wireHelp();

  restoreFromHash();
  updateBuilder();
})();

function computeProjectCounts() {
  const counts = {};
  for (const proj of state.projects.projects) {
    for (const id of proj.compatibleDevices || []) {
      counts[id] = (counts[id] || 0) + 1;
    }
    for (const id of proj.requiredParts || []) {
      counts[id] = (counts[id] || 0) + 1;
    }
    for (const id of proj.optionalParts || []) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }
  state.projectCountByProduct = counts;
}

// ---------------------------------------------------------------------
// Hash state sync (shareable builds)
// ---------------------------------------------------------------------

function restoreFromHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return;
  const params = new URLSearchParams(raw);
  const device = params.get('device');
  if (device && state.productsById[device]?.category === 'devices') {
    state.selection.device = device;
  }
  const parts = params.get('parts');
  if (parts) {
    for (const id of parts.split(',').filter(Boolean)) {
      const p = state.productsById[id];
      if (!p) continue;
      if (!partAllowedForDevice(p, state.selection.device)) continue;
      state.selection.parts.add(id);
    }
  }
  const diff = params.get('diff');
  if (diff && ['all', 'beginner', 'intermediate', 'advanced'].includes(diff)) {
    state.filters.difficulty = diff;
  }
  const age = params.get('age');
  if (age && ['all', '8+', '12+', '16+'].includes(age)) {
    state.filters.ageGroup = age;
  }
  const tag = params.get('tag');
  if (tag) state.filters.tag = tag;
  // Re-apply filter button states
  for (const group of document.querySelectorAll('.filter-group')) {
    const key = group.dataset.filter;
    const current = state.filters[key];
    for (const btn of group.querySelectorAll('button')) {
      btn.setAttribute('aria-pressed', btn.dataset.val === current ? 'true' : 'false');
    }
  }
  refreshTagBar();
  refreshSelectionUI();
}

function saveToHash() {
  const params = new URLSearchParams();
  if (state.selection.device) params.set('device', state.selection.device);
  if (state.selection.parts.size) {
    params.set('parts', [...state.selection.parts].join(','));
  }
  if (state.filters.difficulty !== 'all') params.set('diff', state.filters.difficulty);
  if (state.filters.ageGroup !== 'all') params.set('age', state.filters.ageGroup);
  if (state.filters.tag) params.set('tag', state.filters.tag);
  const s = params.toString();
  const next = s ? `#${s}` : ' ';
  history.replaceState(null, '', next);
}

// ---------------------------------------------------------------------
// Rendering: stats & footer
// ---------------------------------------------------------------------

function renderStats() {
  animateCount(document.getElementById('stat-devices'), state.products.devices.length);
  animateCount(document.getElementById('stat-caps'), state.products.caps.length);
  animateCount(document.getElementById('stat-units'), state.products.units.length);
  animateCount(document.getElementById('stat-extras'), state.products.extras.length);
  animateCount(document.getElementById('stat-projects'), state.projects.projects.length);
}

function animateCount(el, to, duration = 900) {
  if (!el) return;
  const from = Number(el.textContent) || 0;
  if (from === to) { el.textContent = to; return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderFooter() {
  const date = state.products.generatedAt
    ? new Date(state.products.generatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  document.getElementById('footer-date').textContent = date
    ? `Product data refreshed ${date}`
    : '';
}

// ---------------------------------------------------------------------
// Rendering: catalogs
// ---------------------------------------------------------------------

const CATEGORY_LABEL = {
  devices: 'Device',
  caps: 'CAP',
  units: 'Unit',
  extras: 'Extra',
};

function renderCatalog(category) {
  const grid = document.querySelector(`[data-product-grid="${category}"]`);
  if (!grid) return;
  grid.innerHTML = '';
  for (const product of state.products[category]) {
    grid.appendChild(productCard(product));
  }
}

function productCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.productId = product.id;
  if (isSelected(product)) card.classList.add('is-selected');
  const isExtra = product.category === 'extras';
  if (isExtra) card.classList.add('is-extra');

  const lock = partDeviceLock(product);
  const locked = product.category !== 'devices'
    && !partAllowedForDevice(product, state.selection.device);
  if (locked) card.classList.add('is-locked');

  const addLabel = addButtonLabel(product, locked);
  const lockNote = lock
    ? `<p class="product-lock">Works only with ${lock.map(deviceTitle).join(' / ')}</p>`
    : '';

  const projectCount = state.projectCountByProduct[product.id] || 0;
  const projectBadge = projectCount > 0
    ? `<span class="product-project-badge" title="Projects using this ${CATEGORY_LABEL[product.category]}">
         <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 3A1.5 1.5 0 0 1 4 1.5h5L13.5 6V13a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 13V3Z" opacity="0.35"/><path d="M9 1.5V5.5A1 1 0 0 0 10 6.5H13.5"/></svg>
         ${projectCount} project${projectCount === 1 ? '' : 's'}
       </span>`
    : '';

  const mediaHtml = isExtra
    ? `<div class="product-icon">${EXTRA_ICONS[product.icon] || ''}</div>`
    : `<div class="product-media"><img src="${product.image ?? ''}" alt="${escape(product.title)}" loading="lazy" /></div>`;

  const priceHtml = isExtra
    ? `<span class="product-price">${escape(product.priceRange || '')}</span>`
    : `<span class="product-price">${product.price ? '$' + product.price : ''}</span>`;

  const descHtml = isExtra
    ? `<p class="product-desc">${escape(product.description || '')}</p>
       <p class="product-extra-meta">${escape(product.subtitle || '')} · ${escape(product.connection || '')}</p>`
    : `<p class="product-desc">${escape(product.shortDescription || '')}</p>`;

  card.innerHTML = `
    ${projectBadge}
    ${mediaHtml}
    <div class="product-body">
      <p class="product-tag">${CATEGORY_LABEL[product.category]}</p>
      <h3 class="product-title">${escape(product.title)}</h3>
      ${descHtml}
      ${lockNote}
      <div class="product-foot">
        ${priceHtml}
        <button type="button" class="product-add" data-product-add ${locked ? 'disabled' : ''}>${addLabel}</button>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-product-add]')) {
      e.stopPropagation();
      if (locked) return;
      togglePick(product);
      return;
    }
    openProductModal(product.id);
  });

  return card;
}

function addButtonLabel(product, locked) {
  if (product.category === 'devices') {
    return isSelected(product) ? 'Selected device' : 'Make my device';
  }
  if (locked) return 'Needs Cardputer';
  return isSelected(product) ? 'In my build' : '+ Add to build';
}

function isSelected(product) {
  if (product.category === 'devices') return state.selection.device === product.id;
  return state.selection.parts.has(product.id);
}

// Returns null if the part is universally compatible, otherwise the list of
// device IDs the part is locked to. Used to disable selection + surface a hint
// when the current device can't use this part.
function partDeviceLock(product) {
  return Array.isArray(product.compatibleDevices) && product.compatibleDevices.length
    ? product.compatibleDevices
    : null;
}

function partAllowedForDevice(product, deviceId) {
  const lock = partDeviceLock(product);
  if (!lock) return true;
  if (!deviceId) return true; // no device picked yet — show as "pending"
  return lock.includes(deviceId);
}

function deviceTitle(id) {
  return state.productsById[id]?.title ?? id;
}

// ---------------------------------------------------------------------
// Rendering: picker (builder sidebar)
// ---------------------------------------------------------------------

function renderPickers() {
  for (const category of ['devices', 'caps', 'units', 'extras']) {
    const host = document.querySelector(`[data-picker="${category}"]`);
    if (!host) continue;
    host.innerHTML = '';
    for (const p of state.products[category]) {
      host.appendChild(pickerChip(p));
    }
  }
}

function pickerChip(product) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pick-chip';
  btn.dataset.pickId = product.id;
  btn.setAttribute('aria-pressed', isSelected(product) ? 'true' : 'false');
  const isExtra = product.category === 'extras';
  if (isExtra) btn.classList.add('is-extra');
  const locked = product.category !== 'devices'
    && !partAllowedForDevice(product, state.selection.device);
  if (locked) {
    btn.classList.add('is-locked');
    btn.disabled = true;
    const lock = partDeviceLock(product);
    btn.title = lock ? `Only with ${lock.map(deviceTitle).join(' / ')}` : '';
  }
  const thumb = isExtra
    ? `<span class="pick-chip-icon">${EXTRA_ICONS[product.icon] || ''}</span>`
    : `<img src="${product.image ?? ''}" alt="" />`;
  btn.innerHTML = `
    ${thumb}
    <span class="pick-chip-label">${escape(shortTitle(product))}</span>
  `;
  btn.addEventListener('click', () => togglePick(product));
  return btn;
}

function shortTitle(product) {
  // Show something scannable in the tiny chip
  const t = product.title
    .replace(/\(.*?\)/g, '')
    .replace(/\bUnit\b/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > 32 ? t.slice(0, 30) + '…' : t;
}

function refreshSelectionUI() {
  // Update product cards
  for (const card of document.querySelectorAll('.product-card')) {
    const p = state.productsById[card.dataset.productId];
    if (!p) continue;
    const locked = p.category !== 'devices' && !partAllowedForDevice(p, state.selection.device);
    card.classList.toggle('is-selected', isSelected(p));
    card.classList.toggle('is-locked', locked);
    const btn = card.querySelector('[data-product-add]');
    if (btn) {
      btn.textContent = addButtonLabel(p, locked);
      btn.disabled = locked;
    }
  }
  // Update picker chips
  for (const chip of document.querySelectorAll('.pick-chip')) {
    const p = state.productsById[chip.dataset.pickId];
    if (!p) continue;
    const locked = p.category !== 'devices' && !partAllowedForDevice(p, state.selection.device);
    chip.setAttribute('aria-pressed', isSelected(p) ? 'true' : 'false');
    chip.classList.toggle('is-locked', locked);
    chip.disabled = locked;
    if (locked) {
      const lock = partDeviceLock(p);
      chip.title = lock ? `Only with ${lock.map(deviceTitle).join(' / ')}` : '';
    } else {
      chip.removeAttribute('title');
    }
  }
}

// ---------------------------------------------------------------------
// Selection actions
// ---------------------------------------------------------------------

function togglePick(product) {
  const wasSelected = isSelected(product);
  if (product.category === 'devices') {
    state.selection.device = state.selection.device === product.id ? null : product.id;
    // Drop any parts incompatible with the new device.
    for (const partId of [...state.selection.parts]) {
      const part = state.productsById[partId];
      if (part && !partAllowedForDevice(part, state.selection.device)) {
        state.selection.parts.delete(partId);
      }
    }
  } else {
    if (state.selection.parts.has(product.id)) {
      state.selection.parts.delete(product.id);
    } else {
      // Ignore clicks on parts that are locked out by the current device.
      if (!partAllowedForDevice(product, state.selection.device)) return;
      state.selection.parts.add(product.id);
    }
  }
  refreshSelectionUI();
  updateBuilder();
  saveToHash();

  // Pulse the catalog card for a little "added" feedback.
  if (!wasSelected && isSelected(product)) {
    for (const card of document.querySelectorAll(`.product-card[data-product-id="${product.id}"]`)) {
      card.classList.remove('just-added');
      void card.offsetWidth; // restart animation
      card.classList.add('just-added');
    }
  }
}

function wirePickerActions() {
  document.getElementById('btn-clear').addEventListener('click', () => {
    const hadAny = !!state.selection.device || state.selection.parts.size > 0;
    state.selection.device = null;
    state.selection.parts.clear();
    state.lastReadyCount = 0;
    refreshSelectionUI();
    updateBuilder();
    saveToHash();
    if (hadAny) showToast('Build cleared', 'info');
  });
  document.getElementById('btn-share').addEventListener('click', async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard', 'success');
    } catch {
      prompt('Copy this link:', url);
    }
  });
  document.getElementById('btn-random-build')?.addEventListener('click', rollRandomBuild);
}

function wireFilters() {
  for (const group of document.querySelectorAll('.filter-group')) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      const key = group.dataset.filter;
      state.filters[key] = btn.dataset.val;
      for (const b of group.querySelectorAll('button')) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      }
      updateBuilder();
      saveToHash();
    });
  }
}

// ---------------------------------------------------------------------
// Builder: match projects against selection
// ---------------------------------------------------------------------

function passesFilters(project) {
  if (state.filters.difficulty !== 'all' && project.difficulty !== state.filters.difficulty) return false;
  if (state.filters.ageGroup !== 'all' && project.ageGroup !== state.filters.ageGroup) return false;
  if (state.filters.tag && !(project.tags || []).includes(state.filters.tag)) return false;
  const q = state.filters.search.trim().toLowerCase();
  if (q) {
    const hay = [
      project.title,
      project.tagline,
      project.howItWorks,
      ...(project.tags || []),
      ...(project.learningGoals || []),
    ].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function matchLevel(project) {
  // Device compatibility is hard requirement (if device selected).
  const { device, parts } = state.selection;
  if (device && !project.compatibleDevices.includes(device)) return { ok: false };

  const missing = project.requiredParts.filter((p) => !parts.has(p));
  return { ok: missing.length === 0, missing };
}

function updateBuilder() {
  const heading = document.getElementById('results-heading');
  const { device, parts } = state.selection;

  if (!device) {
    heading.textContent = 'Pick a device to see matching projects';
  } else {
    const dev = state.productsById[device];
    const count = parts.size;
    heading.textContent =
      count === 0
        ? `With ${dev.title} alone`
        : `With ${dev.title} + ${count} part${count === 1 ? '' : 's'}`;
  }

  const readyHost = document.getElementById('projects-ready');
  const nearHost = document.getElementById('projects-near');
  readyHost.innerHTML = '';
  nearHost.innerHTML = '';

  let readyCount = 0;
  let nearCount = 0;

  for (const project of state.projects.projects) {
    if (!passesFilters(project)) continue;
    if (device && !project.compatibleDevices.includes(device)) continue;

    const missing = project.requiredParts.filter((p) => !parts.has(p));

    if (missing.length === 0) {
      readyHost.appendChild(projectCard(project, []));
      readyCount++;
    } else if (missing.length === 1) {
      nearHost.appendChild(projectCard(project, missing));
      nearCount++;
    }
  }

  setCount('count-ready', readyCount);
  setCount('count-near', nearCount);

  const emptyHint = document.getElementById('empty-ready');
  if (readyCount === 0) {
    emptyHint.hidden = false;
    emptyHint.textContent = device
      ? parts.size === 0
        ? 'Pick a few Units above to reveal matches — or try the "Roll" button in your build panel.'
        : 'No exact matches with the current filters and parts — try removing a filter, or check the "one more part away" list below.'
      : 'Pick a device to see matches.';
  } else {
    emptyHint.hidden = true;
  }

  updateBuildProgress(readyCount);
  updatePickerStepStates();

  // Celebrate when new projects unlock (not on initial paint).
  if (state.lastReadyCount !== 0 && readyCount > state.lastReadyCount) {
    const delta = readyCount - state.lastReadyCount;
    showToast(`${delta} new project${delta === 1 ? '' : 's'} unlocked`, 'success');
  }
  state.lastReadyCount = readyCount;
}

function setCount(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = Number(el.textContent) || 0;
  el.textContent = n;
  if (n > prev && n > 0) {
    el.classList.remove('is-lit');
    void el.offsetWidth;
    el.classList.add('is-lit');
    setTimeout(() => el.classList.remove('is-lit'), 600);
  }
}

function updateBuildProgress(readyCount) {
  const { device, parts } = state.selection;
  const fill = document.getElementById('bp-fill');
  const readyEl = document.getElementById('bp-ready');
  const totalEl = document.getElementById('bp-total');
  const partsEl = document.getElementById('bp-parts');
  const costEl = document.getElementById('bp-cost');
  const wrapper = document.getElementById('build-progress');
  if (!fill) return;

  // "Total" denominator = projects compatible with selected device that also
  // pass the active filters — i.e. the pool we're matching against.
  let total = 0;
  for (const project of state.projects.projects) {
    if (!passesFilters(project)) continue;
    if (device && !project.compatibleDevices.includes(device)) continue;
    total++;
  }

  readyEl.textContent = readyCount;
  totalEl.textContent = device ? `of ${total}` : `of ${state.projects.projects.length}`;
  const pct = device && total > 0 ? Math.round((readyCount / total) * 100) : 0;
  fill.style.width = `${pct}%`;
  wrapper.classList.toggle('is-celebrating', readyCount > 0);

  // Parts + cost summary
  if (parts.size === 0) {
    partsEl.textContent = device ? 'Just the device' : 'No parts yet';
  } else {
    partsEl.textContent = `${parts.size} part${parts.size === 1 ? '' : 's'}`;
  }

  let cost = 0;
  if (device) {
    const dev = state.productsById[device];
    cost += productCost(dev);
  }
  for (const id of parts) {
    cost += productCost(state.productsById[id]);
  }
  costEl.textContent = cost > 0 ? `$${cost.toFixed(2)} build` : '';
}

// Parse a price from either Shopify "12.34" or an extras "$2 / 10-pack" range.
function productCost(product) {
  if (!product) return 0;
  if (product.price) return parseFloat(product.price) || 0;
  if (product.priceRange) {
    const m = product.priceRange.match(/\$(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }
  return 0;
}

function updatePickerStepStates() {
  const groups = document.querySelectorAll('.builder-picker .picker-group');
  if (groups.length < 3) return;
  const hasDevice = !!state.selection.device;
  const hasParts = state.selection.parts.size > 0;
  // Group order: 0=device, 1=cap, 2=units
  groups[0].classList.toggle('is-active', !hasDevice);
  groups[0].classList.toggle('is-done', hasDevice);
  groups[1].classList.toggle('is-active', hasDevice && !hasParts);
  groups[1].classList.toggle('is-done', hasDevice && hasParts);
  groups[2].classList.toggle('is-active', hasDevice && !hasParts);
  groups[2].classList.toggle('is-done', hasDevice && hasParts);
}

function projectCard(project, missingParts) {
  const card = document.createElement('article');
  card.className = 'project-card';
  card.dataset.projectId = project.id;
  card.dataset.diff = project.difficulty;

  const diffDots = { beginner: 1, intermediate: 2, advanced: 3 }[project.difficulty] ?? 1;
  const dotsHtml = `<span class="difficulty-dots">${[0,1,2].map(i => `<span class="${i < diffDots ? 'on' : ''}"></span>`).join('')}</span>`;

  const missingChips = missingParts
    .map((id) => state.productsById[id])
    .filter(Boolean)
    .map((p) => `<span class="pill pill-missing">+ ${escape(shortTitle(p))}</span>`)
    .join('');

  const tagsHtml = project.tags && project.tags.length
    ? `<div class="project-tag-row">${project.tags.slice(0, 3).map((t) => `<span class="tag-chip">#${escape(t)}</span>`).join('')}</div>`
    : '';

  card.innerHTML = `
    <h4 class="project-title">${escape(project.title)}</h4>
    <p class="project-tagline">${escape(project.tagline)}</p>
    ${tagsHtml}
    <div class="project-meta">
      <span class="pill pill-diff">${dotsHtml} ${cap(project.difficulty)}</span>
      <span class="pill">${escape(project.ageGroup)}</span>
      <span class="pill">${escape(project.duration)}</span>
      ${missingChips}
    </div>
  `;

  card.addEventListener('click', () => openProjectModal(project.id));
  return card;
}

// ---------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------

function openProductModal(productId) {
  const p = state.productsById[productId];
  if (!p) return;
  const body = document.getElementById('product-modal-body');
  const isExtra = p.category === 'extras';

  const galleryHtml = isExtra
    ? `<div class="pmodal-media pmodal-media--extra">${EXTRA_ICONS[p.icon] || ''}</div>`
    : p.images?.length
      ? `<div class="pmodal-media"><img src="${p.image}" alt="${escape(p.title)}" /></div>`
      : '';

  const featuresHtml = p.features?.length
    ? `<ul class="pmodal-features">${p.features.map((f) => `<li>${escape(f)}</li>`).join('')}</ul>`
    : '';

  const selected = isSelected(p);
  const locked = p.category !== 'devices' && !partAllowedForDevice(p, state.selection.device);
  const lock = partDeviceLock(p);
  const lockNote = lock
    ? `<p class="product-lock">Compatible only with ${lock.map(deviceTitle).join(' / ')}.</p>`
    : '';
  const addLabel = p.category === 'devices'
    ? (selected ? 'Remove as device' : 'Set as my device')
    : locked
      ? `Needs ${lock.map(deviceTitle).join(' / ')}`
      : (selected ? 'Remove from build' : 'Add to build');

  const priceLine = isExtra
    ? `${CATEGORY_LABEL[p.category]} · ${escape(p.priceRange || '')} · ${escape(p.connection || '')}`
    : `${CATEGORY_LABEL[p.category]} · ${p.price ? '$' + p.price : ''}`;

  const descHtml = isExtra
    ? `<p>${escape(p.description || '')}</p>${p.subtitle ? `<p class="product-extra-meta">${escape(p.subtitle)}</p>` : ''}`
    : `<p>${escape(p.shortDescription || '')}</p>`;

  const whereHtml = isExtra && p.where?.length
    ? `<p class="pmodal-where"><strong>Find it at:</strong> ${p.where.map((w) => escape(w)).join(' · ')}</p>`
    : '';

  const externalLink = isExtra
    ? ''
    : `<a href="${p.url}" class="btn btn-ghost" target="_blank" rel="noopener">View on m5stack.com ↗</a>`;

  body.innerHTML = `
    ${galleryHtml}
    <div class="pmodal-content">
      <p class="product-tag">${priceLine}</p>
      <h2 id="product-modal-title">${escape(p.title)}</h2>
      ${descHtml}
      ${whereHtml}
      ${lockNote}
      ${featuresHtml}
      <div class="pmodal-actions">
        <button type="button" class="btn btn-primary" data-toggle-pick="${p.id}" ${locked ? 'disabled' : ''}>${addLabel}</button>
        ${externalLink}
      </div>
      ${renderProductIdeasSection(p)}
    </div>
  `;
  body.querySelector('[data-toggle-pick]').addEventListener('click', () => {
    if (locked) return;
    togglePick(p);
    document.getElementById('product-modal').close();
  });
  // Wire the project mini-cards: close product modal, open project modal.
  for (const card of body.querySelectorAll('[data-project-pick]')) {
    card.addEventListener('click', () => {
      const id = card.dataset.projectPick;
      document.getElementById('product-modal').close();
      openProjectModal(id);
    });
  }
  document.getElementById('product-modal').showModal();
}

function renderProductIdeasSection(product) {
  const matches = projectsForProduct(product);
  if (matches.length === 0) return '';

  const { solo, combo } = matches;
  const isDevice = product.category === 'devices';

  const soloHeading = isDevice
    ? 'Just this device · no extra parts'
    : 'Device + this Unit alone';
  const comboHeading = isDevice
    ? 'With an add-on Unit or CAP'
    : 'Combine with more parts';

  const soloBlurb = isDevice
    ? `${product.title} packs a surprising amount on its own — here are builds that rely entirely on what's already inside.`
    : `Projects where this is the only part you need alongside a device.`;
  const comboBlurb = isDevice
    ? `Builds that add one or more Units or a CAP for richer real-world projects.`
    : `Bigger builds that combine this with other Units for more ambitious projects.`;

  const soloHtml = solo.length
    ? `
      <section class="pmodal-ideas">
        <h4>${escape(soloHeading)} <span class="idea-count">${solo.length}</span></h4>
        <p class="pmodal-ideas-blurb">${escape(soloBlurb)}</p>
        <div class="pmodal-ideas-list">${solo.map((proj) => ideaCardHtml(proj, product)).join('')}</div>
      </section>
    ` : '';

  const comboHtml = combo.length
    ? `
      <section class="pmodal-ideas">
        <h4>${escape(comboHeading)} <span class="idea-count">${combo.length}</span></h4>
        <p class="pmodal-ideas-blurb">${escape(comboBlurb)}</p>
        <div class="pmodal-ideas-list">${combo.map((proj) => ideaCardHtml(proj, product)).join('')}</div>
      </section>
    ` : '';

  return `
    <div class="pmodal-ideas-header">
      <h3>Things you could build</h3>
      <p class="muted">${matches.all.length} project${matches.all.length === 1 ? '' : 's'} in this recipe book ${isDevice ? 'work with' : 'use'} ${escape(product.title)}.</p>
    </div>
    ${soloHtml}
    ${comboHtml}
  `;
}

// For a given product, return matching projects split into:
//   solo: the product is enough (device alone OR this is the only required part)
//   combo: needs other parts alongside this product
function projectsForProduct(product) {
  const projects = state.projects.projects;
  const matches = [];
  const isDevice = product.category === 'devices';

  for (const proj of projects) {
    let include = false;
    let soloForThis = false;
    if (isDevice) {
      include = proj.compatibleDevices.includes(product.id);
      soloForThis = include && proj.requiredParts.length === 0;
    } else {
      const isRequired = proj.requiredParts.includes(product.id);
      const isOptional = (proj.optionalParts || []).includes(product.id);
      include = isRequired || isOptional;
      // solo = this is the only required part (others can be device-only
      // projects that treat this as optional, which still counts as "solo")
      const otherRequired = proj.requiredParts.filter((id) => id !== product.id);
      soloForThis = include && otherRequired.length === 0;
    }
    if (include) {
      matches.push({ proj, soloForThis });
    }
  }

  const byDifficulty = { beginner: 0, intermediate: 1, advanced: 2 };
  matches.sort((a, b) => byDifficulty[a.proj.difficulty] - byDifficulty[b.proj.difficulty]);

  return {
    all: matches.map((m) => m.proj),
    solo: matches.filter((m) => m.soloForThis).map((m) => m.proj),
    combo: matches.filter((m) => !m.soloForThis).map((m) => m.proj),
  };
}

function ideaCardHtml(proj, context) {
  const diffDots = { beginner: 1, intermediate: 2, advanced: 3 }[proj.difficulty] ?? 1;
  const dotsHtml = `<span class="difficulty-dots">${[0,1,2].map(i => `<span class="${i < diffDots ? 'on' : ''}"></span>`).join('')}</span>`;

  // Show a short list of extra parts needed beyond the current product.
  const extras = proj.requiredParts
    .filter((id) => id !== context.id)
    .map((id) => state.productsById[id])
    .filter(Boolean);
  const deviceChip = context.category !== 'devices' && proj.compatibleDevices.length === 1
    ? `<span class="idea-extra">+ ${escape(shortTitle(state.productsById[proj.compatibleDevices[0]] || {title: proj.compatibleDevices[0]}))}</span>`
    : '';
  const extrasHtml = extras.length
    ? `<div class="idea-extras">${extras.slice(0, 3).map((x) => `<span class="idea-extra">+ ${escape(shortTitle(x))}</span>`).join('')}${extras.length > 3 ? `<span class="idea-extra">+${extras.length - 3} more</span>` : ''}</div>`
    : (deviceChip ? `<div class="idea-extras">${deviceChip}</div>` : '');

  return `
    <button type="button" class="idea-card" data-project-pick="${proj.id}" data-diff="${proj.difficulty}">
      <h5 class="idea-title">${escape(proj.title)}</h5>
      <p class="idea-tagline">${escape(proj.tagline)}</p>
      <div class="idea-meta">
        <span class="pill pill-diff">${dotsHtml} ${cap(proj.difficulty)}</span>
        <span class="pill">${escape(proj.ageGroup)}</span>
        <span class="pill">${escape(proj.duration)}</span>
      </div>
      ${extrasHtml}
    </button>
  `;
}

function openProjectModal(projectId) {
  const proj = state.projects.projects.find((p) => p.id === projectId);
  if (!proj) return;
  const body = document.getElementById('project-modal-body');

  const devices = proj.compatibleDevices.map((id) => state.productsById[id]).filter(Boolean);
  const required = proj.requiredParts.map((id) => state.productsById[id]).filter(Boolean);
  const optional = (proj.optionalParts || []).map((id) => state.productsById[id]).filter(Boolean);

  const diffDots = { beginner: 1, intermediate: 2, advanced: 3 }[proj.difficulty] ?? 1;
  const dotsHtml = `<span class="difficulty-dots">${[0,1,2].map(i => `<span class="${i < diffDots ? 'on' : ''}"></span>`).join('')}</span>`;
  const totalParts = required.length + optional.length;

  // "Load this build" is always offered; picks the first compatible device
  // and the required parts. Resolves any lock conflicts automatically.
  const firstDevice = devices[0]?.id;

  body.innerHTML = `
    <article class="projmodal" data-diff="${proj.difficulty}" style="--diff-color: ${diffColor(proj.difficulty)}">
      <header class="projmodal-hero">
        <div class="projmodal-hero-meta">
          <span class="pill pill-diff projmodal-diff">${dotsHtml} ${cap(proj.difficulty)}</span>
          <span class="projmodal-meta-dot">·</span>
          <span class="projmodal-meta-item"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5a4 4 0 0 0-4 4v1.3a3 3 0 0 1-.6 1.8L2 12h12l-1.4-2.4a3 3 0 0 1-.6-1.8V6.5a4 4 0 0 0-4-4Z"/><path d="M6 14a2 2 0 0 0 4 0"/></svg>${escape(proj.ageGroup)}</span>
          <span class="projmodal-meta-dot">·</span>
          <span class="projmodal-meta-item"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/></svg>${escape(proj.duration)}</span>
          <span class="projmodal-meta-dot">·</span>
          <span class="projmodal-meta-item"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M6 2v2M10 2v2"/></svg>${totalParts} part${totalParts === 1 ? '' : 's'}</span>
        </div>
        <h2 id="project-modal-title">${escape(proj.title)}</h2>
        <p class="projmodal-tagline">${escape(proj.tagline)}</p>
        ${proj.tags?.length ? `<div class="projmodal-tags">${proj.tags.map((t) => `<span class="tag-chip">#${escape(t)}</span>`).join('')}</div>` : ''}
      </header>

      <div class="projmodal-grid">
        <div class="projmodal-main">
          <section class="projmodal-section">
            <h4>How it works</h4>
            <p class="projmodal-prose">${escape(proj.howItWorks)}</p>
          </section>

          <section class="projmodal-section">
            <h4>What you'll learn</h4>
            <ul class="projmodal-list">${proj.learningGoals.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>
          </section>

          ${proj.extensions?.length ? `
            <section class="projmodal-section">
              <h4>Take it further</h4>
              <ul class="projmodal-list">${proj.extensions.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>
            </section>
          ` : ''}
        </div>

        <aside class="projmodal-side">
          <section class="projmodal-bom">
            <h4>Device</h4>
            <div class="part-stack">${devices.map((p) => partCardHtml(p, 'device')).join('')}</div>
          </section>
          <section class="projmodal-bom">
            <h4>Required parts ${required.length ? `<span class="bom-count">${required.length}</span>` : ''}</h4>
            ${required.length
              ? `<div class="part-stack">${required.map((p) => partCardHtml(p, 'required')).join('')}</div>`
              : `<p class="part-empty">Works with the device on its own — no extra parts needed.</p>`}
          </section>
          ${optional.length ? `
            <section class="projmodal-bom">
              <h4>Nice to add <span class="bom-count">${optional.length}</span></h4>
              <div class="part-stack">${optional.map((p) => partCardHtml(p, 'optional')).join('')}</div>
            </section>
          ` : ''}
          <div class="projmodal-cta">
            <button type="button" class="btn btn-primary btn-block" data-load-build>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              Load this build
            </button>
            <p class="projmodal-cta-hint">Sets this device and the required parts in the builder.</p>
          </div>
        </aside>
      </div>
    </article>
  `;

  // Part cards open their product modal
  for (const card of body.querySelectorAll('[data-part-open]')) {
    card.addEventListener('click', () => {
      const id = card.dataset.partOpen;
      document.getElementById('project-modal').close();
      openProductModal(id);
    });
  }
  // Load-this-build: sets selection and scrolls to the builder
  body.querySelector('[data-load-build]')?.addEventListener('click', () => {
    loadBuildFromProject(proj, firstDevice);
    document.getElementById('project-modal').close();
    document.getElementById('builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('project-modal').showModal();
}

function loadBuildFromProject(proj, deviceId) {
  state.selection.device = deviceId || null;
  state.selection.parts = new Set();
  for (const id of proj.requiredParts) {
    const part = state.productsById[id];
    if (!part) continue;
    if (!partAllowedForDevice(part, state.selection.device)) continue;
    state.selection.parts.add(id);
  }
  refreshSelectionUI();
  updateBuilder();
  saveToHash();
}

function partCardHtml(product, role) {
  const type = role === 'device' ? 'Device' : CATEGORY_LABEL[product.category] || '';
  const isExtra = product.category === 'extras';
  const extraClass = isExtra ? ' part-card--extra' : '';
  const imgHtml = isExtra
    ? `<div class="part-card-img">${EXTRA_ICONS[product.icon] || ''}</div>`
    : `<div class="part-card-img"><img src="${product.image ?? ''}" alt="" /></div>`;
  const priceText = isExtra
    ? (product.priceRange || '')
    : (product.price ? '$' + product.price : '');
  return `
    <button type="button" class="part-card part-card--${role}${extraClass}" data-part-open="${product.id}">
      ${imgHtml}
      <div class="part-card-body">
        <span class="part-card-type">${escape(type)}${role === 'optional' ? ' · optional' : ''}</span>
        <span class="part-card-name">${escape(product.title)}</span>
        ${priceText ? `<span class="part-card-price">${escape(priceText)}</span>` : ''}
      </div>
    </button>
  `;
}

function wireModalClose() {
  for (const dialog of document.querySelectorAll('.modal')) {
    dialog.addEventListener('click', (e) => {
      if (e.target.matches('[data-modal-close]')) dialog.close();
      // Click on backdrop (the dialog itself, outside content) closes too
      if (e.target === dialog) dialog.close();
    });
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function diffColor(d) {
  return d === 'advanced' ? '#ff7285' : d === 'intermediate' ? '#f5b544' : '#5ed58a';
}

// ---------------------------------------------------------------------
// Hero: featured spotlight + Surprise me
// ---------------------------------------------------------------------

function renderSpotlight(preferredDifficulty) {
  const body = document.getElementById('spotlight-body');
  if (!body) return;
  const pool = preferredDifficulty
    ? state.projects.projects.filter((p) => p.difficulty === preferredDifficulty)
    : state.projects.projects;
  const proj = pool[Math.floor(Math.random() * pool.length)];
  if (!proj) return;

  const diffDots = { beginner: 1, intermediate: 2, advanced: 3 }[proj.difficulty] ?? 1;
  const dotsHtml = `<span class="difficulty-dots">${[0,1,2].map(i => `<span class="${i < diffDots ? 'on' : ''}"></span>`).join('')}</span>`;

  const partIds = [proj.compatibleDevices?.[0], ...(proj.requiredParts || [])].filter(Boolean);
  const firstParts = partIds.slice(0, 4)
    .map((id) => state.productsById[id])
    .filter(Boolean);
  const moreCount = Math.max(0, partIds.length - firstParts.length);

  const partsHtml = `
    <div class="spotlight-parts">
      ${firstParts.map((p) => `<span class="spotlight-part-img"><img src="${p.image ?? ''}" alt="" loading="lazy" /></span>`).join('')}
      ${moreCount > 0 ? `<span class="spotlight-more">+${moreCount}</span>` : ''}
    </div>
  `;

  body.innerHTML = `
    <button type="button" class="spotlight-card" data-project-open="${proj.id}" style="--diff-color: ${diffColor(proj.difficulty)}">
      <span class="spotlight-diff">${dotsHtml} ${cap(proj.difficulty)} · ${escape(proj.duration)}</span>
      <h3 class="spotlight-title">${escape(proj.title)}</h3>
      <p class="spotlight-tagline">${escape(proj.tagline)}</p>
      ${partsHtml}
      <span class="spotlight-cta">Open project
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
      </span>
    </button>
  `;

  body.querySelector('.spotlight-card').addEventListener('click', () => openProjectModal(proj.id));
}

function wireHero() {
  document.getElementById('btn-surprise')?.addEventListener('click', () => {
    const list = state.projects.projects;
    const proj = list[Math.floor(Math.random() * list.length)];
    if (proj) openProjectModal(proj.id);
  });
  document.getElementById('btn-spotlight-shuffle')?.addEventListener('click', () => {
    renderSpotlight();
  });
}

// ---------------------------------------------------------------------
// Tag filter bar
// ---------------------------------------------------------------------

function renderTagBar() {
  const host = document.getElementById('tag-bar');
  if (!host) return;
  const counts = {};
  for (const p of state.projects.projects) {
    for (const t of p.tags || []) counts[t] = (counts[t] || 0) + 1;
  }
  const tags = TOP_TAGS.filter((t) => counts[t]);

  host.innerHTML = tags.map((t) => `
    <button type="button" class="tag-chip-btn" data-tag="${escape(t)}" aria-pressed="${state.filters.tag === t ? 'true' : 'false'}">
      #${escape(t)}<span class="tag-count">${counts[t]}</span>
    </button>
  `).join('');

  for (const btn of host.querySelectorAll('.tag-chip-btn')) {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      state.filters.tag = state.filters.tag === tag ? null : tag;
      refreshTagBar();
      updateBuilder();
      saveToHash();
    });
  }
}

function refreshTagBar() {
  for (const btn of document.querySelectorAll('#tag-bar .tag-chip-btn')) {
    btn.setAttribute('aria-pressed', btn.dataset.tag === state.filters.tag ? 'true' : 'false');
  }
}

// ---------------------------------------------------------------------
// Search input
// ---------------------------------------------------------------------

function wireSearch() {
  const input = document.getElementById('project-search');
  if (!input) return;
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.filters.search = input.value;
      updateBuilder();
    }, 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      state.filters.search = '';
      updateBuilder();
    }
  });
}

// ---------------------------------------------------------------------
// Scroll-to-top FAB
// ---------------------------------------------------------------------

function wireFab() {
  const fab = document.getElementById('fab-top');
  if (!fab) return;
  fab.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const toggle = () => {
    const show = window.scrollY > 600;
    if (show) fab.removeAttribute('hidden');
    else fab.setAttribute('hidden', '');
  };
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
}

// ---------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------

function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Skip if typing in an input, unless Esc
    const isTyping = e.target.matches('input, textarea, [contenteditable]');
    if (isTyping && e.key !== 'Escape') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '/') {
      e.preventDefault();
      const input = document.getElementById('project-search');
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (e.key === '?') {
      e.preventDefault();
      document.getElementById('help-modal')?.showModal();
    } else if (e.key.toLowerCase() === 's') {
      const list = state.projects.projects;
      const proj = list[Math.floor(Math.random() * list.length)];
      if (proj) openProjectModal(proj.id);
    } else if (e.key.toLowerCase() === 'r') {
      rollRandomBuild();
    } else if (e.key.toLowerCase() === 'b') {
      document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (e.key.toLowerCase() === 'c') {
      document.getElementById('btn-clear')?.click();
    }
  });
}

function wireHelp() {
  document.getElementById('btn-help')?.addEventListener('click', () => {
    document.getElementById('help-modal')?.showModal();
  });
}

// ---------------------------------------------------------------------
// Roll a random build
// ---------------------------------------------------------------------

function rollRandomBuild() {
  const pool = state.projects.projects;
  const proj = pool[Math.floor(Math.random() * pool.length)];
  if (!proj) return;
  const device = proj.compatibleDevices[0];
  loadBuildFromProject(proj, device);
  document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`Rolled: ${proj.title}`, 'info');
}

// ---------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------

let toastTimer = null;
function showToast(msg, kind = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast is-${kind} is-showing`;
  toast.hidden = false;
  toast.innerHTML = `<span class="toast-dot"></span><span>${escape(msg)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-showing');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2200);
}
