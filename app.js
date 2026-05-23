/* ── SearchX app.js ──────────────────────────────────────────────────────── */

const SEARX_INSTANCES = [
  'https://searx.be',
  'https://search.mdosch.de',
  'https://searxng.site',
  'https://search.sapti.me',
  'https://paulgo.io',
];

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/get?url=',
];

let currentQuery = '';
let currentCategory = 'general';
let currentPage = 1;
let currentTimeFilter = 'any';
let currentInstanceIdx = 0;
let currentProxyIdx = 0;

/* ── Utility ─────────────────────────────────────────────────────────────── */

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

function setParam(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
  window.history.pushState({}, '', url);
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; } catch { return ''; }
}

function formatDate(d) {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date)) return '';
    const diff = Date.now() - date;
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* ── API Fetch ───────────────────────────────────────────────────────────── */

async function fetchResults(query, category, page, timeRange) {
  const pagenum = page || 1;
  const params = new URLSearchParams({
    q: query,
    categories: category || 'general',
    format: 'json',
    pageno: pagenum,
  });
  if (timeRange && timeRange !== 'any') params.set('time_range', timeRange);

  for (let p = 0; p < CORS_PROXIES.length; p++) {
    for (let i = 0; i < SEARX_INSTANCES.length; i++) {
      const idx = (currentInstanceIdx + i) % SEARX_INSTANCES.length;
      const proxy = CORS_PROXIES[(currentProxyIdx + p) % CORS_PROXIES.length];
      const apiUrl = `${SEARX_INSTANCES[idx]}/search?${params}`;

      try {
        const isAllOrigins = proxy.includes('allorigins');
        const fetchUrl = isAllOrigins
          ? `${proxy}${encodeURIComponent(apiUrl)}`
          : `${proxy}${encodeURIComponent(apiUrl)}`;

        const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;

        let data;
        if (isAllOrigins) {
          const wrapper = await res.json();
          data = JSON.parse(wrapper.contents);
        } else {
          data = await res.json();
        }

        if (data && (data.results !== undefined)) {
          currentInstanceIdx = idx;
          return data;
        }
      } catch (e) {
        continue;
      }
    }
  }
  throw new Error('All search instances failed. Please try again.');
}

/* ── Suggestions (DuckDuckGo autocomplete) ───────────────────────────────── */

let suggestTimer = null;

async function fetchSuggestions(q) {
  if (!q || q.length < 2) return [];
  try {
    const proxy = 'https://corsproxy.io/?';
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`;
    const res = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
  } catch {
    return [];
  }
}

function initSuggestionsUI(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const val = input.value.trim();
    if (!val) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }
    suggestTimer = setTimeout(async () => {
      const suggestions = await fetchSuggestions(val);
      renderSuggestions(suggestions, input, dropdown);
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.suggestion-item');
    const active = dropdown.querySelector('.suggestion-item.highlighted');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!active) items[0]?.classList.add('highlighted');
      else {
        active.classList.remove('highlighted');
        (active.nextElementSibling || items[0])?.classList.add('highlighted');
      }
      const h = dropdown.querySelector('.highlighted');
      if (h) input.value = h.dataset.value;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!active) items[items.length - 1]?.classList.add('highlighted');
      else {
        active.classList.remove('highlighted');
        (active.previousElementSibling || items[items.length - 1])?.classList.add('highlighted');
      }
      const h = dropdown.querySelector('.highlighted');
      if (h) input.value = h.dataset.value;
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

function renderSuggestions(suggestions, input, dropdown) {
  if (!suggestions.length) { dropdown.classList.remove('open'); return; }
  const searchIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  dropdown.innerHTML = suggestions.map(s =>
    `<div class="suggestion-item" data-value="${escapeHtml(s)}">${searchIcon}<span>${escapeHtml(s)}</span></div>`
  ).join('');
  dropdown.classList.add('open');
  dropdown.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      input.value = item.dataset.value;
      dropdown.classList.remove('open');
      input.closest('form').submit();
    });
  });
}

/* ── Home Page ───────────────────────────────────────────────────────────── */

function initHomeSuggestions(inputId, dropdownId) {
  initSuggestionsUI(inputId, dropdownId);
}

function feelingLucky() {
  const q = document.getElementById('home-input')?.value.trim();
  if (!q) return;
  window.location.href = `results.html?q=${encodeURIComponent(q)}`;
}

/* ── Results Page ────────────────────────────────────────────────────────── */

function initResultsPage() {
  currentQuery = getParam('q');
  currentCategory = getParam('cat') || 'general';
  currentPage = parseInt(getParam('page')) || 1;
  currentTimeFilter = getParam('time') || 'any';

  const input = document.getElementById('results-input');
  if (input) input.value = currentQuery;

  document.title = currentQuery ? `${currentQuery} - SearchX` : 'SearchX';

  initSuggestionsUI('results-input', 'results-suggestions');
  setupClearButton();
  setupTabs();
  setupTimeFilter();

  if (currentQuery) {
    runSearch();
  }
}

function setupClearButton() {
  const input = document.getElementById('results-input');
  const clearBtn = document.getElementById('clear-btn');
  if (!input || !clearBtn) return;

  const update = () => {
    clearBtn.style.display = input.value ? 'flex' : 'none';
  };

  update();
  input.addEventListener('input', update);
  clearBtn.addEventListener('click', () => { input.value = ''; input.focus(); update(); });
}

function setupTabs() {
  document.querySelectorAll('.tab[data-cat]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.cat === currentCategory);
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      currentCategory = tab.dataset.cat;
      currentPage = 1;
      setParam({ cat: currentCategory === 'general' ? '' : currentCategory, page: '' });
      document.querySelectorAll('.tab[data-cat]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      runSearch();
    });
  });
}

function setupTimeFilter() {
  const btn = document.getElementById('time-filter-btn');
  const menu = document.getElementById('time-filter-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) menu.style.display = 'none';
  });
}

function setTimeFilter(range) {
  currentTimeFilter = range;
  currentPage = 1;
  setParam({ time: range === 'any' ? '' : range, page: '' });
  document.getElementById('time-filter-menu').style.display = 'none';
  document.getElementById('time-filter-btn').firstChild.textContent = range === 'any' ? 'Tools' : range.charAt(0).toUpperCase() + range.slice(1);
  runSearch();
}

/* ── Search execution ────────────────────────────────────────────────────── */

async function runSearch() {
  const q = currentQuery;
  if (!q) return;

  showLoader();

  try {
    const data = await fetchResults(q, currentCategory, currentPage, currentTimeFilter);
    renderAll(data, q);
  } catch (err) {
    showError(err.message);
  }
}

function showLoader() {
  const list = document.getElementById('results-list');
  const meta = document.getElementById('results-meta');
  const grid = document.getElementById('images-grid');
  if (meta) meta.textContent = '';
  if (grid) grid.style.display = 'none';
  if (list) {
    list.innerHTML = `<div class="results-loader">
      ${Array(5).fill(`
        <div class="skeleton-item">
          <div class="skeleton skeleton-url"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-snippet"></div>
          <div class="skeleton skeleton-snippet2"></div>
        </div>`).join('')}
    </div>`;
  }
  ['answer-box','infobox','suggestions-row'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showError(msg) {
  const list = document.getElementById('results-list');
  if (list) {
    list.innerHTML = `<div style="padding: 24px 0; color: #d93025; font-size: 15px;">
      <strong>Search error:</strong> ${escapeHtml(msg)}
      <p style="color: #70757a; margin-top: 8px; font-size: 13px;">Try again in a moment or check your connection.</p>
    </div>`;
  }
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

function renderAll(data, q) {
  renderMeta(data);
  renderAnswerBox(data);
  renderInfobox(data);
  renderSuggestionsRow(data);

  if (currentCategory === 'images') {
    renderImages(data.results || []);
  } else {
    renderResults(data.results || []);
  }

  renderSidebar(data);
  renderPagination(data, q);
}

function renderMeta(data) {
  const el = document.getElementById('results-meta');
  if (!el) return;
  const total = data.number_of_results;
  if (total) {
    el.textContent = `About ${total.toLocaleString()} results`;
  } else {
    el.textContent = '';
  }
}

function renderAnswerBox(data) {
  const el = document.getElementById('answer-box');
  if (!el) return;
  const answers = data.answers || [];
  if (!answers.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `<div class="answer-label">Answer</div>${escapeHtml(answers[0])}`;
}

function renderInfobox(data) {
  const el = document.getElementById('infobox');
  if (!el) return;
  const boxes = data.infoboxes || [];
  if (!boxes.length) { el.style.display = 'none'; return; }
  const box = boxes[0];
  const imgHtml = box.img_src ? `<img src="${escapeHtml(box.img_src)}" class="infobox-img" alt="" onerror="this.style.display='none'" />` : '';
  const links = (box.urls || []).map(u =>
    `<a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(u.title)}</a>`
  ).join('');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="infobox-title">${escapeHtml(box.infobox)}</div>
    <div class="infobox-type">${escapeHtml(box.entity || '')}</div>
    <div class="infobox-body">
      <div class="infobox-text">${escapeHtml(box.content || '').substring(0, 400)}${(box.content || '').length > 400 ? '...' : ''}</div>
      ${imgHtml}
    </div>
    ${links ? `<div class="infobox-links">${links}</div>` : ''}
  `;
}

function renderSuggestionsRow(data) {
  const el = document.getElementById('suggestions-row');
  if (!el) return;
  const suggestions = data.suggestions || [];
  if (!suggestions.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = suggestions.slice(0, 8).map(s =>
    `<button class="suggestion-pill" onclick="searchFor('${escapeHtml(s.replace(/'/g, "\\'"))}')">${escapeHtml(s)}</button>`
  ).join('');
}

function renderResults(results) {
  const list = document.getElementById('results-list');
  const grid = document.getElementById('images-grid');
  if (!list) return;
  if (grid) grid.style.display = 'none';
  list.style.display = 'block';

  if (!results.length) {
    list.innerHTML = `<div style="padding:20px 0;font-size:15px;color:#202124">
      No results found for <strong>${escapeHtml(currentQuery)}</strong>.<br>
      <span style="color:#70757a;font-size:13px">Try different keywords or check your spelling.</span>
    </div>`;
    return;
  }

  list.innerHTML = results.map(r => {
    const favicon = getFavicon(r.url);
    const domain = getDomain(r.url);
    const date = formatDate(r.publishedDate);
    return `
      <div class="result-item">
        <div class="result-source">
          <img class="result-favicon" src="${favicon}" alt="" onerror="this.style.display='none'" />
          <div>
            <div class="result-source-text">${escapeHtml(domain)}</div>
            <div class="result-source-domain">${escapeHtml(r.url.length > 70 ? r.url.substring(0, 70) + '...' : r.url)}</div>
          </div>
        </div>
        <a class="result-title" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
          ${r.title || 'Untitled'}
        </a>
        <div class="result-snippet">
          ${date ? `<span class="result-date">${escapeHtml(date)} —</span>` : ''}
          ${r.content ? escapeHtml(r.content) : ''}
        </div>
      </div>`;
  }).join('');
}

function renderImages(results) {
  const list = document.getElementById('results-list');
  const grid = document.getElementById('images-grid');
  if (list) list.style.display = 'none';
  if (!grid) return;

  const imgResults = results.filter(r => r.img_src || r.thumbnail_src);
  if (!imgResults.length) {
    grid.style.display = 'none';
    if (list) {
      list.style.display = 'block';
      list.innerHTML = `<div style="padding:20px 0;font-size:15px;color:#202124">No images found. Try a different search.</div>`;
    }
    return;
  }

  grid.style.display = 'grid';
  grid.innerHTML = imgResults.map(r => {
    const src = r.img_src || r.thumbnail_src;
    return `
      <div class="image-item" onclick="window.open('${escapeHtml(r.url)}','_blank')">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(r.title || '')}" loading="lazy" onerror="this.parentElement.style.display='none'" />
        <div class="image-caption">${escapeHtml(r.title || getDomain(r.url))}</div>
      </div>`;
  }).join('');
}

function renderSidebar(data) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = '';

  const boxes = data.infoboxes || [];
  if (!boxes.length) return;
  const box = boxes[0];

  const imgHtml = box.img_src
    ? `<img src="${escapeHtml(box.img_src)}" class="sidebar-card-img" alt="" onerror="this.style.display='none'" />`
    : '';

  const factsHtml = (box.attributes || []).slice(0, 6).map(attr =>
    `<div class="fact-row"><span class="fact-label">${escapeHtml(attr.label)}</span><span class="fact-value">${escapeHtml(attr.value)}</span></div>`
  ).join('');

  const linksHtml = (box.urls || []).map(u =>
    `<a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(u.title)}</a>`
  ).join('');

  sidebar.innerHTML = `
    <div class="sidebar-card">
      <div class="sidebar-card-header">
        <div class="sidebar-card-title">${escapeHtml(box.infobox)}</div>
        ${box.entity ? `<div class="sidebar-card-type">${escapeHtml(box.entity)}</div>` : ''}
      </div>
      ${imgHtml}
      ${box.content ? `<div class="sidebar-card-body">${escapeHtml(box.content.substring(0, 500))}${box.content.length > 500 ? '...' : ''}</div>` : ''}
      ${factsHtml ? `<div class="sidebar-card-facts">${factsHtml}</div>` : ''}
      ${linksHtml ? `<div class="sidebar-card-links">${linksHtml}</div>` : ''}
    </div>`;
}

function renderPagination(data, q) {
  const el = document.getElementById('pagination');
  if (!el) return;

  const total = data.number_of_results || 0;
  const perPage = 10;
  const totalPages = Math.min(Math.ceil(total / perPage), 10);

  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const logoHtml = `<span class="page-logo">
    <span class="logo-s">S</span><span class="logo-e">e</span><span class="logo-a">a</span><span class="logo-r">r</span>
  </span>`;

  let pages = '';
  for (let p = 1; p <= totalPages; p++) {
    const cls = p === currentPage ? 'page-btn active' : 'page-btn';
    pages += `<button class="${cls}" onclick="goToPage(${p})">${p}</button>`;
  }

  const prevBtn = currentPage > 1
    ? `<button class="page-nav" onclick="goToPage(${currentPage - 1})">← Previous</button>`
    : '';

  const nextBtn = currentPage < totalPages
    ? `<button class="page-nav" onclick="goToPage(${currentPage + 1})">Next →</button>`
    : '';

  el.innerHTML = `${prevBtn}${logoHtml}${pages}${nextBtn}`;
}

/* ── Navigation helpers ──────────────────────────────────────────────────── */

function goToPage(page) {
  currentPage = page;
  setParam({ page: page > 1 ? page : '' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  runSearch();
}

function searchFor(query) {
  currentQuery = query;
  currentPage = 1;
  const input = document.getElementById('results-input');
  if (input) input.value = query;
  document.title = `${query} - SearchX`;
  setParam({ q: query, page: '' });
  runSearch();
}
