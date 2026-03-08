(() => {
  const $ = (s, root = document) => root.querySelector(s);

  const state = {
    currentScreen: 'home',
    introVisible: true,
    discounts: {
      companyId: null,
      categoryId: null,
      q: '',
      inbox: []
    },
    underwriting: {
      companyId: null,
      categoryId: null,
      q: ''
    }
  };

  const SCREENS = {
    home: $('#homeScreen'),
    discounts: $('#discountsScreen'),
    underwriting: $('#underwritingScreen')
  };

  const HEADER = $('#appHeader');
  const TITLE = $('#appTitle');
  const INTRO = $('#introSplash');
  const HOME_SHELL = $('.home-shell');
  const HOME_ACTIONS = $('.home-actions');
  const RESOLVED_URL_CACHE = new Map();

  function byId(list, id) {
    return (list || []).find(x => x.id === id);
  }

  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    const params = new URLSearchParams(raw);
    return {
      screen: params.get('screen') || 'home',
      company: params.get('company'),
      cat: params.get('cat'),
      uwCompany: params.get('uwCompany'),
      uwCat: params.get('uwCat')
    };
  }

  function syncHash() {
    const params = new URLSearchParams();
    params.set('screen', state.currentScreen);

    if (state.discounts.companyId) params.set('company', state.discounts.companyId);
    if (state.discounts.categoryId) params.set('cat', state.discounts.categoryId);
    if (state.underwriting.companyId) params.set('uwCompany', state.underwriting.companyId);
    if (state.underwriting.categoryId) params.set('uwCat', state.underwriting.categoryId);

    const nextHash = params.toString();
    if (location.hash.replace(/^#/, '') !== nextHash) {
      location.hash = nextHash;
    }
  }

  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeToArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
  }

  function getCandidateFileNames(item) {
    return [...new Set([item.file, ...normalizeToArray(item.altFiles)])];
  }

  function getCandidateBasePaths(item, defaultBasePath) {
    const raw = [
      ...normalizeToArray(item.basePath),
      defaultBasePath,
      'assets/docs/',
      ''
    ];
    return [...new Set(raw
      .filter(v => typeof v === 'string')
      .map(v => {
        if (!v) return '';
        return v.endsWith('/') ? v : `${v}/`;
      }))];
  }

  function buildCandidateUrls(item, defaultBasePath = 'assets/docs/') {
    const files = getCandidateFileNames(item);
    const basePaths = getCandidateBasePaths(item, defaultBasePath);
    const urls = [];

    basePaths.forEach(basePath => {
      files.forEach(file => {
        urls.push(basePath + encodeURIComponent(file));
      });
    });

    return [...new Set(urls)];
  }

  async function urlExists(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res.ok) return true;
    } catch (e) {}

    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async function resolveWorkingUrl(item, defaultBasePath) {
    const cacheKey = JSON.stringify({
      file: item.file,
      altFiles: normalizeToArray(item.altFiles),
      basePath: normalizeToArray(item.basePath),
      defaultBasePath
    });

    if (RESOLVED_URL_CACHE.has(cacheKey)) {
      return RESOLVED_URL_CACHE.get(cacheKey);
    }

    const candidates = buildCandidateUrls(item, defaultBasePath);

    for (const url of candidates) {
      if (await urlExists(url)) {
        RESOLVED_URL_CACHE.set(cacheKey, url);
        return url;
      }
    }

    const fallbackUrl = candidates[0] || '';
    RESOLVED_URL_CACHE.set(cacheKey, fallbackUrl);
    return fallbackUrl;
  }

  async function openInViewer(item, viewerSelector, defaultBasePath) {
    const viewer = $(viewerSelector);
    if (!viewer) return;

    viewer.innerHTML = '<div class="notice">טוען קובץ...</div>';

    const url = await resolveWorkingUrl(item, defaultBasePath);

    if (!url) {
      viewer.innerHTML = '<div class="notice">לא נמצא קובץ להצגה.</div>';
      return;
    }

    if (item.type === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.loading = 'lazy';
      viewer.innerHTML = '';
      viewer.appendChild(iframe);
      return;
    }

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.title || '';
      viewer.innerHTML = '';
      viewer.appendChild(img);
      return;
    }

    if (item.type === 'doc') {
      viewer.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'notice';
      box.innerHTML = `קובץ Word: <a href="${url}" target="_blank" rel="noopener">פתח/הורד</a>`;
      viewer.appendChild(box);
      return;
    }

    viewer.innerHTML = '<div class="notice">אין תצוגה לקובץ הזה.</div>';
  }

  function setScreen(screen) {
    state.currentScreen = screen;

    Object.entries(SCREENS).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('hidden', key !== screen);
    });

    const isHome = screen === 'home';
    HEADER?.classList.toggle('hidden', isHome);

    if (screen === 'discounts') TITLE.textContent = 'מפרט הנחות ביטוח';
    else if (screen === 'underwriting') TITLE.textContent = 'טבלאות חיתום';
    else TITLE.textContent = 'ארגז הכלים של אינווסט';

    syncHash();
  }

  function finishIntro() {
    if (!state.introVisible) return;
    state.introVisible = false;
    INTRO?.classList.add('is-hidden');
    HOME_SHELL?.classList.add('is-ready');
    HOME_ACTIONS?.classList.add('is-ready');
    setScreen('home');
  }

  function startIntroSequence() {
    window.setTimeout(() => {
      finishIntro();
    }, 1900);
  }

  function getActiveCompany(dataSet, localState) {
    return byId(dataSet.companies, localState.companyId) || dataSet.companies[0] || null;
  }

  function getActiveCategory(company, localState) {
    return byId(company?.categories, localState.categoryId) || company?.categories?.[0] || null;
  }

  function renderCompanies({ dataSet, localState, pillsSelector, titleSelector, metaSelector, categoriesSelector, itemsSelector, catTitleSelector, viewerSelector, defaultBasePath }) {
    const pills = $(pillsSelector);
    if (!pills) return;

    pills.innerHTML = '';
    dataSet.companies.forEach(company => {
      const button = document.createElement('button');
      button.className = 'pill' + (company.id === localState.companyId ? ' active' : '');
      button.textContent = company.name;
      button.onclick = () => {
        localState.companyId = company.id;
        localState.categoryId = company.categories?.[0]?.id || null;
        renderSection({ dataSet, localState, pillsSelector, titleSelector, metaSelector, categoriesSelector, itemsSelector, catTitleSelector, viewerSelector, defaultBasePath });
        syncHash();
      };
      pills.appendChild(button);
    });

    const activeCompany = getActiveCompany(dataSet, localState);
    const activeCategory = getActiveCategory(activeCompany, localState);

    if ($(titleSelector)) $(titleSelector).textContent = activeCompany?.name || '—';
    if ($(metaSelector)) $(metaSelector).textContent = 'קטגוריות: ' + (activeCompany?.categories?.length || 0);

    const categoriesRoot = $(categoriesSelector);
    if (categoriesRoot) {
      categoriesRoot.innerHTML = '';
      (activeCompany?.categories || []).forEach(cat => {
        const button = document.createElement('button');
        button.className = 'cat' + (cat.id === activeCategory?.id ? ' active' : '');
        button.textContent = cat.name;
        button.onclick = () => {
          localState.categoryId = cat.id;
          renderSection({ dataSet, localState, pillsSelector, titleSelector, metaSelector, categoriesSelector, itemsSelector, catTitleSelector, viewerSelector, defaultBasePath });
          syncHash();
        };
        categoriesRoot.appendChild(button);
      });
    }

    renderItems({ dataSet, localState, itemsSelector, catTitleSelector, viewerSelector, defaultBasePath });
  }

  function renderItems({ dataSet, localState, itemsSelector, catTitleSelector, viewerSelector, defaultBasePath }) {
    const company = getActiveCompany(dataSet, localState);
    const category = getActiveCategory(company, localState);
    const list = $(itemsSelector);
    const catTitle = $(catTitleSelector);

    if (catTitle) catTitle.textContent = category?.name || '';
    if (!list) return;

    const q = (localState.q || '').trim().toLowerCase();
    const items = (category?.items || []).filter(item => !q || (item.title || '').toLowerCase().includes(q));

    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div class="notice">אין פריטים בקטגוריה הזו כרגע (או שאין התאמה לחיפוש).</div>';
      const viewer = $(viewerSelector);
      if (viewer) viewer.innerHTML = '<div class="notice">בחר פריט כדי לצפות בו.</div>';
      return;
    }

    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'item';

      const left = document.createElement('div');
      left.innerHTML = `<div class="title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml((item.type || '').toUpperCase())} • ${escapeHtml(item.file)}</div>`;

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'צפה';
      btn.onclick = () => openInViewer(item, viewerSelector, defaultBasePath);

      row.appendChild(left);
      row.appendChild(btn);
      list.appendChild(row);

      if (index === 0) {
        openInViewer(item, viewerSelector, defaultBasePath);
      }
    });
  }

  function renderInbox() {
    const box = $('#inbox');
    const count = $('#inboxCount');
    if (!box || !count) return;

    count.textContent = state.discounts.inbox.length ? `(${state.discounts.inbox.length})` : '';

    if (!state.discounts.inbox.length) {
      box.innerHTML = '<div class="small">כאן יופיעו הנחות שנשלחו מהמערכת (אם תבחר לשלוח אותן).</div>';
      return;
    }

    box.innerHTML = '';
    state.discounts.inbox.slice().reverse().forEach(d => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div>
          <div class="title">${escapeHtml(d.label || 'הנחה')}</div>
          <div class="meta">${escapeHtml(d.value || '')}</div>
        </div>
        <button class="btn" data-copy>העתק</button>
      `;
      div.querySelector('[data-copy]').onclick = async () => {
        const txt = `${d.label || ''}: ${d.value || ''}`.trim();
        try { await navigator.clipboard.writeText(txt); } catch (e) {}
      };
      box.appendChild(div);
    });
  }

  function renderSection(config) {
    renderCompanies(config);
    if (config === DISCOUNTS_CONFIG) renderInbox();
  }

  const DISCOUNTS_CONFIG = {
    dataSet: window.POLICY_SPEC_DATA,
    localState: state.discounts,
    pillsSelector: '#companyPills',
    titleSelector: '#companyTitle',
    metaSelector: '#companyMeta',
    categoriesSelector: '#catList',
    itemsSelector: '#items',
    catTitleSelector: '#catTitle',
    viewerSelector: '#viewer',
    defaultBasePath: 'assets/docs/'
  };

  const UNDERWRITING_CONFIG = {
    dataSet: window.UNDERWRITING_DATA,
    localState: state.underwriting,
    pillsSelector: '#uwCompanyPills',
    titleSelector: '#uwCompanyTitle',
    metaSelector: '#uwCompanyMeta',
    categoriesSelector: '#uwCatList',
    itemsSelector: '#uwItems',
    catTitleSelector: '#uwCatTitle',
    viewerSelector: '#uwViewer',
    defaultBasePath: 'assets/docs/'
  };

  function initStateFromHash() {
    const hash = parseHash();

    state.discounts.companyId = hash.company || window.POLICY_SPEC_DATA.companies?.[0]?.id || null;
    const discountsCompany = getActiveCompany(window.POLICY_SPEC_DATA, state.discounts);
    state.discounts.categoryId = hash.cat || discountsCompany?.categories?.[0]?.id || null;

    state.underwriting.companyId = hash.uwCompany || window.UNDERWRITING_DATA.companies?.[0]?.id || null;
    const uwCompany = getActiveCompany(window.UNDERWRITING_DATA, state.underwriting);
    state.underwriting.categoryId = hash.uwCat || uwCompany?.categories?.[0]?.id || null;

    setScreen('home');
  }

  function bindEvents() {
    $('#openDiscountsBtn')?.addEventListener('click', () => {
      setScreen('discounts');
      renderSection(DISCOUNTS_CONFIG);
    });

    $('#openUwBtn')?.addEventListener('click', () => {
      setScreen('underwriting');
      renderSection(UNDERWRITING_CONFIG);
    });

    $('#goHomeBtn')?.addEventListener('click', () => setScreen('home'));

    $('#q')?.addEventListener('input', event => {
      state.discounts.q = event.target.value || '';
      renderItems(DISCOUNTS_CONFIG);
    });

    $('#uwq')?.addEventListener('input', event => {
      state.underwriting.q = event.target.value || '';
      renderItems(UNDERWRITING_CONFIG);
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'policySpec:discounts') {
        const arr = Array.isArray(msg.discounts) ? msg.discounts : [];
        state.discounts.inbox = arr.map(x => ({
          label: x.label ?? x.name ?? 'הנחה',
          value: x.value ?? x.text ?? ''
        }));
        renderInbox();
      }

      if (msg.type === 'policySpec:open') {
        if (msg.companyId) state.discounts.companyId = msg.companyId;
        const company = getActiveCompany(window.POLICY_SPEC_DATA, state.discounts);
        state.discounts.categoryId = msg.categoryId || company?.categories?.[0]?.id || null;
        setScreen('discounts');
        renderSection(DISCOUNTS_CONFIG);
      }
    });

    window.addEventListener('hashchange', () => {
      const hash = parseHash();
      if (hash.company) state.discounts.companyId = hash.company;
      if (hash.cat) state.discounts.categoryId = hash.cat;
      if (hash.uwCompany) state.underwriting.companyId = hash.uwCompany;
      if (hash.uwCat) state.underwriting.categoryId = hash.uwCat;

      if (hash.screen && hash.screen !== state.currentScreen && !state.introVisible) {
        setScreen(['home', 'discounts', 'underwriting'].includes(hash.screen) ? hash.screen : 'home');
      }
    });
  }

  function init() {
    initStateFromHash();
    bindEvents();
    renderSection(DISCOUNTS_CONFIG);
    renderSection(UNDERWRITING_CONFIG);
    startIntroSequence();
  }

  init();
})();
