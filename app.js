(() => {
  const $ = (s, root = document) => root.querySelector(s);

  const state = {
    currentScreen: 'home',
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

    location.hash = params.toString();
  }

  function fileUrl(item, basePath = 'assets/docs/') {
    const normalizedBase = typeof item.basePath === 'string' ? item.basePath : basePath;
    return normalizedBase + encodeURIComponent(item.file);
  }

  function escapeHtml(s) {
    return (s ?? '').toString()
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function openInViewer(item, viewerSelector, defaultBasePath) {
    const viewer = $(viewerSelector);
    if (!viewer) return;

    viewer.innerHTML = '';
    const url = fileUrl(item, defaultBasePath);

    if (item.type === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.loading = 'lazy';
      viewer.appendChild(iframe);
      return;
    }

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.title || '';
      viewer.appendChild(img);
      return;
    }

    if (item.type === 'doc') {
      const box = document.createElement('div');
      box.className = 'notice';
      box.innerHTML = `קובץ Word: <a href="${url}" target="_blank" rel="noopener">פתח/הורד</a>`;
      viewer.appendChild(box);
      return;
    }

    const box = document.createElement('div');
    box.className = 'notice';
    box.textContent = 'אין תצוגה לקובץ הזה.';
    viewer.appendChild(box);
  }

  function setScreen(screen) {
    state.currentScreen = screen;

    Object.entries(SCREENS).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('hidden', key !== screen);
    });

    const isHome = screen === 'home';
    HEADER.classList.toggle('hidden', isHome);

    if (screen === 'discounts') TITLE.textContent = 'מפרט הנחות ביטוח';
    else if (screen === 'underwriting') TITLE.textContent = 'טבלאות חיתום';
    else TITLE.textContent = 'מרכז מסמכי ביטוח';

    syncHash();
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
      btn.onclick = () => openInViewer({ ...item, basePath: item.basePath ?? dataSet.basePath ?? defaultBasePath }, viewerSelector, defaultBasePath);

      row.appendChild(left);
      row.appendChild(btn);
      list.appendChild(row);

      if (index === 0) {
        openInViewer({ ...item, basePath: item.basePath ?? dataSet.basePath ?? defaultBasePath }, viewerSelector, defaultBasePath);
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
    defaultBasePath: ''
  };

  function initStateFromHash() {
    const hash = parseHash();

    state.discounts.companyId = hash.company || window.POLICY_SPEC_DATA.companies?.[0]?.id || null;
    const discountsCompany = getActiveCompany(window.POLICY_SPEC_DATA, state.discounts);
    state.discounts.categoryId = hash.cat || discountsCompany?.categories?.[0]?.id || null;

    state.underwriting.companyId = hash.uwCompany || window.UNDERWRITING_DATA.companies?.[0]?.id || null;
    const uwCompany = getActiveCompany(window.UNDERWRITING_DATA, state.underwriting);
    state.underwriting.categoryId = hash.uwCat || uwCompany?.categories?.[0]?.id || null;

    const screen = ['home', 'discounts', 'underwriting'].includes(hash.screen) ? hash.screen : 'home';
    setScreen(screen);
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
      if (hash.screen && hash.screen !== state.currentScreen) {
        state.currentScreen = hash.screen;
        Object.entries(SCREENS).forEach(([key, el]) => el.classList.toggle('hidden', key !== hash.screen));
        HEADER.classList.toggle('hidden', hash.screen === 'home');
      }
    });
  }

  function init() {
    initStateFromHash();
    bindEvents();
    renderSection(DISCOUNTS_CONFIG);
    renderSection(UNDERWRITING_CONFIG);
  }

  init();
})();
