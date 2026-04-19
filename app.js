// M5Stack DIY Lab — client-side app (no deps)

const state = {
  products: null,   // { devices: [], caps: [], units: [], generatedAt }
  projects: null,   // { projects: [] }
  productsById: {}, // id -> product
  selection: {
    device: null,         // product id or null
    parts: new Set(),     // set of cap/unit ids
  },
  filters: {
    difficulty: 'all',
    ageGroup: 'all',
  },
};

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

(async function init() {
  const [productsRes, projectsRes] = await Promise.all([
    fetch('data/products.json').then((r) => r.json()),
    fetch('data/projects.json').then((r) => r.json()),
  ]);
  state.products = productsRes;
  state.projects = projectsRes;

  for (const p of [...productsRes.devices, ...productsRes.caps, ...productsRes.units]) {
    state.productsById[p.id] = p;
  }

  renderStats();
  renderCatalog('devices');
  renderCatalog('caps');
  renderCatalog('units');
  renderPickers();
  renderFooter();
  wireFilters();
  wirePickerActions();
  wireModalClose();

  restoreFromHash();
  updateBuilder();
})();

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
  // Re-apply filter button states
  for (const group of document.querySelectorAll('.filter-group')) {
    const key = group.dataset.filter;
    const current = state.filters[key];
    for (const btn of group.querySelectorAll('button')) {
      btn.setAttribute('aria-pressed', btn.dataset.val === current ? 'true' : 'false');
    }
  }
}

function saveToHash() {
  const params = new URLSearchParams();
  if (state.selection.device) params.set('device', state.selection.device);
  if (state.selection.parts.size) {
    params.set('parts', [...state.selection.parts].join(','));
  }
  if (state.filters.difficulty !== 'all') params.set('diff', state.filters.difficulty);
  if (state.filters.ageGroup !== 'all') params.set('age', state.filters.ageGroup);
  const s = params.toString();
  const next = s ? `#${s}` : ' ';
  history.replaceState(null, '', next);
}

// ---------------------------------------------------------------------
// Rendering: stats & footer
// ---------------------------------------------------------------------

function renderStats() {
  document.getElementById('stat-devices').textContent = state.products.devices.length;
  document.getElementById('stat-caps').textContent = state.products.caps.length;
  document.getElementById('stat-units').textContent = state.products.units.length;
  document.getElementById('stat-projects').textContent = state.projects.projects.length;
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

  const lock = partDeviceLock(product);
  const locked = product.category !== 'devices'
    && !partAllowedForDevice(product, state.selection.device);
  if (locked) card.classList.add('is-locked');

  const addLabel = addButtonLabel(product, locked);
  const lockNote = lock
    ? `<p class="product-lock">Works only with ${lock.map(deviceTitle).join(' / ')}</p>`
    : '';

  card.innerHTML = `
    <div class="product-media">
      <img src="${product.image ?? ''}" alt="${escape(product.title)}" loading="lazy" />
    </div>
    <div class="product-body">
      <p class="product-tag">${CATEGORY_LABEL[product.category]}</p>
      <h3 class="product-title">${escape(product.title)}</h3>
      <p class="product-desc">${escape(product.shortDescription || '')}</p>
      ${lockNote}
      <div class="product-foot">
        <span class="product-price">${product.price ? '$' + product.price : ''}</span>
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
  for (const category of ['devices', 'caps', 'units']) {
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
  const locked = product.category !== 'devices'
    && !partAllowedForDevice(product, state.selection.device);
  if (locked) {
    btn.classList.add('is-locked');
    btn.disabled = true;
    const lock = partDeviceLock(product);
    btn.title = lock ? `Only with ${lock.map(deviceTitle).join(' / ')}` : '';
  }
  btn.innerHTML = `
    <img src="${product.image ?? ''}" alt="" />
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
}

function wirePickerActions() {
  document.getElementById('btn-clear').addEventListener('click', () => {
    state.selection.device = null;
    state.selection.parts.clear();
    refreshSelectionUI();
    updateBuilder();
    saveToHash();
  });
  document.getElementById('btn-share').addEventListener('click', async (e) => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      const btn = e.currentTarget;
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = orig), 1600);
    } catch {
      prompt('Copy this link:', url);
    }
  });
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

  document.getElementById('count-ready').textContent = readyCount;
  document.getElementById('count-near').textContent = nearCount;

  const emptyHint = document.getElementById('empty-ready');
  if (readyCount === 0) {
    emptyHint.hidden = false;
    emptyHint.textContent = device
      ? parts.size === 0
        ? 'Pick a few Units above to reveal matches.'
        : 'No exact matches with the current filters and parts — try removing a filter, or check the "one more part away" list below.'
      : 'Pick a device to see matches.';
  } else {
    emptyHint.hidden = true;
  }
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

  card.innerHTML = `
    <h4 class="project-title">${escape(project.title)}</h4>
    <p class="project-tagline">${escape(project.tagline)}</p>
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
  const galleryHtml = p.images?.length
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

  body.innerHTML = `
    ${galleryHtml}
    <div class="pmodal-content">
      <p class="product-tag">${CATEGORY_LABEL[p.category]} · ${p.price ? '$' + p.price : ''}</p>
      <h2 id="product-modal-title">${escape(p.title)}</h2>
      <p>${escape(p.shortDescription || '')}</p>
      ${lockNote}
      ${featuresHtml}
      <div class="pmodal-actions">
        <button type="button" class="btn btn-primary" data-toggle-pick="${p.id}" ${locked ? 'disabled' : ''}>${addLabel}</button>
        <a href="${p.url}" class="btn btn-ghost" target="_blank" rel="noopener">View on m5stack.com ↗</a>
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

  const deviceChips = proj.compatibleDevices
    .map((id) => state.productsById[id])
    .filter(Boolean)
    .map((p) => partChipHtml(p, false))
    .join('');
  const requiredChips = proj.requiredParts
    .map((id) => state.productsById[id])
    .filter(Boolean)
    .map((p) => partChipHtml(p, false))
    .join('');
  const optionalChips = (proj.optionalParts || [])
    .map((id) => state.productsById[id])
    .filter(Boolean)
    .map((p) => partChipHtml(p, true))
    .join('');

  const diffDots = { beginner: 1, intermediate: 2, advanced: 3 }[proj.difficulty] ?? 1;
  const dotsHtml = `<span class="difficulty-dots">${[0,1,2].map(i => `<span class="${i < diffDots ? 'on' : ''}"></span>`).join('')}</span>`;

  body.innerHTML = `
    <div class="projmodal" data-diff="${proj.difficulty}" style="--diff-color: ${diffColor(proj.difficulty)}">
      <h2 id="project-modal-title">${escape(proj.title)}</h2>
      <p class="project-tagline">${escape(proj.tagline)}</p>

      <div class="pill-row">
        <span class="pill pill-diff" style="color: ${diffColor(proj.difficulty)}; border-color: ${diffColor(proj.difficulty)}">${dotsHtml} ${cap(proj.difficulty)}</span>
        <span class="pill">${escape(proj.ageGroup)} friendly</span>
        <span class="pill">${escape(proj.duration)}</span>
        ${proj.tags.map((t) => `<span class="pill">#${escape(t)}</span>`).join('')}
      </div>

      <section class="projmodal-section">
        <h4>How it works</h4>
        <p>${escape(proj.howItWorks)}</p>
      </section>

      <section class="projmodal-section">
        <h4>Works with device</h4>
        <div class="projmodal-parts">${deviceChips}</div>
      </section>

      <section class="projmodal-section">
        <h4>Required parts</h4>
        <div class="projmodal-parts">${requiredChips || '<span class="muted">None — works with the device on its own.</span>'}</div>
      </section>

      ${optionalChips ? `
        <section class="projmodal-section">
          <h4>Nice to add</h4>
          <div class="projmodal-parts">${optionalChips}</div>
        </section>
      ` : ''}

      <section class="projmodal-section">
        <h4>What you'll learn</h4>
        <ul>${proj.learningGoals.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>
      </section>

      ${proj.extensions?.length ? `
        <section class="projmodal-section">
          <h4>Take it further</h4>
          <ul>${proj.extensions.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>
        </section>
      ` : ''}
    </div>
  `;
  document.getElementById('project-modal').showModal();
}

function partChipHtml(product, optional) {
  return `
    <span class="part-chip ${optional ? 'is-optional' : ''}" title="${escape(product.title)}">
      <img src="${product.image ?? ''}" alt="" />
      ${escape(shortTitle(product))}
    </span>
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
