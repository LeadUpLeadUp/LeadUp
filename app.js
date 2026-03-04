
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  const data = window.POLICY_SPEC_DATA;
  const state = {
    companyId: null,
    categoryId: null,
    q: '',
    inbox: [] // discounts pushed from CRM
  };

  function byId(list, id){ return list.find(x => x.id === id); }

  function parseHash(){
    const h = location.hash.replace(/^#/, '');
    const params = new URLSearchParams(h);
    return {
      company: params.get('company'),
      cat: params.get('cat')
    };
  }

  function setHash(companyId, categoryId){
    const params = new URLSearchParams();
    if(companyId) params.set('company', companyId);
    if(categoryId) params.set('cat', categoryId);
    location.hash = params.toString();
  }

  function renderCompanies(){
    const pills = $('#companyPills');
    pills.innerHTML = '';
    data.companies.forEach(c => {
      const b = document.createElement('button');
      b.className = 'pill' + (c.id === state.companyId ? ' active':'' );
      b.textContent = c.name;
      b.onclick = () => {
        state.companyId = c.id;
        const firstCat = c.categories.find(k => true);
        state.categoryId = firstCat ? firstCat.id : null;
        setHash(state.companyId, state.categoryId);
        renderAll();
      };
      pills.appendChild(b);
    });
  }

  function renderCategories(){
    const company = byId(data.companies, state.companyId) || data.companies[0];
    if(!company) return;
    $('#companyTitle').textContent = company.name;
    const catList = $('#catList');
    catList.innerHTML = '';
    company.categories.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'cat' + (cat.id === state.categoryId ? ' active':'' );
      b.textContent = cat.name;
      b.onclick = () => {
        state.categoryId = cat.id;
        setHash(state.companyId, state.categoryId);
        renderAll();
      };
      catList.appendChild(b);
    });
    $('#companyMeta').textContent = 'קטגוריות: ' + company.categories.length;
  }

  function matchesQuery(item){
    const q = state.q.trim().toLowerCase();
    if(!q) return true;
    return (item.title || '').toLowerCase().includes(q);
  }

  function fileUrl(file){
    return 'assets/docs/' + encodeURIComponent(file);
  }

  function openInViewer(item){
    const viewer = $('#viewer');
    viewer.innerHTML = '';
    const url = fileUrl(item.file);
    if(item.type === 'pdf' || item.type === 'doc'){
      const iframe = document.createElement('iframe');
      // for docx, let browser download/open; show link instead
      if(item.type === 'doc'){
        const box = document.createElement('div');
        box.className = 'notice';
        box.innerHTML = `קובץ Word: <a href="${url}" target="_blank" rel="noopener">פתח/הורד</a>`;
        viewer.appendChild(box);
        return;
      }
      iframe.src = url;
      viewer.appendChild(iframe);
      return;
    }
    if(item.type === 'image'){
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.title || '';
      viewer.appendChild(img);
      return;
    }
    const box = document.createElement('div');
    box.className = 'notice';
    box.textContent = 'אין תצוגה לקובץ הזה.';
    viewer.appendChild(box);
  }

  function renderItems(){
    const company = byId(data.companies, state.companyId) || data.companies[0];
    if(!company) return;
    const cat = byId(company.categories, state.categoryId) || company.categories[0];
    $('#catTitle').textContent = cat ? cat.name : '';
    const list = $('#items');
    list.innerHTML = '';

    const items = (cat?.items || []).filter(matchesQuery);
    if(!items.length){
      list.innerHTML = `<div class="notice">אין פריטים בקטגוריה הזו כרגע (או שאין התאמה לחיפוש).</div>`;
      $('#viewer').innerHTML = `<div class="notice">בחר פריט כדי לצפות בו.</div>`;
      return;
    }

    items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'item';
      const left = document.createElement('div');
      left.innerHTML = `<div class="title">${it.title}</div><div class="meta">${(it.type||'').toUpperCase()} • ${it.file}</div>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'צפה';
      btn.onclick = () => openInViewer(it);
      row.appendChild(left);
      row.appendChild(btn);
      list.appendChild(row);
      if(idx === 0){
        openInViewer(it);
      }
    });
  }

  function renderInbox(){
    const box = $('#inbox');
    const count = $('#inboxCount');
    count.textContent = state.inbox.length ? `(${state.inbox.length})` : '';
    if(!state.inbox.length){
      box.innerHTML = `<div class="small">כאן יופיעו הנחות שנשלחו מהמערכת (אם תבחר לשלוח אותן).</div>`;
      return;
    }
    box.innerHTML = '';
    state.inbox.slice().reverse().forEach(d => {
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
        const txt = `${d.label||''}: ${d.value||''}`.trim();
        try{ await navigator.clipboard.writeText(txt); }catch(e){}
      };
      box.appendChild(div);
    });
  }

  function escapeHtml(s){
    return (s ?? '').toString()
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function renderAll(){
    renderCompanies();
    renderCategories();
    renderItems();
    renderInbox();
  }

  function init(){
    const h = parseHash();
    state.companyId = h.company || data.companies[0]?.id || null;
    const company = byId(data.companies, state.companyId) || data.companies[0];
    state.categoryId = h.cat || company?.categories[0]?.id || null;

    $('#q').addEventListener('input', (e) => {
      state.q = e.target.value || '';
      renderItems();
    });

    window.addEventListener('message', (event) => {
      // accept messages from anywhere (GitHub Pages); if you want, lock this to your domain later.
      const msg = event.data;
      if(!msg || typeof msg !== 'object') return;

      if(msg.type === 'policySpec:discounts'){
        const arr = Array.isArray(msg.discounts) ? msg.discounts : [];
        state.inbox = arr.map(x => ({
          label: x.label ?? x.name ?? 'הנחה',
          value: x.value ?? x.text ?? ''
        }));
        renderInbox();
      }
      if(msg.type === 'policySpec:open'){
        const {companyId, categoryId} = msg;
        if(companyId) state.companyId = companyId;
        const c = byId(data.companies, state.companyId) || data.companies[0];
        if(categoryId) state.categoryId = categoryId;
        else state.categoryId = c?.categories[0]?.id || null;
        setHash(state.companyId, state.categoryId);
        renderAll();
      }
    });

    renderAll();
  }

  init();
})();
