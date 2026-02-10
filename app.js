/* ===== GOOGLE SHEETS CONNECTION ===== */

const GOOGLE_SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbznkLG4jzYBbJ29PF4MO2zopC4azqCWTN7LInPUQoA74rwOWwgBDNUrerWxsfC4zwaSfA/exec";

console.log("Sheets URL:", GOOGLE_SCRIPT_URL);

/* ===== API CALL ===== */
async function api(action, payload = {}) {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload })
    });

    const data = await res.json();
    return data;

  } catch (err) {
    console.error("API ERROR:", err);
    alert("אין חיבור לשרת Google Sheets");
    return { ok:false };
  }
}

/* ===== PING ===== */
async function testConnection(){
  try{
    const r = await fetch(`${GOOGLE_SCRIPT_URL}?action=ping`);
    const j = await r.json();

    if(j.ok){
      alert("🟢 מחובר לגוגל שיטס");
    }else{
      alert("🔴 אין חיבור");
    }
  }catch(e){
    alert("🔴 שגיאת חיבור");
    console.error(e);
  }
}

/* ===== BUTTON CONNECT ===== */
window.addEventListener("load", ()=>{
  const btn =
    document.querySelector('[data-test="google"]') ||
    document.querySelector('#testGoogle') ||
    document.querySelector('.test-connection');

  if(btn){
    btn.addEventListener("click", testConnection);
    console.log("button connected");
  } else {
    console.log("no test button found");
  }
});

console.log("APP JS LOADED");
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbznkLG4jzYBbJ29PF4MO2zopC4azqCWTN7LInPUQoA74rwOWwgBDNUrerWxsfC4zwaSfA/exec";
/* GEMEL INVEST • Demo CRM (No backend) */
(() => {
  'use strict';
  // ---------- CONFIG (Google Sheets via Apps Script Web App) ----------
  // 1) Publish your Apps Script as Web App (Anyone with the link).
  // 2) Paste the /exec URL here. Example:
  // const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhj4z2KPlhG0eMvFW3CL9aogdxq02oQgwVZkmVcXIjgzLkyw7lYzIfdJlB7Hi8ogmWZg/exec';
 
  // If true, the app will try to auto-connect on load (ping).
  const AUTO_CONNECT = true;

  // ---------- Server helpers ----------
  async function apiCall(action, payload){
    if(!GOOGLE_SCRIPT_URL) return { ok:false, demo:true, error:'NO_URL' };
    const url = GOOGLE_SCRIPT_URL + '?action=' + encodeURIComponent(action);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ payload })
    });
    const data = await res.json().catch(() => null);
    if(!data) return { ok:false, error:'BAD_JSON' };
    return data;
  }

  async function apiPing(){
    if(!GOOGLE_SCRIPT_URL) return { ok:false, demo:true };
    try{
      const url = GOOGLE_SCRIPT_URL + '?action=ping';
      const res = await fetch(url, { method:'GET' });
      const data = await res.json().catch(() => null);
      return data || { ok:false };
    }catch(e){
      return { ok:false, error:String(e) };
    }
  }


  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- Demo data ----------
  const state = {
    currentUser: null,
    connected: false,
    server: { url: '' },
    agentName: 'אוריה (דמו)',
    teamAgents: ['אוריה (דמו)','סתיו','דוד'],
    customers: [
      { id:'c1', assignedAgent:'אוריה (דמו)', fullName:'דניאל כהן', tz:'123456789', phone:'050-1234567', email:'daniel@mail.com', status:'פעיל', segment:'פרימיום' },
      { id:'c2', assignedAgent:'סתיו', fullName:'נועה לוי', tz:'987654321', phone:'052-7654321', email:'noa@mail.com', status:'חדש', segment:'ליד' },
      { id:'c3', assignedAgent:'דוד', fullName:'יוסי מזרחי', tz:'314159265', phone:'054-5551234', email:'yossi@mail.com', status:'פעיל', segment:'סטנדרט' },
    ],
    proposals: [],
    processes: []
  };

  // ---------- Processes (Tasks) ----------
  const PROCESS_TYPES = ['הצעה חדשה','שיקוף','גביה'];
  const PROCESSES_LS_KEY = 'gemel_processes_v1';

  function loadProcesses_(){
    try{
      const raw = localStorage.getItem(PROCESSES_LS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr)) state.processes = arr;
    }catch(_){}
  }
  function saveProcesses_(){
    try{
      localStorage.setItem(PROCESSES_LS_KEY, JSON.stringify(state.processes || []));
    }catch(_){}
  }
  function uid_(){
    return 'pr_' + Math.random().toString(36).slice(2,10) + '_' + Date.now().toString(36);
  }
  function toLocalDateTimeValue_(iso){
    if(!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2,'0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalDateTimeValue_(val){
    // val like "2026-02-09T14:30"
    if(!val) return '';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  function dueStatus_(iso){
    if(!iso) return { cls:'', text:'—' };
    const now = Date.now();
    const t = new Date(iso).getTime();
    if(isNaN(t)) return { cls:'', text:'—' };
    const diffMin = Math.floor((t - now) / 60000);
    if(diffMin < 0) return { cls:'bad', text:'חורג' };
    if(diffMin <= 60) return { cls:'warn', text:'מגיע בקרוב' };
    return { cls:'', text:'מתוזמן' };
  }
  function fmtDue_(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    if(isNaN(d.getTime())) return '—';
    return d.toLocaleString('he-IL');
  }

  function openProcessModal_(customerId){
    const c = state.customers.find(x => x.id === customerId);
    if(!c) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,.35)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = `
      <div style="width:min(720px,92vw);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:18px 18px 14px;direction:rtl;font-family:inherit">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
          <div>
            <div style="font-weight:900;font-size:16px">צור תהליך</div>
            <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(c.fullName||'')} • ${escapeHtml(c.phone||'')}</div>
          </div>
          <button class="btn btnSoft" data-x>סגור</button>
        </div>

        <div style="display:grid;grid-template-columns: 1fr 1fr;gap:10px">
          <div>
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">בחירת תהליך</div>
            <select id="procType" class="input" style="width:100%">
              ${PROCESS_TYPES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">תאריך ושעה</div>
            <input id="procDue" class="input" style="width:100%" type="datetime-local" value="${toLocalDateTimeValue_(new Date(Date.now()+30*60000).toISOString())}">
          </div>
          <div style="grid-column:1 / -1">
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">הערה (אופציונלי)</div>
            <input id="procNote" class="input" style="width:100%" type="text" placeholder="לדוגמה: לשלוח הצעה מעודכנת / לבדוק מסמכים">
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
          <button class="btn btnSoft" data-cancel>ביטול</button>
          <button class="btn" data-save>שמור תהליך</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) close();
    });
    overlay.querySelector('[data-x]')?.addEventListener('click', close);
    overlay.querySelector('[data-cancel]')?.addEventListener('click', close);

    overlay.querySelector('[data-save]')?.addEventListener('click', () => {
      const type = String(overlay.querySelector('#procType')?.value || '').trim();
      const dueVal = String(overlay.querySelector('#procDue')?.value || '').trim();
      const note = String(overlay.querySelector('#procNote')?.value || '').trim();
      const dueAt = fromLocalDateTimeValue_(dueVal);

      if(!type){
        toast('חסר', 'בחר סוג תהליך');
        return;
      }
      if(!dueAt){
        toast('חסר', 'בחר תאריך ושעה');
        return;
      }

      const proc = {
        id: uid_(),
        customerId: c.id,
        customerName: c.fullName || '',
        type,
        note,
        dueAt,
        assignedTo: state.agentName || '',
        status: 'open',
        createdAt: new Date().toISOString()
      };
      state.processes.unshift(proc);
      saveProcesses_();
      close();
      toast('נשמר', 'תהליך נוסף ל"התהליכים שלי"');
      render();
    });
  }

  function renderDueProcessesForAgent_(agent){
    const now = Date.now();
    const list = (state.processes||[])
      .filter(p => (p.status||'open') === 'open' && (p.assignedTo||'') === agent && p.dueAt)
      .slice()
      .sort((a,b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const dueNow = list.filter(p => new Date(p.dueAt).getTime() <= now);
    const upcoming = list.filter(p => new Date(p.dueAt).getTime() > now).slice(0,6);
    const top = dueNow.length ? dueNow : upcoming;

    if(!top.length){
      return `<div class="sideHint">אין תהליכים מתוזמנים כרגע.</div>`;
    }

    return `
      <div class="panel" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
          <div style="font-weight:900">תהליכים שמגיעים עכשיו</div>
          <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(agent||'')}</div>
        </div>
        <div class="tableWrap" style="box-shadow:none;padding:0;background:transparent;border:none">
          <table class="table">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>תהליך</th>
                <th>מועד</th>
                <th>סטטוס</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${top.map(p => {
                const st = dueStatus_(p.dueAt);
                return `
                  <tr>
                    <td><b>${escapeHtml(p.customerName||'')}</b><div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml((state.customers.find(c=>c.id===p.customerId)||{}).phone||'')}</div></td>
                    <td>${escapeHtml(p.type||'')}</td>
                    <td>${escapeHtml(fmtDue_(p.dueAt))}${p.note?`<div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(p.note)}</div>`:''}</td>
                    <td>${chip(st.text, st.cls||'')}</td>
                    <td style="text-align:left;white-space:nowrap">
                      <button class="btn btnSoft" data-proc-open="${escapeAttr(p.customerId)}">פתח</button>
                      <button class="btn btnTiny" data-proc-done="${escapeAttr(p.id)}">בוצע</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function wireProcessButtons_(){
    $$('[data-proc-open]').forEach(b => b.addEventListener('click', () => openWizard({ customerId: b.dataset.procOpen })));
    $$('[data-proc-done]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.procDone;
      const p = (state.processes||[]).find(x => x.id === id);
      if(!p) return;
      p.status = 'done';
      p.doneAt = new Date().toISOString();
      saveProcesses_();
      toast('עודכן', 'סומן כבוצע');
      render();
    }));
  }

  // ---------- AUTH (Local demo users; can be moved to Google Sheets later) ----------
  const USERS = [
    { username:'admin', password:'3316', role:'admin', displayName:'מנהל מערכת' },
    { username:'agent1', password:'1111', role:'agent', displayName:'אוריה (דמו)' },
    { username:'agent2', password:'2222', role:'agent', displayName:'סתיו' },
    { username:'agent3', password:'3333', role:'agent', displayName:'דוד' },
  ];

  function getSessionUser_(){
    try{
      const raw = sessionStorage.getItem('gemel_user');
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }
  function setSessionUser_(u){
    sessionStorage.setItem('gemel_user', JSON.stringify(u));
  }
  function clearSessionUser_(){
    sessionStorage.removeItem('gemel_user');
  }
  function isAdmin_(){ return !!(state.currentUser && state.currentUser.role === 'admin'); }

  function applyPermissions_(){
    // update badge name
    const badgeNameEl = document.getElementById('agentName');
    if(badgeNameEl){
      badgeNameEl.textContent = 'נציג: ' + (state.agentName || 'אורח');
    }
    // hide settings for agents
    const settingsBtn = document.querySelector('.navItem[data-route="settings"]');
    if(settingsBtn){
      settingsBtn.style.display = isAdmin_() ? '' : 'none';
    }
  }
  function visibleCustomers_(){
    if(isAdmin_()) return state.customers;
    const me = state.agentName;
    return state.customers.filter(c => (c.assignedAgent || '') === me);
  }
  function visibleProposals_(){
    if(isAdmin_()) return state.proposals;
    const me = state.agentName;
    return state.proposals.filter(p => (p.assignedAgent || p.agentName || '') === me);
  }



  // Questionnaire mapping (DEFAULT: Medical form for each insured)
    const questionnaires = {
    'DEFAULT|MEDICAL': {
      title: 'שאלון רפואי (לכל מבוטח)',
      steps: [
        { id:'general', title:'פרטים כלליים', questions:[
          qYesNo('smoking', 'האם המבוטח מעשן?', {details:true, detailsLabel:'פירוט (כמה/כמה זמן)'}),
          qYesNo('meds', 'האם המבוטח נוטל תרופות קבועות?', {details:true, detailsLabel:'פירוט תרופות'}),
          qYesNo('hosp5', 'האם היו אשפוזים/ניתוחים ב־5 השנים האחרונות?', {details:true, detailsLabel:'פירוט'})
        ]},
        { id:'medical', title:'מצב רפואי', questions:[
          qYesNo('sys_neuro', 'מערכת העצבים והמוח — טרשת נפוצה, תסמונת דאון, אוטיזם, גושה, ניווון שרירים, אפילפסיה, פרקינסון, שיתוק, קשב וריכוז, בעיות התפתחות (תינוק אם נולד פג)', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('sys_cardio', 'מערכת הלב וכלי דם — לב, כלי דם, אירוע מוחי, יתר לחץ דם, מחלות דם ובעיות קרישה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('mental', 'בעיה / הפרעה ו/או מחלה נפשית מאובחנת וניסיונות התאבדות', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('metabolic', 'מערכת מטבולית — סוכרת כולל הריון, שומנים, כולסטרול, בלוטת מגן/מוח/יתר-תרת הכליה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('cancer', 'מחלה ממאירה — גידולים לרבות גידול שפיר, סרטני וטרום סרטני', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('digestive', 'מערכת העיכול — קיבה, מעיים, קרוהן, קוליטיס, כיס המרה, טחול, לבלב, פי הטבעת, כבד, צהבת', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('resp', 'מערכת ריאות ודרכי נשימה — לרבות אסטמה, ברונכיטיס, COPD, זום נשימה, סיסטיק פיברוזיס, שחפת, אלרגיות', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('rheuma', 'מחלות ראומטולוגיות — רקומות חיבור ודלקות פרקים, גאוט, לופוס/זאבת, פיברומיאלגיה, קדחת ים תיכונית', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('ortho', 'אורטופדיה ומערכת השלד — עמוד שדרה, שרירים, מפרקים, מחלות פרקים, בעיות ברכיים, שבר, פריקה, פגיעה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('bones', 'גידים / אוסטאופורוזיס — אוסטאופורוזיס/אוסטיאופניה, מחלת פרקים ניוונית', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('eyes', 'מערכת עיניים וראייה — ליקויי ראייה מעל מספר 8 בעדשות, הפרדת רשתית, גלאוקומה, קטרקט, אובאיטיס, קרטוקונוס', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('ent', 'מערכת אף אוזן גרון — פגיעה בשמיעה, דלקות אוזניים, מנייר, טיניטון, פוליפים, שקדים, פגיעה במיתרי הקול', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('skin_sex', 'עור ומין — מחלות עור ואלרגיה, פסוריאזיס, מפמפיגוס, צלקות, נגע ו/או גידול בעור, פפילומה, קונדילומה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('std_hiv', 'מחלות מין ואיידס — נשא HIV ומחלות זיהומיות שאובחנו בשנה האחרונה ודורשות טיפול רציף של חודשים לפחות', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('women', 'לנשים — בעיות גינקולוגיות ושדיים, הגדלה/הקטנה, גוש בשד, דימומים, רחם שרירני, ציסטות שחלתיות, האם כעת בהריון', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('men', 'לגברים — בעיות ערמונית, פרוסטטה ואשכים', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('substances', 'אלכוהול / סמים / עישון — אלכוהול, סמים, היסטוריה משפחתית (ממא/אבא אחים אחיות - מחלות תורשתיות), אחוזי נכות, תהליך בירור רפואי או בדיקות אבחנתיות שטרם הסתיימו סופית', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('hosp_meds', 'אשפוזים / ניתוחים / טיפול תרופתי קבוע — אשפוזים או ניתוחים ב-5 שנים האחרונות, טיפול תרופתי באופן קבוע', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
        ]},
        { id:'decl', title:'הצהרות', questions:[
          qYesNo('truth', 'אני מאשר/ת שכל הפרטים שמולאו נכונים ומלאים.'),
          qText('notes', 'הערות כלליות')
        ]},
        { id:'sum', title:'סיכום', questions:[] }
      ]
    }
  };


  function qYesNo(id, label, opt={}){
    return { type:'yesno', id, label, details: !!opt.details, detailsLabel: opt.detailsLabel || 'פירוט' };
  }
  function qText(id, label){
    return { type:'text', id, label };
  }

  // ---------- UI references ----------
  const agentNameEl = $('#agentName');
  const loginOverlay = $('#loginOverlay');
  const loginForm = $('#loginForm');
  const loginUser = $('#loginUser');
  const loginPass = $('#loginPass');
  const loginError = $('#loginError');
  const logoutBtn = $('#logoutBtn');
  const kpisEl = $('#kpis');
  const tabsEl = $('#tabs');
  const viewEl = $('#view');
  const pageTitleEl = $('#pageTitle');
  const crumbEl = $('#crumb');
  const globalSearch = $('#globalSearch');
  const searchBtn = $('#searchBtn');
  const newProposalBtn = $('#newProposalBtn');

  // Wizard
  const wizardOverlay = $('#wizardOverlay');
  const wizardCloseBtn = $('#wizardCloseBtn');
  const statusSelect = $('#statusSelect');

  const wizardMain = $('#wizardMain');
  const stepperEl = $('#stepper');
  const insuredTabsEl = $('#insuredTabs');
  const insuredIndicatorEl = $('#insuredIndicator');
  const nextStepBtn = $('#nextStepBtn');
  const prevStepBtn = $('#prevStepBtn');
  const savePill = $('#savePill');
  const sumOld = $('#sumOld');
  const sumNew = $('#sumNew');
  const sumTotal = $('#sumTotal');
  const compHost = $('#compHost');

  const toastHost = $('#toastHost');

  // ---------- Login UI ----------
  function showLogin_(){
    document.body.classList.add('isLoggedOut');
    if(loginOverlay) loginOverlay.classList.remove('hidden');
    if(loginError) { loginError.textContent = ''; loginError.classList.add('hidden'); }
    if(loginUser) loginUser.focus();
    applyPermissions_();
  }
  function hideLogin_(){
    document.body.classList.remove('isLoggedOut');
    if(loginOverlay) loginOverlay.classList.add('hidden');
    applyPermissions_();
  }

  function tryLogin_(username, password){
    const u = USERS.find(x => x.username === username && x.password === password);
    if(!u) return { ok:false, msg:'שם משתמש או סיסמה שגויים' };
    const safe = { username:u.username, role:u.role, displayName:u.displayName };
    state.currentUser = safe;
    state.agentName = u.displayName;
    setSessionUser_(safe);
    hideLogin_();
    // After login, always route to customers
    setRoute('customers');
    return { ok:true };
  }

  function doLogout_(){
    clearSessionUser_();
    state.currentUser = null;
    state.agentName = 'אורח';
    showLogin_();
  }

  if(logoutBtn){
    logoutBtn.addEventListener('click', doLogout_);
  }

  if(loginForm){
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = String(loginUser?.value || '').trim();
      const password = String(loginPass?.value || '').trim();
      const res = tryLogin_(username, password);
      if(!res.ok){
        if(loginError){
          loginError.textContent = res.msg || 'שגיאה בהתחברות';
          loginError.classList.remove('hidden');
        }
      }
    });
  }



  // ---------- Routing ----------
  let route = 'customers';
  let tab = 'table';

  function setRoute(r){
    route = r;
    $$('.navItem').forEach(b => b.classList.toggle('active', b.dataset.route === r));
    render();
  }

  $$('.navItem').forEach(b => b.addEventListener('click', () => setRoute(b.dataset.route)));

  // ---------- Boot: restore session or require login ----------
  (function bootAuth_(){
    const u = getSessionUser_();
    if(u){
      state.currentUser = u;
      state.agentName = u.displayName || state.agentName;
      hideLogin_();
    }else{
      showLogin_();
    }
  })();


  // ---------- Render ----------
  function render(){
    agentNameEl.textContent = 'נציג: ' + state.agentName;

    // Tabs bar: default visible, but hide on Customers (no need for רשימה/סגמנטים right now)
    if(tabsEl){
      tabsEl.style.display = '';
    }

    if(route === 'customers'){
      pageTitleEl.textContent = 'לקוחות';
      crumbEl.textContent = 'Overview';
      renderKpisCustomers();
      tab = 'table';
      if(tabsEl){ tabsEl.innerHTML = ''; tabsEl.style.display = 'none'; }
      renderCustomersTable(visibleCustomers_());
    }
    if(route === 'my'){
      pageTitleEl.textContent = 'התהליכים שלי';
      crumbEl.textContent = 'Assigned';
      renderKpisMy();
      renderTabs(['table'], { table:'משויכים אליי' });
      renderMyProcesses();
    }
    if(route === 'proposals'){
      pageTitleEl.textContent = 'הצעות';
      crumbEl.textContent = 'Overview';
      renderKpisProposals();
      renderTabs(['table'], { table:'רשימה' });
      renderProposalsTable(visibleProposals_());
    }
    if(route === 'settings'){
      pageTitleEl.textContent = 'הגדרות';
      crumbEl.textContent = 'System';
      renderKpisSettings();
      renderTabs(['general'], { general:'כללי' });
      renderSettings();
    }
  }

  function renderTabs(keys, labels){
    tabsEl.innerHTML = keys.map(k => (
      `<button class="tab ${k===tab?'active':''}" data-tab="${k}">${labels[k]||k}</button>`
    )).join('');
    $$('.tab', tabsEl).forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }));
  }

  function kpiCard(label, value, hint){
    return `<div class="kpi"><div class="kpiLabel">${escapeHtml(label)}</div><div class="kpiValue">${escapeHtml(String(value))}</div><div class="kpiHint">${escapeHtml(hint||'')}</div></div>`;
  }

  function renderKpisCustomers(){
    const total = state.customers.length;
    const active = state.customers.filter(c => c.status === 'פעיל').length;
    const leads = state.customers.filter(c => c.segment === 'ליד').length;
    kpisEl.innerHTML = [
      kpiCard('סה״כ לקוחות', total, 'כל הרשומות במערכת'),
      kpiCard('פעילים', active, 'לקוחות בטיפול/פעילים'),
      kpiCard('לידים', leads, 'שייכים לסגמנט ליד'),
    ].join('');
  }

  function renderKpisProposals(){
    const total = state.proposals.length;
    const open = state.proposals.filter(p => p.status === 'טיוטה' || p.status === 'נפתח').length;
    const done = state.proposals.filter(p => p.status === 'נסגר').length;
    kpisEl.innerHTML = [
      kpiCard('סה״כ הצעות', total, 'כולל טיוטות'),
      kpiCard('פתוחות', open, 'בטיפול'),
      kpiCard('נסגרו', done, 'הסתיימו'),
    ].join('');
  }

  
  function renderKpisMy(){
    const agent = state.agentName;
    const assignedCustomers = state.customers.filter(c => (c.assignedAgent||'') === agent);
    const openProposals = state.proposals.filter(p => (p.assignedAgent||agent) === agent && !['נסגר','בוטל'].includes(p.status||''));
    kpisEl.innerHTML = [
      kpiCard('משויכים אליי', assignedCustomers.length, 'לקוחות'),
      kpiCard('תיקים פתוחים', openProposals.length, 'הצעות פעילות'),
      kpiCard('דורש טיפול', openProposals.filter(p => computeCompletion(p).level!=='ok').length, 'חסרים/לא הושלם'),
    ].join('');
  }

  function latestProposalForCustomer(customerId){
    const rel = state.proposals.filter(p => p.customerId === customerId);
    rel.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    return rel[0] || null;
  }

  function renderMyProcesses(){
    const agent = state.agentName;
    const rows = state.customers
      .filter(c => (c.assignedAgent||'') === agent)
      .map(c => {
        const lp = latestProposalForCustomer(c.id);
        const status = lp ? (lp.status||'') : '—';
        const comp = lp ? computeCompletion(lp) : null;
        const prog = lp ? proposalProgressCell(lp) : '<span style="color:rgba(18,19,25,.55);font-size:12px">אין תיק עדיין</span>';
        const openCls = (lp && !['נסגר','בוטל'].includes(status)) ? '' : 'style="opacity:.65"';
        return { c, lp, status, prog, openCls };
      });

    // Sort: open first, then by createdAt desc
    rows.sort((a,b) => {
      const ao = a.lp && !['נסגר','בוטל'].includes(a.status);
      const bo = b.lp && !['נסגר','בוטל'].includes(b.status);
      if(ao !== bo) return bo - ao;
      return ((b.lp&&b.lp.createdAt)||'').localeCompare((a.lp&&a.lp.createdAt)||'');
    });

    viewEl.innerHTML = `
      ${renderDueProcessesForAgent_(agent)}
      <div class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>לקוח</th>
              <th>נציג מטפל</th>
              <th>סטטוס תיק</th>
              <th>התקדמות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr ${r.openCls}>
                <td>
                  <div style="font-weight:900">${escapeHtml(r.c.fullName||'')}</div>
                  <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(r.c.phone||'')}</div>
                </td>
                <td>${escapeHtml(r.c.assignedAgent||'')}</td>
                <td>${escapeHtml(r.status)}</td>
                <td>${r.prog}</td>
                <td style="text-align:left">
                  ${r.lp ? `<button class="btn btnSoft" data-open-prop="${escapeAttr(r.lp.id)}">פתח תיק</button>` : `<button class="btn btnSoft" data-new-prop="${escapeAttr(r.c.id)}">צור תיק</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${rows.length ? '' : `<div class="sideHint">אין לקוחות משויכים אליך עדיין.</div>`}
    `;

    $$('[data-open-prop]').forEach(b => b.addEventListener('click', () => openWizard({ proposalId: b.dataset.openProp })));
    $$('[data-new-prop]').forEach(b => b.addEventListener('click', () => openWizard({ customerId: b.dataset.newProp })));
    wireProcessButtons_();
  }

function renderKpisSettings(){
    kpisEl.innerHTML = [
      kpiCard('מצב', 'דמו', 'ללא שרת'),
      kpiCard('ערכת צבע', 'Cream + Gold', 'זהב חלש'),
      kpiCard('תצוגה', 'CRM', 'Sidebar + Table'),
    ].join('');
  }

  function renderCustomersTable(rows){
    viewEl.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>לקוח</th>
              <th>ת״ז</th>
              <th>טלפון</th>
              <th>סטטוס</th>
              <th>נציג מטפל</th>
              <th>סגמנט</th>
              <th>התקדמות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td><b>${escapeHtml(c.fullName)}</b><div style="color:rgba(18,19,25,.55);font-size:12px">${escapeHtml(c.email)}</div></td>
                <td>${escapeHtml(c.tz)}</td>
                <td>${escapeHtml(c.phone)}</td>
                <td>${chip(c.status)}</td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <span style="font-weight:900">${escapeHtml(c.assignedAgent||'—')}</span>
                    <button class="btn btnTiny" data-assign="${escapeAttr(c.id)}">שייך</button>
                  </div>
                </td>
                <td>${escapeHtml(c.segment)}</td>
                <td>${customerProgressCell(c.id)}</td>
                <td style="text-align:left;white-space:nowrap">
                      <button class="btn btnSoft" data-open-proposal="${c.id}">צור הצעה</button>
                      <button class="btn btnTiny" data-new-process="${c.id}">צור תהליך</button>
                    </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    $$('[data-open-proposal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-open-proposal');
        openWizard({ customerId: cid });
      });
    });

    $$('[data-new-process]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const cid = btn.getAttribute('data-new-process');
        openProcessModal_(cid);
      });
    });

    // Assign customer to agent (any user can do it)
    $$('[data-assign]').forEach(b => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = b.dataset.assign;
      const c = state.customers.find(x => x.id === id);
      if(!c) return;
      const current = c.assignedAgent || '';
      const suggested = state.teamAgents && state.teamAgents.length ? state.teamAgents.join(', ') : '';
      const name = prompt('שם הנציג לשיוך (אפשר לבחור/להקליד).\nקיימים: ' + suggested, current || state.agentName);
      if(name === null) return;
      c.assignedAgent = String(name).trim();
      toast('עודכן', 'הלקוח שויך ל־' + c.assignedAgent);
      render();
    }));
  }

  function renderProposalsTable(rows){
    viewEl.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>כותרת</th>
              <th>לקוח</th>
              <th>סטטוס</th>
              <th>תאריך</th>
              <th>התקדמות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(p => `
              <tr>
                <td><b>${escapeHtml(p.title)}</b></td>
                <td>${escapeHtml(p.customerName || '—')}</td>
                <td>${chip(p.status, p.status==='נסגר'?'ok':'warn')}</td>
                <td>${escapeHtml(new Date(p.createdAt).toLocaleString('he-IL'))}</td>
                <td>${proposalProgressCell(p)}</td>
                <td><button class="btn btnSoft" data-resume="${p.id}">המשך</button></td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="color:rgba(18,19,25,.55)">אין הצעות עדיין.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    $$('[data-resume]').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-resume');
      const proposal = state.proposals.find(p => p.id === pid);
      if(proposal) openWizard({ proposalId: pid });
    }));
  }

  function renderSettings(){
    viewEl.innerHTML = `
      <div class="grid2">
        <div class="sideCard">
          <div class="sideTitle">חיבור לשרת (Google Sheets)</div>
          <div class="field">
            <label>Web App URL</label>
            <input id="serverUrlInput" placeholder="https://script.google.com/macros/s/XXXX/exec" value="${escapeHtml(state.server.url || '')}"/>
          </div>
          <div style="height:10px"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btnPrimary" id="connectBtn">בדוק חיבור</button>
            <button class="btn btnSoft" id="pullBtn">משוך נתונים</button>
          </div>
          <div class="sideHint" id="connHint">${state.connected ? '✅ מחובר' : '⚠️ לא מחובר (דמו)'}</div>
        </div>

        <div class="sideCard">
          <div class="sideTitle">שם נציג (דמו)</div>
          <div class="field">
            <label>שם נציג</label>
            <input id="agentInput" value="${escapeHtml(state.agentName)}"/>
          </div>
          <div style="height:10px"></div>
          <button class="btn btnPrimary" id="saveAgentBtn">שמור</button>
        </div>

        <div class="sideCard">
          <div class="sideTitle">הערות</div>
          <div class="sideHint">המערכת כרגע דמו. חיבור לגוגל שיטס נוסיף אחרי שננעל UI.</div>
        </div>
      </div>
    `;
    $('#saveAgentBtn').addEventListener('click', () => {
      const v = $('#agentInput').value.trim() || 'אורח';
      state.agentName = v;
      toast('נשמר', 'שם הנציג עודכן');
      render();
    });

    // Server connect / pull
    const serverUrlInput = $('#serverUrlInput');
    $('#connectBtn').addEventListener('click', async () => {
      const url = (serverUrlInput.value || '').trim();
      state.server.url = url;
      // NOTE: dynamic URL only used for UI; apiCall uses GOOGLE_SCRIPT_URL constant.
      // If you want dynamic URL, set GOOGLE_SCRIPT_URL in code (recommended).
      const ping = await apiPing();
      state.connected = !!ping.ok;
      $('#connHint').textContent = state.connected ? '✅ מחובר' : '⚠️ לא מחובר (דמו)';
      toast(state.connected ? 'מחובר' : 'לא מחובר', state.connected ? 'השרת ענה בהצלחה' : 'בדוק URL/הרשאות');
    });
    $('#pullBtn').addEventListener('click', async () => {
      if(!GOOGLE_SCRIPT_URL){ toast('דמו', 'הדבק URL בקוד (GOOGLE_SCRIPT_URL) כדי לסנכרן'); return; }
      await syncDown();
      toast('עודכן', 'משכנו נתונים מהשרת');
      render();
    });

  }

  // ---------- Search ----------
  function performSearch(){
    const q = (globalSearch.value||'').trim().toLowerCase();
    if(!q){
      toast('חיפוש', 'הכנס שם / ת״ז / טלפון');
      return;
    }
    const found = visibleCustomers_().filter(c =>
      (c.fullName||'').toLowerCase().includes(q) ||
      (c.tz||'').toLowerCase().includes(q) ||
      (c.phone||'').toLowerCase().includes(q)
    );
    if(route !== 'customers') setRoute('customers');
    renderCustomersTable(found);
    toast('תוצאות חיפוש', `${found.length} תוצאה/ות`);
  }
  searchBtn.addEventListener('click', performSearch);
  globalSearch.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); performSearch(); }
  });

  // ---------- Wizard (proposal flow) ----------
  const INTERNAL_STATUS = ['פתוח','ממתין להצעה','נסגר'];
  const STATUS_OPTIONS = ['טיוטה','בתהליך','ממתין למסמכים','ממתין לחיתום','נסגר','בוטל'];

  const WIZ_STEPS = [
    { key:'customer', label:'פרטי לקוח' },
    { key:'old', label:'פוליסות קיימות' },
    { key:'new', label:'רכישות חדשות' },
    { key:'medical', label:'שאלון רפואי' },
    { key:'payer', label:'פרטי משלם' },
    { key:'summary', label:'סיכום' }
  ];

  let wiz = null;

  newProposalBtn.addEventListener('click', () => openWizard({}));

  wizardCloseBtn.addEventListener('click', closeWizard);
  wizardOverlay.addEventListener('click', (e) => {
    if(e.target === wizardOverlay) closeWizard();
  });

  nextStepBtn.addEventListener('click', () => gotoStep(wiz.stepIndex + 1));
  prevStepBtn.addEventListener('click', () => gotoStep(wiz.stepIndex - 1));

  function openWizard({ customerId=null, proposalId=null }){
    const now = new Date();
    let proposal = null;

    if(proposalId){
      proposal = state.proposals.find(p => p.id === proposalId) || null;
    }

    if(!proposal){
      const customer = customerId ? state.customers.find(c => c.id === customerId) : null;
      if(customer && !customer.assignedAgent){ customer.assignedAgent = state.agentName; }
      proposal = {
        id: 'p_' + Math.random().toString(16).slice(2),
        createdAt: new Date().toISOString(),
        status: 'טיוטה',
        internalStatus: 'פתוח',
        title: 'הצעה',
        pdfGenerated: false,
        assignedAgent: (customer && customer.assignedAgent) ? customer.assignedAgent : state.agentName,
        customerId: customer ? customer.id : null,
        customerName: customer ? customer.fullName : '',
        customer: customer ? { ...customer } : { fullName:'', tz:'', phone:'', email:'' },

        oldPolicies: [],
        newPolicies: [],

        insuredList: [
          { id:'main', label:'מבוטח ראשי', type:'main' }
        ],
        childCounter: 0,
        activeInsuredId: 'main',
        medical: {
          // medical[insuredId][company|product] = answers
        }
      };
      state.proposals.unshift(proposal);
    }

    // Normalize insureds + policies (backward compatibility)
    proposal.insuredList = (Array.isArray(proposal.insuredList) && proposal.insuredList.length)
      ? proposal.insuredList
      : [{ id:'main', label:'מבוטח ראשי', type:'main' }];
    if(!proposal.insuredList.some(i => i.id === 'main')){
      proposal.insuredList.unshift({ id:'main', label:'מבוטח ראשי', type:'main' });
    }
    proposal.childCounter = Number(proposal.childCounter || proposal.insuredList.filter(i => i.type === 'child').length) || 0;
    proposal.activeInsuredId = proposal.activeInsuredId || 'main';
    proposal.oldPolicies = (Array.isArray(proposal.oldPolicies) ? proposal.oldPolicies : []).map(x => ({ ...x, insuredId: (x && x.insuredId) ? x.insuredId : 'main' }));
    proposal.newPolicies = (Array.isArray(proposal.newPolicies) ? proposal.newPolicies : []).map(x => ({ ...x, insuredId: (x && x.insuredId) ? x.insuredId : 'main' }));


    wiz = {
      proposal,
      stepIndex: 0,
      medicalStepIndex: 0
    };

    $('#wizardTitle').textContent = proposal.customerName ? `הצעה – ${proposal.customerName}` : 'הצעה חדשה';
    $('#wizardSub').textContent = 'חובה למלא את כל הפרטים';
    // Status dropdown
    if(statusSelect){
      statusSelect.innerHTML = STATUS_OPTIONS.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
      statusSelect.value = proposal.status || 'טיוטה';
      statusSelect.onchange = () => {
        proposal.status = statusSelect.value;
        syncInternalStatus(proposal);
        savePill.textContent = proposal.status;
        toast('עודכן', 'סטטוס עודכן');
        render();
      };
    }

    wizardOverlay.classList.remove('hidden');
    wizardOverlay.setAttribute('aria-hidden', 'false');

    buildInsuredTabs();
    updateInsuredIndicator();
    renderStepper();
    renderWizard();
    updateSums();
    toast('הצעה פתוחה', 'אפשר להתחיל למלא');
  }

  function closeWizard(){
    wizardOverlay.classList.add('hidden');
    wizardOverlay.setAttribute('aria-hidden', 'true');
    wiz = null;
  }

  
  function isVisible(el){
    if(!el) return false;
    // offsetParent null for display:none; also handle hidden attribute
    if(el.hidden) return false;
    const style = window.getComputedStyle(el);
    if(style.display==='none' || style.visibility==='hidden' || style.opacity==='0') return false;
    return true;
  }

  function clearReqErrors(){
    wizardMain.querySelectorAll('.reqError').forEach(x => x.classList.remove('reqError'));
  }

  function validateCurrentStep(){
    clearReqErrors();

    // Validate all visible inputs/selects/textareas in the wizard (current step)
    const controls = Array.from(wizardMain.querySelectorAll('input, select, textarea'))
      .filter(el => {
        if(!isVisible(el)) return false;
        const type = (el.getAttribute('type')||'').toLowerCase();
        if(type==='button' || type==='submit' || type==='hidden') return false;
        if(el.disabled) return false;
        // Ignore non-form controls
        if(el.id==='searchInput') return false;
        return true;
      });

    // Radio groups: require one checked per group
    const radios = controls.filter(el => (el.type||'').toLowerCase()==='radio');
    const radioNames = Array.from(new Set(radios.map(r => r.name).filter(Boolean)));
    for(const name of radioNames){
      const group = radios.filter(r => r.name===name);
      if(group.length && !group.some(r => r.checked)){
        group.forEach(r => r.classList.add('reqError'));
        toast('חסר מידע', 'יש להשלים את כל השדות לפני מעבר לשלב הבא');
        group[0].scrollIntoView({behavior:'smooth', block:'center'});
        return false;
      }
    }

    // Other controls: require value
    for(const el of controls){
      const type = (el.getAttribute('type')||'').toLowerCase();
      if(type==='radio') continue;
      // For checkboxes: must be checked
      if(type==='checkbox'){
        if(!el.checked){
          el.classList.add('reqError');
          toast('חסר מידע', 'יש להשלים את כל השדות לפני מעבר לשלב הבא');
          el.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
        continue;
      }
      const v = (el.value ?? '').toString().trim();
      if(v === ''){
        el.classList.add('reqError');
        toast('חסר מידע', 'יש להשלים את כל השדות לפני מעבר לשלב הבא');
        el.scrollIntoView({behavior:'smooth', block:'center'});
        try{ el.focus(); }catch(e){}
        return false;
      }
    }

    // Extra rule: if payment method is card, require card number input filled (transient)
    if(wiz && WIZ_STEPS[wiz.stepIndex] && WIZ_STEPS[wiz.stepIndex].key==='payer'){
      const method = wiz.proposal?.payer?.method || 'card';
      if(method==='card'){
        const numEl = document.getElementById('payer_card_number');
        const expEl = document.getElementById('payer_card_exp');
        if(numEl && numEl.value.trim()===''){
          numEl.classList.add('reqError');
          toast('חסר מידע', 'יש למלא מספר כרטיס ותוקף');
          numEl.scrollIntoView({behavior:'smooth', block:'center'});
          numEl.focus();
          return false;
        }
        if(expEl && expEl.value.trim()===''){
          expEl.classList.add('reqError');
          toast('חסר מידע', 'יש למלא מספר כרטיס ותוקף');
          expEl.scrollIntoView({behavior:'smooth', block:'center'});
          expEl.focus();
          return false;
        }
      }
    }

    return true;
  }

function gotoStep(i){
    if(!wiz) return;
    const goingForward = (i > wiz.stepIndex);
    // (Temporarily disabled) required-fields gate will be re-enabled later
    // if(goingForward){
    //   if(!validateCurrentStep()) return;
    // }
    if(i < 0) i = 0;
    if(i >= WIZ_STEPS.length) i = WIZ_STEPS.length - 1;
    wiz.stepIndex = i;
    // reset medical substep when leaving/entering
    renderStepper();
    renderWizard();
    updateSums();
  }

  function renderStepper(){
    stepperEl.innerHTML = WIZ_STEPS.map((s, idx) => (
      `<div class="step ${idx===wiz.stepIndex?'active':''}">${escapeHtml(s.label)}</div>`
    )).join('');
  }

  function getActiveInsured(){
    return (wiz && wiz.proposal && wiz.proposal.insuredList)
      ? wiz.proposal.insuredList.find(x => x.id===wiz.proposal.activeInsuredId)
      : null;
  }

  function updateInsuredIndicator(){
    const a = getActiveInsured();
    if(!insuredIndicatorEl) return;
    if(!a){ insuredIndicatorEl.textContent = ''; return; }
    insuredIndicatorEl.innerHTML = `נמצא/ת על: <strong>${escapeHtml(a.label)}</strong>`;
  }

  function buildInsuredTabs(){
    const p = wiz.proposal;

    const hasSpouse = p.insuredList.some(i => i.type === 'spouse');
    const canRemoveSpouse = hasSpouse;

    insuredTabsEl.innerHTML =
      p.insuredList.map(x => {
        const isChild = x.type === 'child';
        const isSpouse = x.type === 'spouse';
        const active = x.id===p.activeInsuredId ? 'active' : '';
        const removeBtn = (isChild || isSpouse)
          ? `<span class="xBtn" data-del-insured="${escapeAttr(x.id)}" title="הסר">×</span>`
          : '';
        return `<button class="insuredTab ${active}" data-insured="${escapeAttr(x.id)}">${escapeHtml(x.label)}${removeBtn}</button>`;
      }).join('')
      + `
        ${hasSpouse ? '' : `<button class="insuredTab" id="addSpouseBtn" title="הוסף בן/בת זוג">＋ בן/בת זוג</button>`}
        <button class="insuredTab" id="addChildBtn" title="הוסף ילד">＋ ילד</button>
      `;

    // Switch insured
    $$('[data-insured]', insuredTabsEl).forEach(b => b.addEventListener('click', (e) => {
      // if clicked the remove x, ignore (handled below)
      if(e && e.target && e.target.closest && e.target.closest('[data-del-insured]')) return;
      const id = b.getAttribute('data-insured');
      p.activeInsuredId = id;

      // When changing insured, rerender the current step so policies stay separated
      buildInsuredTabs();
      updateSums();
      const stepKey = WIZ_STEPS[wiz.stepIndex].key;
      if(['customer','old','new','medical'].includes(stepKey)){
        if(stepKey === 'medical') wiz.medicalStepIndex = 0;
        renderWizard();
      }
    }));

    // Add spouse
    const addSpouseBtn = document.getElementById('addSpouseBtn');
    if(addSpouseBtn){
      addSpouseBtn.addEventListener('click', () => {
        if(p.insuredList.some(i => i.id === 'spouse')){
          toast('קיים', 'בן/בת זוג כבר קיימ/ת');
          return;
        }
        p.insuredList.push({ id:'spouse', label:'בן/בת זוג', type:'spouse' });
        p.activeInsuredId = 'spouse';
        toast('נוסף', 'נוסף/ה בן/בת זוג');
        buildInsuredTabs();
        updateSums();
        renderWizard();
      });
    }

    // Add child
    const addChildBtn = document.getElementById('addChildBtn');
    if(addChildBtn){
      addChildBtn.addEventListener('click', () => {
        p.childCounter = (Number(p.childCounter) || 0) + 1;
        const n = p.childCounter;
        const childId = `child_${n}`;
        p.insuredList.push({ id: childId, label: `ילד ${n}`, type:'child' });
        p.activeInsuredId = childId;
        toast('נוסף', `נוסף ילד ${n}`);
        buildInsuredTabs();
        updateSums();
        const stepKey = WIZ_STEPS[wiz.stepIndex].key;
        if(['customer','old','new','medical'].includes(stepKey)){
          if(stepKey === 'medical') wiz.medicalStepIndex = 0;
          renderWizard();
        }
      });
    }

    // Remove insured (child/spouse)
    $$('[data-del-insured]', insuredTabsEl).forEach(x => x.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = x.getAttribute('data-del-insured');
      const item = p.insuredList.find(i => i.id === id);
      if(!item || item.type === 'main') return;

      // Remove from list
      p.insuredList = p.insuredList.filter(i => i.id !== id);

      // Clean related data
      p.oldPolicies = (p.oldPolicies||[]).filter(pp => (pp.insuredId||'main') !== id);
      p.newPolicies = (p.newPolicies||[]).filter(pp => (pp.insuredId||'main') !== id);
      if(p.medical && p.medical[id]) delete p.medical[id];
      if(p.insuredDetails && p.insuredDetails[id]) delete p.insuredDetails[id];

      if(p.activeInsuredId === id){
        p.activeInsuredId = 'main';
      }

      toast('הוסר', item.type === 'spouse' ? 'בן/בת זוג הוסר/ה' : 'הילד הוסר');
      buildInsuredTabs();
      updateSums();
      renderWizard();
    }));

    updateInsuredIndicator();
  }

  function renderWizard(){
    clearReqErrors();
    if(!wiz) return;
    const stepKey = WIZ_STEPS[wiz.stepIndex].key;
    savePill.textContent = wiz.proposal.status;
    if(statusSelect) statusSelect.value = wiz.proposal.status || 'טיוטה';
    if(compHost){
      const comp = computeCompletion(wiz.proposal);
      compHost.innerHTML = renderCompletionBadges(comp);
    }

    try{
      if(stepKey === 'customer') return renderCustomerStep();
      if(stepKey === 'old') return renderOldPoliciesStep();
      if(stepKey === 'new') return renderNewPoliciesStep();
      if(stepKey === 'medical') return renderMedicalStep();
      if(stepKey === 'payer') return renderPayerStep();
      if(stepKey === 'summary') return renderSummaryStep();
    } catch(err){
      console.error('renderWizard step failed:', stepKey, err);
      toast('שגיאה', 'תקלה בטעינת המסך. בדוק בקונסול (F12) לפרטים.');
      if(wizardMain){
        wizardMain.innerHTML = `
          <div class="sectionTitle">שגיאה בטעינת המסך</div>
          <div class="sideHint">נפלה שגיאה בזמן טעינת שלב: <b>${escapeHtml(stepKey)}</b>.<br/>פתח קונסול (F12) כדי לראות את השגיאה המדויקת.</div>
          <div class="hr"></div>
          <button class="btn btnPrimary" id="retryStepBtn">נסה שוב</button>
        `;
        const r = document.getElementById('retryStepBtn');
        if(r) r.addEventListener('click', () => renderWizard());
      }
    }
  }

  function renderCustomerStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId || 'main';
    p.insuredDetails = p.insuredDetails || {};
    const d = (insuredId === 'main') ? p.customer : (p.insuredDetails[insuredId] = (p.insuredDetails[insuredId] || {}));


    // Backward compatibility: if old fullName exists, try split once
    if(insuredId==='main' && !d.firstName && !d.lastName && p.customer.fullName){
      const parts = String(p.customer.fullName).trim().split(/\s+/);
      d.firstName = parts.shift() || '';
      d.lastName = parts.join(' ') || '';
    }

    wizardMain.innerHTML = `
      <div class="sectionTitle">פרטי מבוטח – ${escapeHtml(labelInsured(insuredId))}</div>

      <div class="grid3">
        ${field('שם פרטי', 'customer_firstName', d.firstName || '')}
        ${field('שם משפחה', 'customer_lastName', d.lastName || '')}
        ${selectField('מין', 'customer_gender', ['זכר','נקבה','אחר'])}
      </div>

      <div class="grid3" style="margin-top:10px">
        ${dateField('תאריך לידה', 'customer_birthDate', d.birthDate || '')}
        ${field('נייד', 'customer_mobile', d.mobile || d.phone || '')}
        ${field('מייל', 'customer_email', d.email || '')}
      </div>

      <div class="grid3" style="margin-top:10px">
        ${field('ת.ז', 'customer_tz', d.tz || '')}
        ${selectField('קופת חולים', 'customer_hmo', ['כללית','מכבי','מאוחדת','לאומית','אחר'])}
        ${selectField('שב״ן', 'customer_shaban', ['אין','כסף','זהב','פלטינום'])}
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">נתונים רפואיים בסיסיים</div>

      <div class="grid3">
        ${numField('גובה (ס״מ)', 'customer_heightCm', d.heightCm || '')}
        ${numField('משקל (ק״ג)', 'customer_weightKg', d.weightKg || '')}
        ${selectField('מעשן?', 'customer_smoker', ['לא','כן'])}
      </div>

      <div class="bmiCard" style="margin-top:10px">
        <span>BMI</span>
        <b id="bmiValue">—</b>
        <small id="bmiLabel">הזן גובה + משקל</small>
      </div>

      <div class="grid3" style="margin-top:10px" id="smokeRow" style="display:none">
        <div class="field">
          <label for="customer_smokePerDay">כמות ליום</label>
          <input id="customer_smokePerDay" type="number" inputmode="decimal" placeholder="0" value="${escapeHtml(d.smokePerDay || '')}" />
        </div>

        <div class="field">
          <label class="chkLine" style="display:flex;align-items:center;gap:10px">
            <input id="customer_cannabisMedical" type="checkbox" ${d.cannabisMedical ? 'checked' : ''} />
            <span>קנאביס באישור רפואי</span>
          </label>
        </div>

        <div class="field">
          <label class="chkLine" style="display:flex;align-items:center;gap:10px">
            <input id="customer_cannabisSocial" type="checkbox" ${d.cannabisSocial ? 'checked' : ''} />
            <span>קנאביס להנאה חברתית</span>
          </label>
        </div>
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">נוסף</div>

      <div class="grid2">
        ${field('עיסוק', 'customer_occupation', d.occupation || '')}
        ${dateField('הנפקת ת.ז', 'customer_tzIssueDate', d.tzIssueDate || '')}
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">הערות</div>
      <textarea id="customer_notes" placeholder="סיכום שיחה / הערות...">${escapeHtml(d.notes||'')}</textarea>
    `;

    // Set selected values for selects
    setSelectValue('customer_gender', d.gender || '');
    setSelectValue('customer_hmo', d.hmo || '');
    setSelectValue('customer_shaban', d.shaban || '');
    setSelectValue('customer_smoker', (d.smoker === true || d.smoker === 'כן') ? 'כן' : (d.smoker === 'לא' ? 'לא' : (d.smoker ? 'כן' : 'לא')));

    // Bind
    bindInput('customer_firstName', v => { d.firstName = v; if(insuredId==='main'){ p.customer.firstName = v; syncDisplayName(p);} });
    bindInput('customer_lastName', v => { d.lastName = v; if(insuredId==='main'){ p.customer.lastName = v; syncDisplayName(p);} });

    bindSelect('customer_gender', v => d.gender = v);
    bindDate('customer_birthDate', v => d.birthDate = v);

    bindInput('customer_mobile', v => { d.mobile = v; d.phone = v; });
    bindInput('customer_email', v => d.email = v);
    bindInput('customer_tz', v => d.tz = v);

    bindSelect('customer_hmo', v => d.hmo = v);
    bindSelect('customer_shaban', v => d.shaban = v);

    const updateBMI = () => {
      const h = parseFloat(String(d.heightCm||'').replace(',', '.'));
      const w = parseFloat(String(d.weightKg||'').replace(',', '.'));
      const valEl = $('#bmiValue');
      const labEl = $('#bmiLabel');
      if(!valEl || !labEl) return;
      if(!(h>0) || !(w>0)){
        valEl.textContent = '—';
        labEl.textContent = 'הזן גובה + משקל';
        d.bmi = '';
        return;
      }
      const m = h/100;
      const bmi = w/(m*m);
      const rounded = Math.round(bmi*10)/10;
      d.bmi = String(rounded);
      valEl.textContent = d.bmi;
      let cat = 'תקין';
      if(rounded < 18.5) cat = 'תת־משקל';
      else if(rounded < 25) cat = 'תקין';
      else if(rounded < 30) cat = 'עודף משקל';
      else cat = 'השמנה';
      labEl.textContent = cat;
    };

    bindInput('customer_heightCm', v => { d.heightCm = v; updateBMI(); });
    bindInput('customer_weightKg', v => { d.weightKg = v; updateBMI(); });

    bindSelect('customer_smoker', v => {
      d.smoker = v;
      toggleSmokeRow(v === 'כן');
      if(v !== 'כן'){ d.smokePerDay = ''; d.cannabisMedical = false; d.cannabisSocial = false; const el = document.getElementById('customer_smokePerDay'); if(el) el.value = ''; }
    });
    bindInput('customer_smokePerDay', v => d.smokePerDay = v);
    bindCheck('customer_cannabisMedical', v => d.cannabisMedical = v);
    bindCheck('customer_cannabisSocial', v => d.cannabisSocial = v);

    bindInput('customer_occupation', v => d.occupation = v);
    bindDate('customer_tzIssueDate', v => d.tzIssueDate = v);
    bindTextarea('customer_notes', v => d.notes = v);

    // Initial BMI render
    updateBMI();

    // Show/hide smoking quantity row initially
    toggleSmokeRow((d.smoker === true || d.smoker === 'כן'));

    // Keep wizard title in sync
    syncDisplayName(p);
  }

  function renderOldPoliciesStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId || 'main';
    const insuredLabel = labelInsured(insuredId);

    p.oldPolicies = Array.isArray(p.oldPolicies) ? p.oldPolicies : [];

    const rows = [];
    p.oldPolicies.forEach((x,idx) => {
      const id = (x && x.insuredId) ? x.insuredId : 'main';
      if(id === insuredId) rows.push({ x, idx });
    });

    wizardMain.innerHTML = `
      <div class="sectionTitle">פוליסות קיימות – ${escapeHtml(insuredLabel)}</div>
      <div class="grid2">
        <div class="field">
          <label>מבוטח</label>
          <div class="pill">${escapeHtml(insuredLabel)}</div>
        </div>
        ${selectField('חברה', 'old_company', ['הראל','כלל','מנורה','הפניקס','מגדל','הכשרה'])}
      </div>
      <div class="grid3" style="margin-top:10px">
        ${selectField('סוג ביטוח', 'old_product', ['בריאות','חיים','ריסק','תאונות אישיות','דירה','רכב'])}
        ${numField('פרמיה חודשית', 'old_premium', '')}
        ${selectField('סטטוס', 'old_decision', ['לביטול','נשאר ללא שינוי'])}
      </div>
      <div style="height:10px"></div>
      <button class="btn btnPrimary" id="addOldBtn">+ הוסף פוליסה קיימת</button>

      <div class="hr"></div>
      <div class="tableWrap">
        <table>
          <thead><tr><th>חברה</th><th>מוצר</th><th>פרמיה</th><th>סטטוס</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(({x,idx}) => {
              const dec = (x.decision || x.action || 'cancel');
              const val = (dec === 'keep') ? 'נשאר ללא שינוי' : 'לביטול';
              return `
              <tr>
                <td>${escapeHtml(x.company||'')}</td>
                <td>${escapeHtml(x.product||'')}</td>
                <td>${money(x.premium||0)}</td>
                    ${kind==='old' ? '' : `<td>${escapeHtml(summarizeDiscount(x.discount))}</td>`}
                <td style="min-width:160px">
                  <select data-old-decision="${idx}">
                    <option value="cancel" ${dec!=='keep'?'selected':''}>לביטול</option>
                    <option value="keep" ${dec==='keep'?'selected':''}>נשאר ללא שינוי</option>
                  </select>
                </td>
                <td><button class="btn btnSoft" data-del-old="${idx}">מחיקה</button></td>
              </tr>`;
            }).join('') : `<tr><td colspan="5" style="color:rgba(18,19,25,.55)">אין פוליסות קיימות למבוטח זה עדיין.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="sideHint" style="margin-top:10px">ℹ️ כאן אתה מתעד את כל הפוליסות הקיימות. סמן לכל אחת: <b>לביטול</b> או <b>נשאר ללא שינוי</b>. עבור מבוטח נוסף – עבור ללשונית שלו למעלה.</div>
    `;

    // Default decision
    setSelectValue('old_decision', 'לביטול');

    $('#addOldBtn').addEventListener('click', () => {
      const company = $('#old_company').value;
      const product = $('#old_product').value;
      const premium = parseFloat($('#old_premium').value || '0') || 0;
      const decisionLabel = ($('#old_decision') ? $('#old_decision').value : 'לביטול');
      const decision = (decisionLabel === 'נשאר ללא שינוי') ? 'keep' : 'cancel';
      if(!company || !product){ toast('שגיאה', 'בחר חברה וסוג ביטוח'); return; }

      p.oldPolicies.push({ insuredId, company, product, premium, decision });
      toast('נוסף', 'פוליסה קיימת נוספה');
      renderOldPoliciesStep();
      updateSums();
      markDraft();
    });

    $$('[data-del-old]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-del-old'),10);
      p.oldPolicies.splice(idx,1);
      renderOldPoliciesStep();
      updateSums();
      markDraft();
    }));

    $$('[data-old-decision]').forEach(sel => sel.addEventListener('change', () => {
      const idx = parseInt(sel.getAttribute('data-old-decision'),10);
      const v = sel.value;
      const item = p.oldPolicies[idx];
      if(item){
        item.decision = v;
        toast('עודכן', v==='keep' ? 'סומן: נשאר ללא שינוי' : 'סומן: לביטול');
        markDraft();
      }
    }));
  }
function renderNewPoliciesStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId || 'main';
    const insuredLabel = labelInsured(insuredId);

    p.newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];

    const rows = [];
    p.newPolicies.forEach((x,idx) => {
      const id = (x && x.insuredId) ? x.insuredId : 'main';
      if(id === insuredId) rows.push({ x, idx });
    });

    wizardMain.innerHTML = `
      <div class="sectionTitle">רכישות חדשות – ${escapeHtml(insuredLabel)}</div>
      <div class="grid2">
        <div class="field">
          <label>מבוטח</label>
          <div class="pill">${escapeHtml(insuredLabel)}</div>
        </div>
        ${selectField('חברה', 'new_company', ['הראל','כלל','מנורה','הפניקס','מגדל','הכשרה'])}
      </div>
      <div class="grid2" style="margin-top:10px">
        ${selectField('מוצר', 'new_product', ['בריאות','חיים','ריסק','תאונות אישיות','דירה','רכב'])}
        ${numField('פרמיה חודשית', 'new_premium', '')}
      </div>
      <div style="height:10px"></div>
      <button class="btn btnPrimary" id="addNewBtn">+ הוסף רכישה חדשה</button>

      <div class="hr"></div>
      <div class="tableWrap">
        <table>
          <thead><tr><th>חברה</th><th>מוצר</th><th>פרמיה</th><th>הנחות</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(({x,idx}) => `
              <tr>
                <td>${escapeHtml(x.company)}</td>
                <td>${escapeHtml(x.product)}</td>
                <td>${money(x.premium)}</td>
                <td>
                  <button class="btn btnSoft" type="button" data-disc-new="${idx}">
                    הנחות${x.discount && (x.discount.tier||'') ? ` (${escapeHtml(String(x.discount.tier||''))})` : (x.discount && (x.discount.types||[]).length ? ' (✓)' : '')}
                  </button>
                </td>
                <td><button class="btn btnSoft" data-del-new="${idx}">מחיקה</button></td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="color:rgba(18,19,25,.55)">אין רכישות חדשות למבוטח זה עדיין.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="sideHint" style="margin-top:10px">🧠 השאלון הרפואי נבנה לפי רכישות של המבוטח הנוכחי בלבד.</div>
    `;

    $('#addNewBtn').addEventListener('click', () => {
      const company = $('#new_company').value;
      const product = $('#new_product').value;
      const premium = parseFloat($('#new_premium').value || '0') || 0;
      if(!company || !product){ toast('שגיאה', 'בחר חברה ומוצר'); return; }
      p.newPolicies.push({ insuredId, company, product, premium });
      toast('נוסף', 'רכישה חדשה נוספה');
      renderNewPoliciesStep();
      updateSums();
      markDraft();
    });

    $$('[data-disc-new]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-disc-new'),10);
      const pol = p.newPolicies[idx];
      if(!pol) return;
      openPolicyDiscountsModal(pol, (payload) => {
        if(payload){
          pol.discount = payload;
        }else{
          delete pol.discount;
        }
        renderNewPoliciesStep();
        markDraft();
      });
    }));

    $$('[data-del-new]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-del-new'),10);
      p.newPolicies.splice(idx,1);
      renderNewPoliciesStep();
      updateSums();
      markDraft();
    }));
  }

  function renderMedicalStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId;

    // Show questionnaire only if this insured has at least one new policy
    const hasAny = p.newPolicies.some(x => x.insuredId === insuredId);
    if(!hasAny){
      wizardMain.innerHTML = `
        <div class="sectionTitle">שאלון רפואי</div>
        <div class="sideHint">אין רכישות חדשות למבוטח הזה, לכן אין שאלון.</div>
      `;
      return;
    }

    const chosenKey = 'DEFAULT|MEDICAL';
    const qn = questionnaires[chosenKey];
    if(!qn){
      wizardMain.innerHTML = `
        <div class="sectionTitle">שאלון רפואי</div>
        <div class="sideHint">לא נמצא שאלון ברירת מחדל. בדוק את app.js.</div>
      `;
      return;
    }

    // answers bucket: per insured
    p.medical[insuredId] = p.medical[insuredId] || {};
    p.medical[insuredId][chosenKey] = p.medical[insuredId][chosenKey] || {};
    const answers = p.medical[insuredId][chosenKey];

    // sub-stepper inside medical
    const mSteps = qn.steps;
    const mIdx = clamp(wiz.medicalStepIndex, 0, mSteps.length-1);
    wiz.medicalStepIndex = mIdx;

    const subStepper = `
      <div class="stepper" style="margin-bottom:12px">
        ${mSteps.map((s,idx) => `<div class="step ${idx===mIdx?'active':''}">${escapeHtml(s.title)}</div>`).join('')}
      </div>
    `;

    const step = mSteps[mIdx];

    // Display context (company/product list) for this insured
    const combos = Array.from(new Set(
      p.newPolicies.filter(x => x.insuredId === insuredId).map(x => `${x.company} • ${x.product}`)
    ));

    wizardMain.innerHTML = `
      <div class="sectionTitle">שאלון רפואי – ${escapeHtml(labelInsured(insuredId))}</div>
      <div class="sideHint" style="margin-top:-6px">לפי רכישות: <b>${escapeHtml(combos.join(' | '))}</b></div>
      ${subStepper}
      <div id="medicalForm"></div>
      <div class="hr"></div>
      <div class="grid2">
        <button class="btn btnSoft" id="prevMedicalBtn">חזרה (במסך)</button>
        <button class="btn btnPrimary" id="nextMedicalBtn">המשך (במסך)</button>
      </div>
    `;

    const form = $('#medicalForm');

    if(step.id === 'sum'){
      const summaryLines = Object.entries(answers).map(([k,v]) => `<li><b>${escapeHtml(k)}</b>: ${escapeHtml(String(v))}</li>`).join('');
      form.innerHTML = `
        <div class="sideHint">סיכום תשובות (דמו):</div>
        <ul style="margin:8px 18px">${summaryLines || '<li>אין תשובות עדיין.</li>'}</ul>
      `;
    } else {
      form.innerHTML = step.questions.map(q => renderQuestion(q, answers)).join('');
      step.questions.forEach(q => bindQuestion(q, answers));
    }

    $('#prevMedicalBtn').addEventListener('click', () => {
      wiz.medicalStepIndex = clamp(wiz.medicalStepIndex - 1, 0, mSteps.length-1);
      renderMedicalStep();
    });
    $('#nextMedicalBtn').addEventListener('click', () => {
      wiz.medicalStepIndex = clamp(wiz.medicalStepIndex + 1, 0, mSteps.length-1);
      renderMedicalStep();
    });
  }

  function renderPayerStep(){
    const p = wiz.proposal;
    if(!p.payer) p.payer = { method:'card', card:{tz:'',name:'',last4:'',exp:'',}, hok:{bank:'',branch:'',account:'',exp:''} };
    if(!p.payer.override) p.payer.override = { enabled:false, firstName:'', lastName:'', tz:'', relationship:'' };

    const method = p.payer.method || 'card';

    wizardMain.innerHTML = `
      <div class="sectionTitle">פרטי משלם</div>
      <div class="hint">פנימי לנציגה • בחרי שיטת תשלום ומלאי את פרטי המשלם.</div>

      <div class="payOverride" style="margin-top:12px;padding:12px;border:1px solid rgba(15,15,20,.08);border-radius:16px;background:rgba(255,255,255,.75)">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-weight:900">משלם חריג</div>
          <label style="display:flex;align-items:center;gap:0;cursor:pointer;user-select:none;margin:0">
            <input id="payer_override_toggle" type="checkbox" style="margin:0" ${p.payer.override && p.payer.override.enabled ? 'checked' : ''} />
          </label>
        </div>
        ${p.payer.override && p.payer.override.enabled ? `
          <div class="grid2" style="margin-top:10px">
            ${field('שם פרטי משלם', 'payer_ov_first', p.payer.override.firstName || '')}
            ${field('שם משפחה משלם', 'payer_ov_last', p.payer.override.lastName || '')}
          </div>
          <div class="grid2" style="margin-top:10px;align-items:end">
            ${field('ת״ז משלם', 'payer_ov_tz', p.payer.override.tz || '', 'numeric')}
            <div class="field">
              <div class="label">קרבה</div>
              <div class="value" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <button class="btn btnSoft" id="payerRelBtn" type="button">קרבה: ${escapeHtml(p.payer.override.relationship || 'בחר')}</button>
                <span class="miniNote">אב / אם / אח / אחות / אחר</span>
              </div>
            </div>
          </div>
        ` : `
          <div class="miniNote" style="margin-top:8px">אם המשלם הוא אבא/אמא/אחר — סמני “משלם חריג” ומלאי את פרטיו.</div>
        `}
      </div>

      <div class="payMethods" role="radiogroup" aria-label="שיטת תשלום">
        <button class="payMethod ${method==='card'?'active':''}" data-pay-method="card" type="button">
          <div class="pmTitle">כרטיס אשראי</div>
          <div class="pmSub">ת״ז + שם + מספר כרטיס + תוקף</div>
        </button>
        <button class="payMethod ${method==='hok'?'active':''}" data-pay-method="hok" type="button">
          <div class="pmTitle">הוראת קבע (הו״ק)</div>
          <div class="pmSub">בנק + סניף + מספר חשבון (+ תוקף אופציונלי)</div>
        </button>
      </div>

      <div class="payPanel">
        ${method==='card' ? `
          <div class="grid3">
            ${field('ת״ז בעל הכרטיס', 'payer_card_tz', p.payer.card.tz || '')}
            ${field('שם בעל הכרטיס', 'payer_card_name', p.payer.card.name || '')}
            <div class="field">
              <div class="label">מספר כרטיס (לשימוש פנימי בלבד)</div>
              <div class="value inlineInput">
                <input id="payer_card_number" inputmode="numeric" autocomplete="off" placeholder="מספר כרטיס" type="password"/>
                <button class="btn btnSoft btnTiny" id="toggleCard" type="button">הצג</button>
              </div>
            </div>
          </div>
          <div class="grid3" style="margin-top:10px">
            ${field('תוקף (MM/YY)', 'payer_card_exp', p.payer.card.exp || '', 'numeric')}
            <div class="field">
              <div class="label">העתקה מהירה</div>
              <div class="value">
                <button class="btn btnSoft" id="copyPayment" type="button">העתק מספר+תוקף</button>
                <div class="miniNote">המספר המלא לא נשמר במערכת — מיועד להקלדה בביטוחים בלבד.</div>
              </div>
            </div>
            <div class="field"><div class="label">ב־PDF</div><div class="value">יופיע רק **** 4 ספרות אחרונות</div></div>
          </div>
        ` : `
          <div class="grid3">
            ${field('מספר בנק', 'payer_hok_bank', p.payer.hok.bank || '', 'numeric')}
            ${field('מספר סניף', 'payer_hok_branch', p.payer.hok.branch || '', 'numeric')}
            ${field('מספר חשבון', 'payer_hok_account', p.payer.hok.account || '', 'numeric')}
            ${field('תוקף הרשאה (אופציונלי)', 'payer_hok_exp', p.payer.hok.exp || '')}
          </div>
          <div class="hint" style="margin-top:10px">ניתן להשלים מספרי בנק/סניף/חשבון מהלקוח בזמן השיחה.</div>
        `}
      </div>
    `;

    // Method buttons
    $$('.payMethod').forEach(btn => btn.addEventListener('click', () => {
      const m = btn.dataset.payMethod;
      p.payer.method = m;
      markDraft();
      renderWizard();
    }));

    // Override payer (different payer than insured/customer)
    bindCheck('payer_override_toggle', v => {
      if(!p.payer.override) p.payer.override = { enabled:false, firstName:'', lastName:'', tz:'', relationship:'' };
      p.payer.override.enabled = v;
      renderWizard(); // re-render to show/hide fields
    });

    // Bind inputs
    bindInput('payer_card_tz', v => p.payer.card.tz = v);
    bindInput('payer_card_name', v => p.payer.card.name = v);
        // Card number is transient: store only last4
    bindInput('payer_card_number', v => {
      const digits = String(v||'').replace(/\D/g,'');
      p.payer.card.last4 = digits.slice(-4);
    });
    bindInput('payer_card_exp', v => p.payer.card.exp = v);
    
    bindInput('payer_hok_bank', v => p.payer.hok.bank = v);
    bindInput('payer_hok_branch', v => p.payer.hok.branch = v);
    bindInput('payer_hok_account', v => p.payer.hok.account = v);
    bindInput('payer_hok_exp', v => p.payer.hok.exp = v);

    // Override payer fields
    bindInput('payer_ov_first', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', relationship:'' }; p.payer.override.firstName = v; });
    bindInput('payer_ov_last', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', relationship:'' }; p.payer.override.lastName = v; });
    bindInput('payer_ov_tz', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', relationship:'' }; p.payer.override.tz = String(v||'').replace(/\D/g,''); });

    const relBtn = $('#payerRelBtn');
    if(relBtn){
      relBtn.addEventListener('click', () => {
        const opts = ['אב','אם','אח','אחות','אחר'];
        const current = (p.payer.override && p.payer.override.relationship) ? p.payer.override.relationship : '';
        // Simple chooser (prompt-like) via small overlay menu
        const overlay = document.createElement('div');
        overlay.style.position='fixed';
        overlay.style.inset='0';
        overlay.style.background='rgba(0,0,0,.18)';
        overlay.style.zIndex='9999';
        overlay.style.display='flex';
        overlay.style.alignItems='center';
        overlay.style.justifyContent='center';
        overlay.innerHTML = `
          <div style="width:min(420px,92vw);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:14px;direction:rtl;font-family:inherit">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
              <div style="font-weight:900">בחירת קרבה</div>
              <button class="btn btnSoft" data-x type="button">סגור</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px">
              ${opts.map(o => `<button class="btn ${o===current?'btnPrimary':'btnSoft'}" data-rel="${escapeAttr(o)}" type="button">${escapeHtml(o)}</button>`).join('')}
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
        overlay.querySelector('[data-x]')?.addEventListener('click', close);
        overlay.querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => {
          if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', relationship:'' };
          p.payer.override.relationship = b.dataset.rel || '';
          markDraft();
          close();
          renderWizard();
        }));
      });
    }


    const toggleBtn = $('#toggleCard');
    if(toggleBtn){
      toggleBtn.addEventListener('click', () => {
        const numEl = $('#payer_card_number');
        if(!numEl) return;
        const isHidden = (numEl.type === 'password');
        numEl.type = isHidden ? 'text' : 'password';
        toggleBtn.textContent = isHidden ? 'הסתר' : 'הצג';
        if(isHidden){
          // Auto-hide after 1.2s
          setTimeout(() => {
            const el = $('#payer_card_number');
            if(el && el.type === 'text'){
              el.type = 'password';
              toggleBtn.textContent = 'הצג';
            }
          }, 1200);
        }
      });
    }

    const copyBtn = $('#copyPayment');
    if(copyBtn){
      copyBtn.addEventListener('click', async () => {
        const numEl = $('#payer_card_number');
        const expEl = $('#payer_card_exp');
        const number = (numEl && numEl.value) ? String(numEl.value).trim() : '';
        const exp = (expEl && expEl.value) ? String(expEl.value).trim() : '';
        if(!number || !exp){ toast('חסר', 'מלאי מספר כרטיס ותוקף לפני העתקה'); return; }
        try{
          await navigator.clipboard.writeText(number + ' | ' + exp);
          toast('הועתק', 'מספר+תוקף הועתקו ללוח');
        }catch(e){
          toast('לא הצליח', 'לא הצלחנו להעתיק (אפשר להעתיק ידנית)');
        }
      });
    }

  }



  function renderSummaryStep(){
    const p = wiz.proposal || {};
    // Defensive defaults (so Summary never renders blank)
    p.customer = p.customer || {};
    p.oldPolicies = Array.isArray(p.oldPolicies) ? p.oldPolicies : [];
    p.newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];
    p.insuredList = Array.isArray(p.insuredList) ? p.insuredList : [];
    p.insuredDetails = p.insuredDetails || {};
    p.payer = p.payer || {};
    p.medical = p.medical || {};

    let insuredCards = '';
    let oldBlock = '';
    let newBlock = '';
    let payBlock = '';
    let medBlock = '';

    try{ insuredCards = renderInsuredCardsForSummary(p); } catch(e){ console.error('summary insuredCards', e); insuredCards = '<div class="sideHint">⚠️ שגיאה בטעינת מבוטחים.</div>'; }
    try{ oldBlock = renderPoliciesByInsured(p, 'old'); } catch(e){ console.error('summary oldBlock', e); oldBlock = '<div class="sideHint">⚠️ שגיאה בטעינת פוליסות קיימות.</div>'; }
    try{ newBlock = renderPoliciesByInsured(p, 'new'); } catch(e){ console.error('summary newBlock', e); newBlock = '<div class="sideHint">⚠️ שגיאה בטעינת פוליסות חדשות.</div>'; }
    try{ payBlock = renderPaymentSummary(p); } catch(e){ console.error('summary payBlock', e); payBlock = '<div class="sideHint">⚠️ שגיאה בטעינת אמצעי תשלום.</div>'; }
    try{ medBlock = renderMedicalFullSummary(p); } catch(e){ console.error('summary medBlock', e); medBlock = '<div class="sideHint">⚠️ שגיאה בטעינת שאלונים רפואיים.</div>'; }


    wizardMain.innerHTML = `
      <div class="sectionTitle">סיכום עסקה</div>

      <div class="sideHint">שיקוף מלא של כל הנתונים שהוזנו – לפי מבוטחים.</div>

      <div class="hr"></div>
      <div class="sectionTitle">מבוטחים</div>
      ${insuredCards}

      <div class="hr"></div>
      <div class="sectionTitle">פוליסות לביטול (בחברה נגדית)</div>
      ${oldBlock}

      <div class="hr"></div>
      <div class="sectionTitle">פוליסות חדשות שנרכשו</div>
      ${newBlock}

      <div class="hr"></div>
      <div class="sectionTitle">אמצעי תשלום</div>
      ${payBlock}

      <div class="hr"></div>
      <div class="sectionTitle">שאלונים (לפי מבוטח)</div>
      ${medBlock}

      <div class="hr"></div>
      <div class="grid2" style="margin-top:10px">
        <button class="btn btnSoft" id="pdfBtn">הדפס / הורד PDF</button>
        <button class="btn btnPrimary" id="markDoneBtn">סמן כנסגר</button>
      </div>
    `;

    const pdfBtnEl = $('#pdfBtn');
    if(pdfBtnEl) pdfBtnEl.addEventListener('click', () => {
      p.pdfGenerated = true;
      openPrintView(p);
      markDraft();
      renderWizard();
      render();
    });

    const markDoneBtnEl = $('#markDoneBtn');
    if(markDoneBtnEl) markDoneBtnEl.addEventListener('click', () => {
      p.status = 'נסגר';
      if(GOOGLE_SCRIPT_URL){
        syncUpProposal(p).then(()=>toast('סנכרון', 'ההצעה נשמרה לשיטס')).catch(()=>toast('סנכרון', 'שגיאה בסנכרון'));
      }
      toast('עודכן', 'ההצעה סומנה כנסגרה');
      savePill.textContent = p.status;
      render();
    });
  }

  function insuredHasAnyData(p, insuredId){
    if(insuredId === 'main') return true;
    const d = (p.insuredDetails && p.insuredDetails[insuredId]) ? p.insuredDetails[insuredId] : {};
    const hasText = Object.values(d||{}).some(v => String(v||'').trim() !== '');
    const hasPolicies = (p.oldPolicies||[]).some(x => (x.insuredId||'main') === insuredId) || (p.newPolicies||[]).some(x => (x.insuredId||'main') === insuredId);
    const hasMedical = !!(p.medical && p.medical[insuredId] && Object.keys(p.medical[insuredId]||{}).length);
    return hasText || hasPolicies || hasMedical;
  }

  function getInsuredDetailsForSummary(p, insuredId){
    if(insuredId === 'main'){
      // normalize display fields on main
      const c = p.customer || {};
      const fullName = c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      return {
        label: labelInsured(insuredId),
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        fullName: fullName || '—',
        tz: c.tz || '',
        mobile: c.mobile || c.phone || '',
        phone: c.phone || c.mobile || '',
        email: c.email || '',
        birthDate: c.birthDate || '',
        gender: c.gender || '',
        hmo: c.hmo || '',
        shaban: c.shaban || '',
        heightCm: c.heightCm || '',
        weightKg: c.weightKg || '',
        smoker: (c.smoker===true || c.smoker==='כן') ? 'כן' : (c.smoker==='לא' ? 'לא' : (c.smoker ? 'כן' : 'לא')),
        smokePerDay: c.smokePerDay || '',
        occupation: c.occupation || '',
        tzIssueDate: c.tzIssueDate || '',
        notes: c.notes || ''
      };
    }
    const d = (p.insuredDetails && p.insuredDetails[insuredId]) ? p.insuredDetails[insuredId] : {};
    const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
    return {
      label: labelInsured(insuredId),
      firstName: d.firstName || '',
      lastName: d.lastName || '',
      fullName: fullName || '—',
      tz: d.tz || '',
      mobile: d.mobile || d.phone || '',
      phone: d.phone || d.mobile || '',
      email: d.email || '',
      birthDate: d.birthDate || '',
      gender: d.gender || '',
      hmo: d.hmo || '',
      shaban: d.shaban || '',
      heightCm: d.heightCm || '',
      weightKg: d.weightKg || '',
      smoker: (d.smoker===true || d.smoker==='כן') ? 'כן' : (d.smoker==='לא' ? 'לא' : (d.smoker ? 'כן' : 'לא')),
      smokePerDay: d.smokePerDay || '',
      occupation: d.occupation || '',
      tzIssueDate: d.tzIssueDate || '',
      notes: d.notes || ''
    };
  }

  function renderKV(label, value){
    const v = (value===undefined || value===null || String(value).trim()==='') ? '—' : escapeHtml(String(value));
    return `<div class="miniStat"><span>${escapeHtml(label)}</span><b>${v}</b></div>`;
  }

  function renderInsuredCardsForSummary(p){
    const list = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));
    if(!list.length) return `<div class="sideHint">אין מבוטחים.</div>`;
    return `
      <div class="grid2">
        ${list.map(ins => {
          const d = getInsuredDetailsForSummary(p, ins.id);
          return `
            <div class="sideCard" style="box-shadow:none">
              <div class="sideTitle">${escapeHtml(d.label)}</div>
              ${renderKV('שם מלא', d.fullName)}
              ${renderKV('ת״ז', d.tz)}
              ${renderKV('נייד', d.mobile || d.phone)}
              ${renderKV('אימייל', d.email)}
              ${renderKV('תאריך לידה', d.birthDate)}
              ${renderKV('מין', d.gender)}
              ${renderKV('קופת חולים', d.hmo)}
              ${renderKV('שב״ן', d.shaban)}
              ${renderKV('גובה', d.heightCm ? (d.heightCm + ' ס״מ') : '')}
              ${renderKV('משקל', d.weightKg ? (d.weightKg + ' ק״ג') : '')}
              ${renderKV('מעשן', d.smoker)}
              ${d.smoker === 'כן' ? renderKV('כמות ליום', d.smokePerDay) : ''}
              ${d.smoker === 'כן' && (d.cannabisMedical || d.cannabisSocial) ? renderKV('קנאביס', [d.cannabisMedical ? 'רפואי' : '', d.cannabisSocial ? 'חברתי' : ''].filter(Boolean).join(' + ')) : ''}
              ${d.smoker === 'כן' && (d.cannabisMedical || d.cannabisSocial) ? renderKV('קנאביס', [d.cannabisMedical ? 'רפואי' : '', d.cannabisSocial ? 'חברתי' : ''].filter(Boolean).join(' + ')) : ''}
              ${renderKV('עיסוק', d.occupation)}
              ${renderKV('הנפקת ת.ז', d.tzIssueDate)}
              ${d.notes ? `<div class="hr" style="margin:10px 0"></div><div class="sideHint"><b>הערות:</b> ${escapeHtml(d.notes)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPoliciesByInsured(p, kind){
    const srcRaw = (kind === 'old') ? (p.oldPolicies||[]) : (p.newPolicies||[]);
    const src = (kind === 'old') ? srcRaw.filter(x => (x && ((x.decision||x.action||'cancel') !== 'keep'))) : srcRaw;
    const labelEmpty = (kind === 'old') ? 'אין פוליסות לביטול.' : 'אין פוליסות חדשות.';
    const list = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));
    const groups = {};
    src.forEach(x => {
      const id = (x.insuredId || 'main');
      (groups[id] = groups[id] || []).push(x);
    });

    const blocks = list.map(ins => {
      const rows = (groups[ins.id] || []);
      if(!rows.length) return '';
      return `
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">${escapeHtml(labelInsured(ins.id))}</div>
          <div class="tableWrap" style="margin-top:6px">
            <table class="table">
              <thead>
                <tr>
                  ${kind==='old' ? '<th>חברה</th><th>מוצר</th><th>פרמיה</th>' : '<th>חברה</th><th>מוצר</th><th>פרמיה</th><th>הנחה</th>'}
                </tr>
              </thead>
              <tbody>
                ${rows.map(x => `
                  <tr>
                    <td>${escapeHtml(x.company||'')}</td>
                    <td>${escapeHtml(x.product||'')}</td>
                    <td>${money(x.premium||0)}</td>
                    ${kind==='old' ? '' : `<td>${escapeHtml(summarizeDiscount(x.discount))}</td>`}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).filter(Boolean);

    return blocks.length ? blocks.join('') : `<div class="sideHint">${labelEmpty}</div>`;
  }

  function renderPaymentSummary(p){
    const pay = p.payer || null;
    if(!pay) return `<div class="sideHint">לא הוזן אמצעי תשלום.</div>`;
    const method = pay.method || 'card';
    if(method === 'card'){
      const c = pay.card || {};
      return `
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">כרטיס אשראי</div>
          ${renderKV('ת״ז בעל הכרטיס', c.tz)}
          ${renderKV('שם בעל הכרטיס', c.name)}
          ${renderKV('4 ספרות אחרונות', c.last4 ? ('**** ' + c.last4) : '')}
          ${renderKV('תוקף', c.exp)}
        </div>
      `;
    }
    if(method === 'hok'){
      const h = pay.hok || {};
      return `
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">הוראת קבע (הו״ק)</div>
          ${renderKV('בנק', h.bank)}
          ${renderKV('סניף', h.branch)}
          ${renderKV('מספר חשבון', h.account)}
          ${renderKV('תוקף', h.exp)}
        </div>
      `;
    }
    return `<div class="sideHint">אמצעי תשלום לא מזוהה.</div>`;
  }

  function getQuestionLabelMap(){
    // Map question id -> {label, type, details, detailsLabel}
    const map = {};
    const qn = questionnaires['DEFAULT|MEDICAL'];
    if(!qn || !qn.steps) return map;
    qn.steps.forEach(step => {
      (step.questions||[]).forEach(q => {
        map[q.id] = { label:q.label, type:q.type, details:!!q.details, detailsLabel:q.detailsLabel || 'פירוט' };
      });
    });
    return map;
  }

  function renderMedicalFullSummary(p){
    const qMap = getQuestionLabelMap();
    const list = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));
    const blocks = [];

    for(const ins of list){
      const bucketSet = p.medical && p.medical[ins.id];
      if(!bucketSet){ continue; }

      // prefer DEFAULT|MEDICAL
      const bucket = bucketSet['DEFAULT|MEDICAL'] || bucketSet[Object.keys(bucketSet)[0]];
      if(!bucket || !Object.keys(bucket).length) continue;

      const rows = [];
      for(const [k,v] of Object.entries(bucket)){
        if(String(k).endsWith('_details')) continue;
        const meta = qMap[k] || null;
        const label = meta ? meta.label : k;
        const val = (v===undefined || v===null || String(v).trim()==='') ? '—' : String(v);
        let extra = '';
        if(meta && meta.details && val === 'כן'){
          const det = bucket[k + '_details'];
          if(det && String(det).trim()!==''){
            extra = ` <span style="color:rgba(18,19,25,.55)">(${escapeHtml(meta.detailsLabel)}: ${escapeHtml(String(det))})</span>`;
          }
        }
        rows.push(`<tr><td style="width:65%">${escapeHtml(label)}</td><td>${escapeHtml(val)}${extra}</td></tr>`);
      }

      blocks.push(`
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">${escapeHtml(labelInsured(ins.id))}</div>
          <div class="tableWrap" style="margin-top:6px">
            <table class="table">
              <thead><tr><th>שאלה</th><th>תשובה</th></tr></thead>
              <tbody>${rows.length ? rows.join('') : `<tr><td colspan="2">אין תשובות</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      `);
    }

    return blocks.length ? blocks.join('') : `<div class="sideHint">אין שאלונים שמולאו עדיין.</div>`;
  }


  function renderMedicalSummary(p){
    const blocks = [];
    for(const insured of p.insuredList){
      const m = p.medical[insured.id];
      if(!m){ continue; }
      const keys = Object.keys(m);
      if(!keys.length) continue;
      blocks.push(`<div class="sideHint"><b>${escapeHtml(insured.label)}:</b> ${keys.map(k => escapeHtml(k==='DEFAULT|MEDICAL' ? 'שאלון רפואי (ברירת מחדל)' : k.replace('|',' • '))).join(', ')}</div>`);
    }
    return blocks.length ? blocks.join('') : `<div class="sideHint">אין תשובות עדיין.</div>`;
  }


  // ---------- PDF (Client-side print to PDF) ----------
  function openPrintView(proposal){
    const w = window.open('', '_blank');
    if(!w){ toast('חסום', 'הדפדפן חסם חלון קופץ'); return; }

    const p = proposal;
    try {

    function esc(v){ return escapeHtml(String(v||'').trim()||'—'); }

    const insuredList = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));

    const insuredBlocks = insuredList.map(ins => {
      const d = getInsuredDetailsForSummary(p, ins.id);
      return `
        <div class="ibox">
          <div class="ititle">${esc(d.label)}</div>
          <div class="igrid">
            <div><b>שם מלא:</b> ${esc(d.fullName)}</div>
            <div><b>ת״ז:</b> ${esc(d.tz)}</div>
            <div><b>נייד:</b> ${esc(d.mobile || d.phone)}</div>
            <div><b>אימייל:</b> ${esc(d.email)}</div>
            <div><b>תאריך לידה:</b> ${esc(d.birthDate)}</div>
            <div><b>מין:</b> ${esc(d.gender)}</div>
            <div><b>קופת חולים:</b> ${esc(d.hmo)}</div>
            <div><b>שב״ן:</b> ${esc(d.shaban)}</div>
            <div><b>גובה:</b> ${d.heightCm ? esc(d.heightCm + ' ס״מ') : '—'}</div>
            <div><b>משקל:</b> ${d.weightKg ? esc(d.weightKg + ' ק״ג') : '—'}</div>
            <div><b>מעשן:</b> ${esc(d.smoker)}</div>
            ${d.smoker === 'כן' && (d.cannabisMedical || d.cannabisSocial) ? ('<div><b>קנאביס:</b> ' + esc([d.cannabisMedical ? 'רפואי' : '', d.cannabisSocial ? 'חברתי' : ''].filter(Boolean).join(' + ')) + '</div>') : ''}
            <div><b>עיסוק:</b> ${esc(d.occupation)}</div>
          </div>
          ${d.notes ? `<div class="inotes"><b>הערות:</b> ${esc(d.notes)}</div>` : ''}
        </div>
      `;
    }).join('');

    function policiesTable(kind){
      const src = (kind==='old') ? (p.oldPolicies||[]) : (p.newPolicies||[]);
      const groups = {};
      src.forEach(x => {
        const id = (x.insuredId || 'main');
        (groups[id] = groups[id] || []).push(x);
      });

      const blocks = insuredList.map(ins => {
        const rows = (groups[ins.id] || []);
        if(!rows.length) return '';
        return `
          <div class="ibox">
            <div class="ititle">${esc(labelInsured(ins.id))}</div>
            <table>
              <thead>
                <tr>
                  <th>חברה</th>
                  <th>מוצר</th>
                  <th>פרמיה</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(x => `<tr><td>${esc(x.company)}</td><td>${esc(x.product)}</td><td>${money(x.premium||0)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).filter(Boolean);

      return blocks.length ? blocks.join('') : `<div class="muted">אין</div>`;
    }

    function paymentBlock(){
      const pay = p.payer || null;
      if(!pay) return `<div class="muted">לא הוזן אמצעי תשלום.</div>`;
      const method = pay.method || 'card';
      if(method==='card'){
        const c = pay.card || {};
        return `
          <div class="ibox">
            <div class="ititle">כרטיס אשראי</div>
            <div><b>ת״ז בעל הכרטיס:</b> ${esc(c.tz)}</div>
            <div><b>שם בעל הכרטיס:</b> ${esc(c.name)}</div>
            <div><b>4 ספרות אחרונות:</b> ${c.last4 ? esc('**** ' + c.last4) : '—'}</div>
            <div><b>תוקף:</b> ${esc(c.exp)}</div>
          </div>
        `;
      }
      if(method==='hok'){
        const h = pay.hok || {};
        return `
          <div class="ibox">
            <div class="ititle">הוראת קבע (הו״ק)</div>
            <div><b>בנק:</b> ${esc(h.bank)}</div>
            <div><b>סניף:</b> ${esc(h.branch)}</div>
            <div><b>מספר חשבון:</b> ${esc(h.account)}</div>
            <div><b>תוקף:</b> ${esc(h.exp)}</div>
          </div>
        `;
      }
      return `<div class="muted">אמצעי תשלום לא מזוהה.</div>`;
    }

    function medicalTables(){
      const qMap = getQuestionLabelMap();
      const out = [];

      for(const ins of insuredList){
        const bucketSet = p.medical && p.medical[ins.id];
        if(!bucketSet) continue;
        const bucket = bucketSet['DEFAULT|MEDICAL'] || bucketSet[Object.keys(bucketSet)[0]];
        if(!bucket || !Object.keys(bucket).length) continue;

        const rows = [];
        for(const [k,v] of Object.entries(bucket)){
          if(String(k).endsWith('_details')) continue;
          const meta = qMap[k] || null;
          const label = meta ? meta.label : k;
          const val = (v===undefined || v===null || String(v).trim()==='') ? '—' : String(v);
          let extra = '';
          if(meta && meta.details && val === 'כן'){
            const det = bucket[k + '_details'];
            if(det && String(det).trim()!==''){
              extra = ` (${meta.detailsLabel}: ${String(det)})`;
            }
          }
          rows.push(`<tr><td>${esc(label)}</td><td>${esc(val + extra)}</td></tr>`);
        }

        out.push(`
          <div class="ibox">
            <div class="ititle">שאלון – ${esc(labelInsured(ins.id))}</div>
            <table>
              <thead><tr><th>שאלה</th><th>תשובה</th></tr></thead>
              <tbody>${rows.length ? rows.join('') : `<tr><td colspan="2">אין תשובות</td></tr>`}</tbody>
            </table>
          </div>
        `);
      }

      return out.length ? out.join('') : `<div class="muted">אין שאלונים שמולאו.</div>`;
    }

    const html = `
      <html lang="he" dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>סיכום עסקה - ${escapeHtml((p.customer && (p.customer.fullName||'')) || '')}</title>
        <style>
          body{font-family:Arial, sans-serif; margin:24px; color:#121319}
          h1{margin:0 0 6px}
          .sub{color:#666; margin-bottom:16px}
          h2{margin:18px 0 10px}
          table{width:100%; border-collapse:collapse; margin:10px 0 0}
          th,td{border:1px solid #ddd; padding:8px; text-align:right; font-size:13px; vertical-align:top}
          th{background:#f7f6f2}
          .ibox{border:1px solid #ddd; padding:12px; border-radius:10px; margin:10px 0}
          .ititle{font-weight:700; margin-bottom:8px}
          .igrid{display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:6px 14px}
          .muted{color:#666; font-size:12px}
          .inotes{margin-top:8px; padding-top:8px; border-top:1px dashed #ddd}
          @media print{
            body{margin:14px}
          }
        </style>
      </head>
      <body>
        <h1>סיכום עסקה</h1>
        <div class="sub">GEMEL INVEST • ${new Date(p.createdAt).toLocaleString('he-IL')}</div>

        <h2>מבוטחים</h2>
        ${insuredBlocks || '<div class="muted">אין</div>'}

        <h2>פוליסות לביטול (בחברה נגדית)</h2>
        ${policiesTable('old')}

        <h2>פוליסות חדשות שנרכשו</h2>
        ${policiesTable('new')}

        <h2>אמצעי תשלום</h2>
        ${paymentBlock()}

        <h2>שאלונים</h2>
        ${medicalTables()}

        <div class="muted" style="margin-top:14px">כדי להוריד כ־PDF: הדפס → Save as PDF</div>
        <script>window.print();</script>
      </body></html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    } catch(e){
      console.error(e);
      try{
        w.document.open();
        w.document.write(`<html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>שגיאה</title></head>
          <body style="font-family:Arial;padding:18px">
            <h2>שגיאה ביצירת קובץ הסיכום</h2>
            <div>בדרך כלל זה קורה בגלל נתון לא תקין במסך הסיכום.</div>
            <div style="margin-top:10px" class="muted">פתח קונסול (F12) כדי לראות פרטים.</div>
          </body></html>`);
        w.document.close();
      }catch(_){}
      toast('שגיאה', 'לא הצלחתי ליצור PDF. נסה שוב');
    }
  }



  // ---------- Completion (What is missing) ----------
  function computeCompletion(p){
    const cust = p.customer || {};

    // Customer: rely on name + ID + phone.
    // (birthDate/gender are not always collected in the current flow)
    const fullName = String(cust.fullName || ((cust.firstName||'') + ' ' + (cust.lastName||'')).trim()).trim();
    const hasName = !!fullName;
    const hasTz = !!String(cust.tz || '').trim();
    const hasPhone = !!String(cust.mobile || cust.phone || '').trim();
    const okCustomer = hasName && hasTz && hasPhone;

    const okOld = Array.isArray(p.oldPolicies) && p.oldPolicies.length > 0;
    const okNew = Array.isArray(p.newPolicies) && p.newPolicies.length > 0;

    // Medical: require at least one answered field for each insured
    const insuredList = Array.isArray(p.insuredList) ? p.insuredList : [];
    let okMedical = true;
    if(insuredList.length){
      for(const ins of insuredList){
        const bucket = p.medical && p.medical[ins.id] && (p.medical[ins.id]['DEFAULT|MEDICAL'] || p.medical[ins.id][Object.keys(p.medical[ins.id])[0]]);
        const hasAny = bucket && Object.keys(bucket).length > 0;
        if(!hasAny){ okMedical = false; break; }
      }
    } else {
      okMedical = false;
    }

    const payer = p.payer || {};
    const method = payer.method || '';

    // Card number is intentionally NOT stored (only last4), so completion must check last4.
    const baseOkPayer = (method === 'card')
      ? !!(payer.card && payer.card.tz && payer.card.name && payer.card.exp && payer.card.last4)
      : (method === 'hok')
        ? !!(payer.hok && payer.hok.bank && payer.hok.branch && payer.hok.account)
        : false;

    const ov = payer.override || {};
    const okOverride = !ov.enabled ? true : !!(String(ov.firstName||'').trim() && String(ov.lastName||'').trim() && String(ov.tz||'').trim() && String(ov.relationship||'').trim());

    const okPayer = baseOkPayer && okOverride;

    const okPdf = !!p.pdfGenerated;

    const items = [
      { key:'customer', label:'פרטי לקוח', ok: okCustomer },
      { key:'old', label:'פוליסות', ok: okOld },
      { key:'new', label:'רכישות', ok: okNew },
      { key:'medical', label:'שאלון', ok: okMedical },
      { key:'payer', label:'משלם', ok: okPayer },
      { key:'pdf', label:'PDF', ok: okPdf },
    ];

    const done = items.filter(i => i.ok).length;
    const total = items.length;
    let level = 'bad';
    if(done === total) level = 'ok';
    else if(done >= Math.ceil(total/2)) level = 'mid';
    return { items, done, total, level };
  }

  function proposalProgressCell(p){
    const comp = computeCompletion(p);
    return `<div class="compRow"><span class="compBadge ${comp.level}"><span class="compDot"></span>${comp.done}/${comp.total}</span></div>`;
  }

  function customerProgressCell(customerId){
    const rel = state.proposals.filter(p => p.customerId === customerId || (p.customer && p.customer.id === customerId));
    if(!rel.length) return '<span style="color:rgba(18,19,25,.55);font-size:12px">—</span>';
    const p = rel[0];
    const comp = computeCompletion(p);
    // compact: show done/total + 3 key badges
    const keyMap = ['customer','medical','pdf'];
    const chips = comp.items.filter(i => keyMap.includes(i.key)).map(i => {
      const cls = i.ok ? 'ok' : 'bad';
      return `<span class="compBadge ${cls}" title="${escapeAttr(i.label + ': ' + (i.ok?'הושלם':'חסר'))}"><span class="compDot"></span>${escapeHtml(i.label)}</span>`;
    }).join('');
    return `<div class="compRow"><span class="compBadge ${comp.level}"><span class="compDot"></span>${comp.done}/${comp.total}</span>${chips}</div>`;
  }

  function renderCompletionBadges(comp){
    return `<div class="compRow">` + comp.items.map(i => {
      const cls = i.ok ? 'ok' : 'bad';
      return `<span class="compBadge ${cls}" title="${escapeAttr(i.label + ': ' + (i.ok?'הושלם':'חסר'))}"><span class="compDot"></span>${escapeHtml(i.label)}</span>`;
    }).join('') + `</div>`;
  }

  // ---------- Helpers ----------
  function renderSmallList(items){
    if(!items.length) return `<div class="sideHint">אין פריטים.</div>`;
    return `<ul style="margin:8px 18px">${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  }

  function field(label, id, value){
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" value="${escapeHtml(value||'')}" />
      </div>
    `;
  }

  function numField(label, id, value){
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" type="number" inputmode="decimal" placeholder="0" value="${escapeHtml(value||'')}" />
      </div>
    `;
  }

  function selectField(label, id, options){
    const opts = options.map(o => {
      const [val, text] = String(o).includes('|') ? String(o).split('|') : [o,o];
      return `<option value="${escapeAttr(val)}">${escapeHtml(text)}</option>`;
    }).join('');
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <select id="${id}">${opts}</select>
      </div>
    `;
  }


  function dateField(label, id, value){
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" type="date" value="${escapeAttr(value||'')}" />
      </div>
    `;
  }

  
  function setSelect(id, value){
    // Backward compatible alias (older code used setSelect)
    setSelectValue(id, value);
  }

function setSelectValue(id, value){
    const el = document.getElementById(id);
    if(!el) return;
    if(value && Array.from(el.options).some(o => o.value === value)){
      el.value = value;
    }
  }

  function bindSelect(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', () => {
      onChange(el.value);
      markDraft();
    });
  }


  function bindDate(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', () => {
      onChange(el.value);
      markDraft();
    });
  }


  function toggleSmokeRow(show){
    const row = document.getElementById('smokeRow');
    if(!row) return;
    row.style.display = show ? 'grid' : 'none';
  }

  function syncDisplayName(p){
    const fn = (p.customer.firstName || '').trim();
    const ln = (p.customer.lastName || '').trim();
    const full = (fn + ' ' + ln).trim();
    p.customer.fullName = full;
    p.customerName = full;
    const titleEl = document.getElementById('wizardTitle');
    if(titleEl) titleEl.textContent = full ? `הצעה – ${full}` : 'הצעה חדשה';
  }

  function bindInput(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('input', () => {
      onChange(el.value);
      markDraft();
    });
  }

  function bindCheck(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', () => {
      onChange(!!el.checked);
      markDraft();
    });
  }

  function bindTextarea(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('input', () => {
      onChange(el.value);
      markDraft();
    });
  }


  function markDraft(){
    if(!wiz) return;
    wiz.proposal.status = 'טיוטה';
    savePill.textContent = 'טיוטה';
    updateSums();
  }

  function updateSums(){
    if(!wiz) return;
    const p = wiz.proposal;
    const oldSum = p.oldPolicies.reduce((a,x)=>a+(+x.premium||0),0);
    const newSum = p.newPolicies.reduce((a,x)=>a+(+x.premium||0),0);
    sumOld.textContent = money(oldSum);
    sumNew.textContent = money(newSum);
    sumTotal.textContent = money(oldSum + newSum);
  }

  function labelInsured(id){
    const it = (wiz && wiz.proposal.insuredList.find(x => x.id === id)) || state.proposals[0]?.insuredList?.find(x=>x.id===id);
    if(it) return it.label;
    if(id==='main') return 'מבוטח ראשי';
    if(id==='spouse') return 'בן/בת זוג';
    if(id==='child') return 'ילד';
    return 'מבוטח';
  }

  function chip(text, kind){
    const cls = kind || (text === 'פעיל' ? 'ok' : 'warn');
    return `<span class="chip ${cls}">${escapeHtml(text)}</span>`;
  }

  function money(n){
    const v = (Math.round((Number(n)||0)*100)/100).toFixed(0);
    return v.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ₪';
  }

// ---------- Discounts (per policy) ----------
function summarizeDiscount(d){
  if(!d) return '';
  const parts = [];
  if(d.tier && String(d.tier).trim() && String(d.tier).trim() !== '0%') parts.push('מדורג: ' + String(d.tier).trim());
  if(Array.isArray(d.types) && d.types.length) parts.push(d.types.join(' / '));
  if(d.note && String(d.note).trim()) parts.push(String(d.note).trim());
  return parts.join(' | ');
}

function openPolicyDiscountsModal(policy, onSave){
  const current = policy && policy.discount ? policy.discount : { tier:'', types:[], note:'' };
  const TIERS = ['','5%','10%','15%','20%','25%','30%'];
  const TYPES = [
    'הנחת ילדים',
    'הנחת משפחה',
    'הנחת קולקטיב/מעסיק',
    'הנחת מעבר חברה',
    'הנחת סוכן',
    'אחר'
  ];

  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.background='rgba(0,0,0,0.18)';
  overlay.style.zIndex='10050';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='18px';

  const esc = (s)=>escapeHtml(String(s||''));
  overlay.innerHTML = `
    <div style="width:min(560px,95vw);background:rgba(255,255,255,0.98);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,0.28);padding:14px;direction:rtl;font-family:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="font-weight:900">הנחות לפוליסה</div>
        <button class="btn btnSoft" type="button" data-x>סגור</button>
      </div>

      <div class="field">
        <label>הנחה מדורגת (אחוז)</label>
        <select id="discTier">
          ${TIERS.map(t => `<option value="${esc(t)}" ${String(current.tier||'')===String(t)?'selected':''}>${t?esc(t):'ללא'}</option>`).join('')}
        </select>
      </div>

      <div class="field" style="margin-top:10px">
        <label>סוגי הנחה</label>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${TYPES.map(t => {
            const checked = (current.types||[]).includes(t);
            return `
              <label style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(18,19,21,0.10);border-radius:12px;background:rgba(250,250,250,0.9)">
                <input type="checkbox" value="${esc(t)}" ${checked?'checked':''} style="width:16px;height:16px"/>
                <span>${esc(t)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <div class="field" style="margin-top:10px">
        <label>פירוט (אופציונלי)</label>
        <textarea id="discNote" placeholder="כתוב במילים מה ההנחה שניתנה...">${esc(current.note||'')}</textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-start;margin-top:12px;flex-wrap:wrap">
        <button class="btn btnPrimary" type="button" data-save>שמירה</button>
        <button class="btn btnSoft" type="button" data-clear>ניקוי הנחות</button>
      </div>
    </div>
  `;

  const close = () => { overlay.remove(); };
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);

  overlay.querySelector('[data-clear]').addEventListener('click', () => {
    onSave(null);
    close();
  });

  overlay.querySelector('[data-save]').addEventListener('click', () => {
    const tier = overlay.querySelector('#discTier').value || '';
    const types = Array.from(overlay.querySelectorAll('input[type="checkbox"]'))
      .filter(x => x.checked).map(x => x.value);
    const note = overlay.querySelector('#discNote').value || '';
    const payload = (tier || types.length || note.trim()) ? { tier, types, note } : null;
    onSave(payload);
    close();
  });

  document.body.appendChild(overlay);
}




  function debounce(fn, wait){
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function toast(title, msg){
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(msg)}</span>`;
    toastHost.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  // Medical questions
  function renderQuestion(q, answers){
    if(q.type === 'yesno'){
      const val = answers[q.id];
      const detKey = q.id + '_details';
      const detVal = answers[detKey] || '';
      const showDetails = q.details && val === 'כן';
      return `
        <div class="sideCard" style="box-shadow:none;border-radius:14px;margin-bottom:10px">
          <div class="field">
            <label>${escapeHtml(q.label)}</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btnSoft" type="button" data-yn="${q.id}" data-val="כן" style="padding:8px 12px;${val==='כן'?'border-color:rgba(214,178,94,.35);box-shadow:0 0 0 3px var(--goldSoft)':''}">כן</button>
              <button class="btn btnSoft" type="button" data-yn="${q.id}" data-val="לא" style="padding:8px 12px;${val==='לא'?'border-color:rgba(214,178,94,.35);box-shadow:0 0 0 3px var(--goldSoft)':''}">לא</button>
            </div>
          </div>
          ${q.details ? `
            <div class="field" style="margin-top:10px;${showDetails?'':'display:none'}" data-details-wrap="${q.id}">
              <label>${escapeHtml(q.detailsLabel || 'פירוט')}</label>
              <input id="det_${escapeAttr(q.id)}" value="${escapeHtml(detVal)}" placeholder="כתוב פירוט..."/>
            </div>
          `:''}
        </div>
      `;
    }
    if(q.type === 'text'){
      const val = answers[q.id] || '';
      return `
        <div class="field" style="margin-bottom:10px">
          <label>${escapeHtml(q.label)}</label>
          <textarea id="txt_${escapeAttr(q.id)}" placeholder="כתוב...">${escapeHtml(val)}</textarea>
        </div>
      `;
    }
    return '';
  }

  function bindQuestion(q, answers){
    if(q.type === 'yesno'){
      $$(`[data-yn="${cssEscape(q.id)}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const v = btn.getAttribute('data-val');
          answers[q.id] = v;
          if(q.details){
            const wrap = $(`[data-details-wrap="${cssEscape(q.id)}"]`);
            if(wrap) wrap.style.display = (v === 'כן') ? '' : 'none';
          }
          markDraft();
          renderMedicalStep(); // rerender to update button highlight
        });
      });
      if(q.details){
        const det = $(`#det_${cssEscape(q.id)}`);
        if(det){
          det.addEventListener('input', () => {
            answers[q.id + '_details'] = det.value;
            markDraft();
          });
        }
      }
    }
    if(q.type === 'text'){
      const el = $(`#txt_${cssEscape(q.id)}`);
      if(el){
        el.addEventListener('input', () => {
          answers[q.id] = el.value;
          markDraft();
        });
      }
    }
  }

  // minimal css escape for querySelector
  function cssEscape(s){
    return String(s).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  }


  // ---------- Sync (Sheets) ----------
  async function syncDown(){
    // Pull customers + proposals from server (if available)
    const c = await apiCall('listCustomers', {});
    if(c && c.ok && Array.isArray(c.customers)){
      state.customers = c.customers;
    }
    const p = await apiCall('listProposals', {});
    if(p && p.ok && Array.isArray(p.proposals)){
      state.proposals = p.proposals;
    }
  }

  async function syncUpCustomer(customer){
    const r = await apiCall('upsertCustomer', { customer });
    if(r && r.ok && r.customer){
      // Update local
      const idx = state.customers.findIndex(x => x.id === r.customer.id);
      if(idx >= 0) state.customers[idx] = r.customer;
      else state.customers.unshift(r.customer);
    }
    return r;
  }

  async function syncUpProposal(proposal){
    const r = await apiCall('upsertProposal', { proposal });
    if(r && r.ok && r.proposal){
      const idx = state.proposals.findIndex(x => x.id === r.proposal.id);
      if(idx >= 0) state.proposals[idx] = r.proposal;
      else state.proposals.unshift(r.proposal);
    }
    return r;
  }

  // Init
  loadProcesses_();
  render();

  // Auto-connect + initial sync
  (async () => {
    state.server.url = GOOGLE_SCRIPT_URL || '';
    if(AUTO_CONNECT && GOOGLE_SCRIPT_URL){
      const ping = await apiPing();
      state.connected = !!ping.ok;
      if(state.connected){
        toast('מחובר', 'מחובר לשרת Google Sheets');
        await syncDown();
      }else{
        toast('לא מחובר', 'לא הצלחנו להתחבר לשרת (עובד בדמו)');
      }
      render();
    }
  })();
// ================= CLOUD SYNC =================

async function cloudLoadStart(){
  try{
    const res = await apiCall("loadAll");
    if(res && res.data){
      state = res.data;
      if(typeof renderAll === "function") renderAll();
      console.log("Cloud loaded");
    }
  }catch(e){
    console.log("Cloud load error", e);
  }
}

async function cloudSave(){
  try{
    await apiCall("saveAll", state);
    console.log("Cloud saved");
  }catch(e){
    console.log("Cloud save error", e);
  }
}

// הפעלה בכניסה למערכת
if(AUTO_CONNECT){
  window.addEventListener("load", ()=>{
    setTimeout(cloudLoadStart, 800);
  });
}

// חיבור לשמירה קיימת במערכת
const _origSave = window.saveState || function(){};
window.saveState = function(){
  _origSave();
  cloudSave();
};

})();
// ===== בדיקת חיבור לגוגל =====
async function testGoogleConnection(){
  try{
    const r = await fetch(GOOGLE_SCRIPT_URL + "?action=ping");
    const j = await r.json();

    if(j.ok){
      alert("מחובר לגוגל שיטס");
    }else{
      alert("אין חיבור");
    }
  }catch(e){
    alert("שגיאת חיבור");
    console.log(e);
  }
}

// חיבור לכפתור
window.addEventListener("load", ()=>{
  const btn = document.querySelector("#testGoogle");
  if(btn){
    btn.addEventListener("click", testGoogleConnection);
  }
});
