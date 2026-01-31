// LEADUP • Refactor Full • build 20260131
// Hotfix v3 (save-lead reliability + diagnostics) • 2026-01-31
// ===== script block 2 extracted from index (13).html =====

/* =======================
   LEADUP • Local CRM
   ======================= */

const LS_KEY = "leadup_v1";
const CFG_KEY = "leadup_cfg_v1";

// Build watermark for cache/debug
const BUILD_ID = "2026-01-31_v3";
console.log("LEADUP loaded", BUILD_ID, "at", new Date().toISOString());

// Global diagnostics: surface silent errors that can make buttons feel "dead"
window.__leadupErrors = window.__leadupErrors || [];
window.addEventListener("error", (ev)=>{
  try{
    window.__leadupErrors.push({ t: Date.now(), kind:"error", msg: String(ev?.message||""), src: String(ev?.filename||""), line: ev?.lineno, col: ev?.colno });
  }catch(e){}
});
window.addEventListener("unhandledrejection", (ev)=>{
  try{
    const r = ev?.reason;
    window.__leadupErrors.push({ t: Date.now(), kind:"promise", msg: String(r?.message || r || "unhandled rejection") });
  }catch(e){}
});

const el = (id)=>document.getElementById(id);
const nowISO = () => new Date().toISOString();
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));

function escapeHTML(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fmtDT(iso){
  if(!iso) return "—";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", { dateStyle:"medium", timeStyle:"short" });
}
function todayKey(){
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
}
function toLocalDT(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "";
  const pad = (x)=>String(x).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromLocalDT(local){
  if(!local) return "";
  const d = new Date(local);
  if(Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function uid(prefix="id"){
  return prefix + "_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function defaultState(){
  return {
    user: { name: "", role: "Admin" },
    leads: [],
    tasks: [],
    events: []
  };
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  }catch(e){
    return defaultState();
  }
}
const appState = loadState();
// Expose state for modules that rely on it (mirror/esign etc.)
window.appState = appState;


/* =======================
   Google Sheets Sync
   ======================= */

function loadCfg(){
  try{
    const raw = localStorage.getItem(CFG_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return {
      mode: cfg.mode === "sheets" ? "sheets" : "local",
      webAppUrl: (cfg.webAppUrl || "").trim(),
      autoSync: cfg.autoSync !== false,
      lastOkAt: cfg.lastOkAt || null
    };
  }catch(e){
    return { mode:"local", webAppUrl:"", autoSync:true, lastOkAt:null };
  }
}
function saveCfg(partial){
  const cfg = Object.assign(loadCfg(), partial || {});
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  return cfg;
}
let appCfg = loadCfg();

function gsSetStatus(txt, ok){
  const n = el("gsStatus");
  if(!n) return;
  n.textContent = txt;
  n.style.borderColor = ok ? "rgba(46,229,157,.35)" : "rgba(255,107,107,.35)";
  n.style.background = ok ? "rgba(46,229,157,.08)" : "rgba(255,107,107,.07)";
}

function normalizeWebAppUrl(u){
  u = (u||"").trim();
  // allow user to paste /dev or /exec – both OK, but exec is recommended
  return u;
}

async function gsFetch(url, opts){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 15000);
  try{
    const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts||{}));
    const txt = await res.text();
    let data = null;
    try{ data = txt ? JSON.parse(txt) : null; }catch(e){}
    if(!res.ok){
      throw new Error((data && (data.error||data.message)) || ("HTTP " + res.status));
    }
    return data;
  }finally{
    clearTimeout(t);
  }
}

async function gsPing(){
  const url = normalizeWebAppUrl(appCfg.webAppUrl);
  if(!url) throw new Error("חסר URL של Web App");
  const data = await gsFetch(url + "?action=ping", { method:"GET" });
  if(!data || data.ok !== true) throw new Error("תגובה לא צפויה מהשרת");
  appCfg = saveCfg({ lastOkAt: nowISO() });
  return data;
}

async function gsPull(){
  const url = normalizeWebAppUrl(appCfg.webAppUrl);
  if(!url) throw new Error("חסר URL של Web App");
  const data = await gsFetch(url + "?action=get", { method:"GET" });
  if(!data || data.ok !== true) throw new Error("לא התקבל payload תקין");
  const next = (data.payload && typeof data.payload==="object") ? data.payload : {};
  appState.leads = Array.isArray(next.leads) ? next.leads : [];
  appState.tasks = Array.isArray(next.tasks) ? next.tasks : [];
  appState.events = Array.isArray(next.events) ? next.events : [];
  appState.leadsSeq = next.leadsSeq || appState.leadsSeq || 1;
  appState.tasksSeq = next.tasksSeq || appState.tasksSeq || 1;
  appState.lastSavedAt = nowISO();
  saveState(); // also re-render
  return data;
}

let _gsPushTimer = null;
function gsPushDebounced(ms=900){
  if(_gsPushTimer) clearTimeout(_gsPushTimer);
  _gsPushTimer = setTimeout(()=>{ gsPush().catch(()=>{}); }, ms);
}

async function gsPush(){
  const url = normalizeWebAppUrl(appCfg.webAppUrl);
  if(!url) throw new Error("חסר URL של Web App");
  const body = JSON.stringify({
    action: "put",
    payload: appState,
    meta: { app:"LEADUP", version:"202601312" }
  });
  const data = await gsFetch(url, {
    method:"POST",
    headers: { "Content-Type":"text/plain;charset=utf-8" },
    body
  });
  if(!data || data.ok !== true) throw new Error("שמירה לשיט נכשלה");
  appCfg = saveCfg({ lastOkAt: nowISO() });
  return data;
}

function updateGsUI(){
  const btn = el("gsModeBtn");
  const urlInp = el("gsUrl");
  const auto = el("gsAuto");
  if(btn) btn.textContent = "🔁 מצב: " + (appCfg.mode === "sheets" ? "Google Sheets" : "Local");
  if(urlInp) urlInp.value = appCfg.webAppUrl || "";
  if(auto) auto.checked = !!appCfg.autoSync;
  if(appCfg.mode === "sheets"){
    const errN = (window.__leadupErrors && window.__leadupErrors.length) ? ` • ⚠️ ${window.__leadupErrors.length} שגיאות` : "";
    gsSetStatus((appCfg.lastOkAt ? "מחובר (נבדק לאחרונה)" : "מוכן לחיבור") + ` • ${BUILD_ID}` + errN, true);
  }else{
    const errN = (window.__leadupErrors && window.__leadupErrors.length) ? ` • ⚠️ ${window.__leadupErrors.length} שגיאות` : "";
    gsSetStatus(`Local בלבד • ${BUILD_ID}` + errN, true);
  }
}

function wireGsUI(){
  // Settings screen may not exist in some builds
  const btn = el("gsModeBtn");
  const urlInp = el("gsUrl");
  const auto = el("gsAuto");
  el("gsTest")?.addEventListener("click", async ()=>{
    try{
      appCfg = saveCfg({ webAppUrl: normalizeWebAppUrl(urlInp?.value||""), autoSync: !!auto?.checked });
      updateGsUI();
      gsSetStatus("בודק חיבור...", true);
      await gsPing();
      gsSetStatus("✅ חיבור תקין", true);
    }catch(e){
      gsSetStatus("❌ " + (e?.message || "שגיאה"), false);
      toast("שגיאת חיבור ל־Sheets", "bad");
    }
  });

  el("gsPull")?.addEventListener("click", async ()=>{
    try{
      appCfg = saveCfg({ webAppUrl: normalizeWebAppUrl(urlInp?.value||""), autoSync: !!auto?.checked });
      updateGsUI();
      gsSetStatus("טוען מהשיט...", true);
      await gsPull();
      gsSetStatus("✅ נטען מהשיט", true);
      toast("נטען בהצלחה מה־Google Sheets", "ok");
    }catch(e){
      gsSetStatus("❌ " + (e?.message || "שגיאה"), false);
      toast("טעינה מהשיט נכשלה", "bad");
    }
  });

  el("gsPush")?.addEventListener("click", async ()=>{
    try{
      appCfg = saveCfg({ webAppUrl: normalizeWebAppUrl(urlInp?.value||""), autoSync: !!auto?.checked });
      updateGsUI();
      gsSetStatus("שומר לשיט...", true);
      await gsPush();
      gsSetStatus("✅ נשמר לשיט", true);
      toast("נשמר בהצלחה ל־Google Sheets", "ok");
    }catch(e){
      gsSetStatus("❌ " + (e?.message || "שגיאה"), false);
      toast("שמירה לשיט נכשלה", "bad");
    }
  });

  if(urlInp){
    urlInp.addEventListener("change", ()=>{
      appCfg = saveCfg({ webAppUrl: normalizeWebAppUrl(urlInp.value) });
      updateGsUI();
    });
  }
  if(auto){
    auto.addEventListener("change", ()=>{
      appCfg = saveCfg({ autoSync: !!auto.checked });
      updateGsUI();
    });
  }
  if(btn){
    btn.addEventListener("click", async ()=>{
      const nextMode = appCfg.mode === "sheets" ? "local" : "sheets";
      appCfg = saveCfg({ mode: nextMode, webAppUrl: normalizeWebAppUrl(urlInp?.value||appCfg.webAppUrl||"") , autoSync: !!auto?.checked });
      updateGsUI();

      if(nextMode === "sheets"){
        // On entering Sheets mode: ping + pull for single source of truth
        try{
          gsSetStatus("בודק חיבור...", true);
          await gsPing();
          gsSetStatus("טוען נתונים...", true);
          await gsPull();
          gsSetStatus("✅ מצב Sheets פעיל", true);
          addEvent("sync", "עברנו למצב Google Sheets (נטען נתונים)");
          saveState();
        }catch(e){
          appCfg = saveCfg({ mode:"local" });
          updateGsUI();
          gsSetStatus("❌ לא הצלחתי להפעיל Sheets (" + (e?.message||"שגיאה") + ")", false);
          toast("חיבור Sheets לא הופעל – חזרתי ל־Local", "warn");
        }
      }else{
        gsSetStatus("Local בלבד", true);
        addEvent("sync", "עברנו למצב Local");
        saveState();
      }
    });
  }

  updateGsUI();
}

function saveState(){
  window.appState = appState;
  localStorage.setItem(LS_KEY, JSON.stringify(appState));
  // Optional: sync to Google Sheets
  try{
    if(appCfg && appCfg.mode==="sheets" && appCfg.webAppUrl && appCfg.autoSync){
      gsPushDebounced(900);
    }
  }catch(e){}
  showLoader(220);
  renderAll();
}

/* ===== Activity Timeline ===== */
function addEvent(type, text, meta={}){
  appState.events.unshift({
    id: uid("ev"),
    at: nowISO(),
    who: appState.user?.name || "משתמש",
    type, text, meta
  });
  appState.events = appState.events.slice(0, 800);
}

/* ===== Lead Score ===== */
function sourceWeight(source){
  const s = (source||"").toLowerCase();
  if(["הפניה","ref","referral"].some(x=>s.includes(x))) return 22;
  if(s.includes("טלפון")) return 18;
  if(s.includes("גוגל")) return 16;
  if(s.includes("אתר")) return 14;
  if(s.includes("פייסבוק")) return 12;
  return 10;
}
function statusWeight(status){
  switch(status){
    case "חדש": return 10;
    case "נוצר קשר": return 18;
    case "מתעניין": return 26;
    case "הצעת מחיר": return 34;
    case "נסגר": return 40;
    case "לא רלוונטי": return 2;
    default: return 10;
  }
}
function computeScore(lead){
  const talks = clamp(Number(lead.contactCount||0), 0, 20);
  const talkScore = talks * 2.2; // max 44

  const base = 18;
  const src = sourceWeight(lead.source);
  const st = statusWeight(lead.status);

  const refDate = lead.lastContactAt || lead.createdAt || nowISO();
  const days = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000*60*60*24));
  const recencyPenalty = clamp(days * 1.6, 0, 40);

  let score = base + src + st + talkScore - recencyPenalty;

  if(lead.status === "נסגר") score += 10;
  if(lead.status === "לא רלוונטי") score = Math.min(score, 15);

  return clamp(Math.round(score), 1, 100);
}
function heatTag(score){
  if(score >= 75) return { cls:"hot", label:"חם" };
  if(score >= 45) return { cls:"ok", label:"בינוני" };
  return { cls:"cold", label:"קר" };
}



/* ===== Views ===== */
const nav = el("nav");
nav.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-view]");
  if(!btn) return;
  setView(btn.dataset.view);
});
function setView(view){
  // "esign" / "proposal" are modal flows (not full pages)
  if(view === "esign")  { openESignModal && openESignModal(); return; }
  if(view === "proposal"){ openProposalModal && openProposalModal(); return; }
  if(!["leads","myflows","tasks","timeline","settings"].includes(view)) view="leads";
  document.querySelectorAll(".nav button[data-view]").forEach(b=>b.classList.toggle("active", b.dataset.view===view));

  el("viewLeads").style.display = (view==="leads") ? "" : "none";
  const __vr = el("viewRight");
  if(__vr) __vr.style.display = (view==="leads") ? "" : "none";
  el("viewMyFlows").style.display = (view==="myflows") ? "" : "none";
  el("viewTasks").style.display = (view==="tasks") ? "" : "none";
  el("viewTimeline").style.display = (view==="timeline") ? "" : "none";
  el("viewSettings").style.display = (view==="settings") ? "" : "none";

  const titles = {
    leads: ["לידים", "ניהול לידים, סטטוסים, פעולות ומעקב"],
    myflows: ["הלקוחות שלי", "ניהול וצפייה בלקוחות, פעולות ומעקב"],
    tasks: ["משימות", "תזכורות עם תאריך/שעה + עדיפות + שיוך לליד"],
    timeline: ["יצירת הצעה", "Timeline של כל פעולה ושינוי במערכת"],
    settings: ["הגדרות", "גיבוי/איפוס וחיבור ל-Google Sheets"]
  };
  el("viewTitle").textContent = titles[view][0];
  el("viewSub").textContent = titles[view][1];

  // active view highlight (cards currently visible)
  ["viewLeads","viewRight","viewMyFlows","viewTasks","viewTimeline","viewSettings"].forEach(id=>{
    const node = el(id);
    if(!node) return;
    node.classList.remove("activeView");
  });
  if(view==="leads"){ el("viewLeads")?.classList.add("activeView"); el("viewRight")?.classList.add("activeView"); }
  if(view==="myflows") el("viewMyFlows")?.classList.add("activeView");
  if(view==="tasks") el("viewTasks")?.classList.add("activeView");
  if(view==="timeline") el("viewTimeline")?.classList.add("activeView");
  if(view==="settings") el("viewSettings")?.classList.add("activeView");



  showLoader(260);
  // add subtle entrance animation to visible panels
  ["viewLeads","viewRight","viewMyFlows","viewTasks","viewTimeline","viewSettings"].forEach(id=>{
    const node = el(id);
    if(!node) return;
    node.classList.remove("viewPanel");
    if(node.style.display !== "none"){
      // trigger reflow then add
      void node.offsetWidth;
      node.classList.add("viewPanel");
    }
  });

  renderAll();
}

/* ===== Modal ===== */
// === Modal navigation stack (Back/Forward) ===
const __modalNav = { stack: [], idx: -1, ignorePush: false };
function __updateModalNavBtns(){
  const b = el("modalNavBack"), f = el("modalNavFwd");
  if(!b || !f) return;
  b.disabled = (__modalNav.idx <= 0);
  f.disabled = (__modalNav.idx >= __modalNav.stack.length - 1);
}
function __pushModalState(title, html){
  // If user went "back" and then opened a new modal step, drop forward history
  __modalNav.stack = __modalNav.stack.slice(0, __modalNav.idx + 1);
  __modalNav.stack.push({title, html});
  __modalNav.idx = __modalNav.stack.length - 1;
}
function __renderModalState(state){
  el("modalTitle").textContent = state.title;
  el("modalBody").innerHTML = state.html;
  const back = el("modalBack");
  back.classList.remove("closing");
  back.style.display = "flex";
  requestAnimationFrame(()=> back.classList.add("show"));
  __updateModalNavBtns();
}
function openModal(title, html){
  if(!__modalNav.ignorePush){
    __pushModalState(title, html);
  }
  __renderModalState({title, html});
}
function closeModal(){
  const back = el("modalBack");
  // Smooth close
  back.classList.add("closing");
  back.classList.remove("show");
  setTimeout(()=>{
    __modalNav.stack = []; __modalNav.idx = -1; __updateModalNavBtns();
    back.style.display = "none";
    back.classList.remove("closing");
    el("modalBody").innerHTML = "";
  }, 180);
}
el("modalClose").addEventListener("click", closeModal);
el("modalNavBack")?.addEventListener("click", ()=>{
  if(__modalNav.idx > 0){
    __modalNav.ignorePush = true;
    __modalNav.idx -= 1;
    __renderModalState(__modalNav.stack[__modalNav.idx]);
    __modalNav.ignorePush = false;
  }
});
el("modalNavFwd")?.addEventListener("click", ()=>{
  if(__modalNav.idx < __modalNav.stack.length - 1){
    __modalNav.ignorePush = true;
    __modalNav.idx += 1;
    __renderModalState(__modalNav.stack[__modalNav.idx]);
    __modalNav.ignorePush = false;
  }
});
el("modalBack").addEventListener("click", (e)=>{
  if(e.target === el("modalBack")) closeModal();
});


/* ===== Toast ===== */
let toastTimer=null;
function toast(msg, type){
  const t = el("toast");
  if(!t) return;
  const m = String(msg ?? "");
  const guess = (()=>{
    if(type) return type;
    const s = m.toLowerCase();
    if(s.includes("שגיאה") || s.includes("לא ניתן") || s.includes("לא תקין") || s.includes("נכשל")) return "error";
    if(s.includes("אזהרה") || s.includes("שים לב") || s.includes("⚠")) return "warn";
    return "success";
  })();
  t.classList.remove("success","warn","error","show");
  t.classList.add(guess);
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove("show"), 2600);
}


/* ===== Filters/Search/Sort ===== */
el("fStatus").addEventListener("change", renderLeads);
el("fSource").addEventListener("change", renderLeads);
el("sortBy").addEventListener("change", renderLeads);

/* ===== Buttons ===== */
const _btnQuickTask = el("btnQuickTask"); if(_btnQuickTask) _btnQuickTask.addEventListener("click", ()=> openTaskForm());
el("btnOpenInsights")?.addEventListener("click", ()=> openInsights());
el("btnSeed")?.addEventListener("click", seedSample);
const _btnExport = el("btnExport"); if(_btnExport) _btnExport.addEventListener("click", exportJSON);
const _btnImport = el("btnImport"); if(_btnImport) _btnImport.addEventListener("click", importJSON);
el("btnBackup").addEventListener("click", exportJSON);
el("btnReset").addEventListener("click", ()=>{
  if(confirm("לאפס את כל הנתונים? פעולה בלתי הפיכה.")){
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
});

/* ===== Shortcuts ===== */
document.addEventListener("keydown", (e)=>{
  if(e.key==="Escape") closeModal();
  if(e.key==="/" && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName||"")){
    e.preventDefault();
    const q2 = el("q"); if(q2) q2.focus();
  }
const modalOpen = (el("modalBack").style.display === "flex");
});

function exportJSON(){
  const blob = new Blob([JSON.stringify(appState, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leadup-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("גיבוי ירד למחשב ✅");
}
function importJSON(){
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";
  inp.onchange = () => {
    const f = inp.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        if(!parsed || typeof parsed !== "object") throw new Error("bad");
        appState.user = parsed.user || appState.user;
        appState.leads = Array.isArray(parsed.leads) ? parsed.leads : appState.leads;
        appState.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : appState.tasks;
        appState.events = Array.isArray(parsed.events) ? parsed.events : appState.events;
        addEvent("import", "ייבוא נתונים בוצע");
        try{
      saveState();
    }catch(err){
      console.error("saveState failed", err);
    }
    toast("ליד נשמר בהצלחה ✅", "success");
    // close even if render has minor errors
    setTimeout(()=>{ try{ closeModal(); }catch(e){} }, 520);
toast("ייבוא הצליח ✅");
      }catch(e){
        alert("קובץ לא תקין");
      }
    };
    reader.readAsText(f);
  };
  inp.click();
}

/* =======================
   Leads CRUD
   ======================= */
function openLeadForm(leadId=null){
  const lead = leadId ? appState.leads.find(l=>l.id===leadId) : null;
  const isEdit = !!lead;

  const data = lead || {
    id: uid("lead"),
    name:"",
    phone:"",
    email:"",
    status:"חדש",
    source:"אחר",
    owner:"",
    note:"",
    createdAt: nowISO(),
    lastContactAt:"",
    nextFollowUpAt:"",
    contactCount: 0
  };

  openModal(isEdit ? "עריכת ליד" : "הקמת ליד חדש", `
    <div class="split">
      <div>
        <form id="leadForm">
          <div class="row">
            <div>
              <label>שם מלא</label>
              <input name="name" value="${escapeHTML(data.name)}" placeholder="" required/>
            </div>
            <div>
              <label>טלפון</label>
              <input name="phone" value="${escapeHTML(data.phone)}" placeholder="" inputmode="tel"/>
            
                          </div>
            <div>
              <label>ת.ז</label>
              <input name="tz" value="${escapeHTML(data.tz||data.idNumber||"")}" placeholder="ת.ז" inputmode="numeric"/>
            </div>
</div>
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>אימייל</label>
              <input name="email" value="${escapeHTML(data.email)}" placeholder="name@email.com" inputmode="email"/>
            </div>
            <div>
              <label>שם סוקר/ת</label>
              <input name="owner" value="${escapeHTML(data.owner||"")}" placeholder="שם סוקר/ת"/>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>סטטוס</label>
              <select name="status">
                ${["חדש","נוצר קשר","מתעניין","הצעת מחיר","נסגר","לא רלוונטי"].map(s=>`
                  <option ${s===data.status?"selected":""}>${s}</option>
                `).join("")}
              </select>
            </div>
            <div>
              <label>מקור</label>
              <select name="source">
                ${["פייסבוק","גוגל","הפניה","טלפון","אתר","אחר"].map(s=>`
                  <option ${s===data.source?"selected":""}>${s}</option>
                `).join("")}
              </select>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>תאריך שיחה (תאריך/שעה)</label> <span style="color:#c9a23f;font-weight:600">(חובה)</span>
              <input name="nextFollowUpAt" value="${escapeHTML(toLocalDT(data.nextFollowUpAt))}" type="datetime-local"/>
            </div>
            <div>
              <label>עדכון "דיברנו" (מעלה score)</label>
              <button type="button" class="btn" id="btnTouch" style="width:100%">☎️ סימון שיחה/מענה</button>
              <div class="help">מעלה Contact Count + מעדכן Last Contact.</div>
            </div>
          </div>

          <div style="margin-top:10px">
            <label>סיכום שיחה</label>
            <textarea name="note" placeholder="רשום פרטים חשובים…">${escapeHTML(data.note||"")}</textarea>
          </div>

          <div class="sep"></div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-start">
            <button class="btn gold" type="submit">💾 שמירה</button>
            <button class="btn" type="button" id="btnCreateTask">⏰ צור משימה לליד</button>
            ${isEdit ? `<button class="btn danger" type="button" id="btnDeleteLead">🗑️ מחיקה</button>` : ""}
            <button class="btn" type="button" id="btnOpenContact">📲 פעולות קשר</button>
          </div>

          <div class="help">
            Lead Score מתחשב בסטטוס, מקור, כמות שיחות וזמן שעבר.
          </div>
        </form>
      </div>

      <div>
        <div class="miniCard">
          <h3>תצוגה מהירה</h3>
          <div class="small muted">נוצר: ${fmtDT(data.createdAt)}</div>
          <div class="small muted">שיחה אחרונה: ${data.lastContactAt ? fmtDT(data.lastContactAt) : "—"}</div>
          <div class="small muted">שיחות/מענים: ${Number(data.contactCount||0)}</div>
          <div class="sep"></div>
          <div class="score">
            <div class="tag ${heatTag(computeScore(data)).cls}">🔥 ${heatTag(computeScore(data)).label}</div>
            <div style="font-weight:800">${computeScore(data)}/100</div>
          </div>
          <div class="bar" style="margin-top:10px"><i style="width:${computeScore(data)}%"></i></div>
          <div class="help">ככל שהציון גבוה יותר—הליד “חם” יותר.</div>
        </div>

        <div class="miniCard" style="margin-top:10px">
          <h3>פעולות מהירות</h3>
          <div class="actions">
            <button type="button" class="iconBtn gold" title="וואטסאפ" id="qaWA">💬</button>
            <button type="button" class="iconBtn" title="התקשר" id="qaCall">📞</button>
            <button type="button" class="iconBtn" title="אימייל" id="qaMail">✉️</button>
            <button type="button" class="iconBtn" title="העתק טלפון" id="qaCopy">📋</button>
          </div>
          <div class="help">כאן הכל בתוך מודאל (לא נפתח חלון חדש).</div>
        </div>
      </div>
    </div>
  `);

  const form = document.getElementById("leadForm");
  // Safety: some browsers block submit silently when validation fails.
  // Ensure clicking the save button always triggers validation feedback.
  const _saveBtn = form.querySelector('button[type="submit"]');
  if(_saveBtn){
    _saveBtn.addEventListener("click", ()=>{
      try{ form.reportValidity(); }catch(e){}
    });
  }
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    try{
      // If required fields are missing, show native validation and stop.
      try{
        if(typeof form.reportValidity === "function" && !form.reportValidity()){
          toast("חסרים שדות חובה", "warn");
          return;
        }
      }catch(e){}

      const submitBtn = form.querySelector('button[type="submit"]');
      if(submitBtn){ submitBtn.disabled = true; submitBtn.classList.add("loading"); }

      const fd = new FormData(form);
      const updated = { ...data };
      for(const [k,v] of fd.entries()){
        updated[k] = v;
      }
      updated.nextFollowUpAt = fromLocalDT(updated.nextFollowUpAt);
      updated.createdAt = data.createdAt || nowISO();

      const idx = appState.leads.findIndex(l=>l.id===updated.id);
      if(idx>=0){
        appState.leads[idx] = updated;
        addEvent("lead_update", `עודכן ליד: ${updated.name}`, {leadId: updated.id});
        toast("ליד עודכן ✅");
      }else{
        appState.leads.unshift(updated);
        addEvent("lead_create", `נוצר הקמת ליד חדש: ${updated.name}`, {leadId: updated.id});
        toast("ליד נוסף ✅");
      }

      // Persist + render (also pushes to Sheets if enabled)
      saveState();

      // Background push when in Sheets mode (non-blocking)
      if(appCfg && appCfg.mode==="sheets" && appCfg.webAppUrl){
        gsSetStatus("מסנכרן לשיט…", true);
        gsPush().then(()=>{
          gsSetStatus("נשמר לשיט ✅", true);
        }).catch((pushErr)=>{
          console.error("gsPush failed", pushErr);
          gsSetStatus("שמירה לשיט נכשלה (בדוק הרשאות/URL)", false);
          toast("נשמר מקומית, אבל שמירה לשיט נכשלה ⚠️", "warn");
        });
      }

      toast("ליד נשמר בהצלחה ✅", "success");
      setTimeout(()=>{
        try{ closeModal(); }catch(e){}
        // Hard fallback (in case another script reopened/blocked)
        const mb = document.getElementById("modalBack");
        if(mb){ mb.classList.remove("show","closing"); mb.style.display="none"; }
        const body = document.getElementById("modalBody");
        if(body) body.innerHTML="";
      }, 350);
    }catch(err){
      console.error("Lead save failed", err);
      toast("שמירה נכשלה: " + (err && err.message ? err.message : err), "danger");
    }finally{
      const submitBtn = form.querySelector('button[type="submit"]');
      if(submitBtn){ submitBtn.disabled = false; submitBtn.classList.remove("loading"); }
    }
  });

  document.getElementById("btnTouch").addEventListener("click", ()=>{
    data.contactCount = Number(data.contactCount||0) + 1;
    data.lastContactAt = nowISO();
    addEvent("contact", `שיחה/מענה סומן לליד: ${data.name||"(ללא שם)"}`, {leadId:data.id});
    toast("סומן שיחה ✅");
    const idx = appState.leads.findIndex(l=>l.id===data.id);
    if(idx>=0) appState.leads[idx] = data;
    else appState.leads.unshift(data);
    saveState();
    openLeadForm(data.id);
  });

  if(isEdit){
    document.getElementById("btnDeleteLead").addEventListener("click", ()=>{
      if(!confirm("למחוק את הליד?")) return;
      appState.leads = appState.leads.filter(l=>l.id!==leadId);
      appState.tasks = appState.tasks.filter(t=>t.leadId!==leadId);
      addEvent("lead_delete", `נמחק ליד: ${lead.name}`, {leadId});
      saveState();
      closeModal();
      toast("ליד נמחק 🗑️");
    });
  }

  document.getElementById("btnCreateTask").addEventListener("click", ()=>{
    // In-app navigation: allow back to Lead screen
    if(typeof window.__leadNavPush === "function"){
      window.__leadNavPush(()=>openLeadForm(data.id));
    }
    openTaskForm({ leadId: data.id, leadName: data.name, presetDate: data.nextFollowUpAt });
  });

document.getElementById("btnOpenContact").addEventListener("click", ()=>{
    openContactPanel(data);
  });

  document.getElementById("qaWA").addEventListener("click", ()=> openContactPanel(data, "wa"));
  document.getElementById("qaCall").addEventListener("click", ()=> openContactPanel(data, "call"));
  document.getElementById("qaMail").addEventListener("click", ()=> openContactPanel(data, "mail"));
  document.getElementById("qaCopy").addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(data.phone||"");
      toast("הטלפון הועתק 📋");
    }catch{
      toast("לא ניתן להעתיק בדפדפן הזה");
    }
  });
}

/* ===== Contact panel (in-modal) ===== */
function normalizeILPhone(phone){
  const digits = String(phone||"").replace(/[^\d]/g,"");
  if(!digits) return "";
  // if starts with 0 -> IL
  if(digits.startsWith("0")) return "972" + digits.slice(1);
  // already includes country?
  if(digits.startsWith("972")) return digits;
  // fallback
  return digits;
}

function openContactPanel(lead, focus="wa"){
  const phoneIL = normalizeILPhone(lead.phone);
  const mail = (lead.email||"").trim();
  const waWeb = phoneIL ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(phoneIL)}` : "";
  const tel = (lead.phone||"").trim();
  const mailto = mail ? `mailto:${encodeURIComponent(mail)}?subject=${encodeURIComponent("LEADUP - פניה")}` : "";

  openModal(`פעולות קשר • ${lead.name || "ליד"}`, `
    <div class="twoCols">
      <div class="miniCard">
        <h3>פרטי קשר</h3>
        <div class="small muted">טלפון: <b>${escapeHTML(lead.phone||"—")}</b></div>
        <div class="small muted" style="margin-top:6px">אימייל: <b>${escapeHTML(mail||"—")}</b></div>
        <div class="sep"></div>

        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <button class="btn gold" type="button" id="cWA" ${waWeb? "":"disabled"}>💬 וואטסאפ</button>
          <button class="btn" type="button" id="cCall" ${tel? "":"disabled"}>📞 התקשר</button>
          <button class="btn" type="button" id="cMail" ${mailto? "":"disabled"}>✉️ מייל</button>
          <button class="btn" type="button" id="cCopyPhone" ${tel? "":"disabled"}>📋 העתק טלפון</button>
          <button class="btn" type="button" id="cCopyMail" ${mail? "":"disabled"}>📋 העתק מייל</button>
        </div>

        <div class="help">
          הערה: “התקשר” / “מייל” לא נפתחים בתוך iframe בגלל מגבלות דפדפן,
          אבל נשארים בתוך המודאל עם כפתורי העתקה + קישור.
        </div>

        <div class="sep"></div>
        <div class="miniCard" style="margin:0; background:rgba(255,255,255,.02)">
          <h3 style="margin-bottom:8px">הודעה מהירה לוואטסאפ</h3>
          <label>טקסט</label>
          <textarea id="waText" placeholder="היי ${escapeHTML(lead.name||"")}, מדבר/ת מ-...">${escapeHTML(`היי ${lead.name||""}, מדבר/ת מ-LEADUP. אפשר לעזור?`)}</textarea>
          <button class="btn gold" type="button" id="waOpenMsg" style="margin-top:10px" ${waWeb? "":"disabled"}>🚀 פתח וואטסאפ עם ההודעה</button>
        </div>
      </div>

      <div class="miniCard">
        <h3>תצוגה בתוך המערכת</h3>
        ${waWeb ? `
          <div class="frame">
            <iframe id="waFrame" src="${escapeHTML(waWeb)}"></iframe>
          </div>
          <div class="help">אם לא התחברת ל-WhatsApp Web במחשב, תצטרך להתחבר פעם אחת.</div>
        ` : `
          <div class="help">אין טלפון לליד — הוסף מספר ואז תוכל לפתוח WhatsApp Web כאן.</div>
        `}
      </div>
    </div>
  `);

  // wire buttons
  const cWA = document.getElementById("cWA");
  const cCall = document.getElementById("cCall");
  const cMail = document.getElementById("cMail");
  const cCopyPhone = document.getElementById("cCopyPhone");
  const cCopyMail = document.getElementById("cCopyMail");

  if(cWA) cWA.addEventListener("click", ()=>{
    if(!waWeb) return;
    const frame = document.getElementById("waFrame");
    if(frame) frame.src = waWeb;
    addEvent("contact_open", `נפתח וואטסאפ לליד: ${lead.name||"—"}`, {leadId: lead.id});
    saveState();
  });

  if(cCall) cCall.addEventListener("click", async ()=>{
    // keep inside modal: show link and copy
    addEvent("call_hint", `ניסיון התקשרות (קישור Tel) לליד: ${lead.name||"—"}`, {leadId: lead.id});
    saveState();
    toast("העתקנו לך/צירפנו קישור להתקשרות בתוך המודאל");
    openModal(`התקשר • ${lead.name||"ליד"}`, `
      <div class="miniCard">
        <h3>התקשרות</h3>
        <div class="small muted">מספר: <b>${escapeHTML(tel||"—")}</b></div>
        <div class="sep"></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <button class="btn gold" type="button" id="ccCopy">📋 העתק מספר</button>
          <a class="btn" href="${escapeHTML(tel ? "tel:"+tel.replace(/[^\d+]/g,"") : "#")}" style="text-decoration:none; ${tel? "":"pointer-events:none;opacity:.6"}">📞 חייג (אם הדפדפן מאפשר)</a>
        </div>
        <div class="help">במחשב לפעמים Tel לא עובד — אז הכי טוב להעתיק ולהתקשר מהנייד.</div>
      </div>
    `);
    document.getElementById("ccCopy")?.addEventListener("click", async ()=>{
      try{ await navigator.clipboard.writeText(tel||""); toast("המספר הועתק 📋"); }catch{}
    });
  });

  if(cMail) cMail.addEventListener("click", ()=>{
    addEvent("mail_hint", `נפתח מייל (mailto) לליד: ${lead.name||"—"}`, {leadId: lead.id});
    saveState();
    openModal(`מייל • ${lead.name||"ליד"}`, `
      <div class="miniCard">
        <h3>שליחת מייל</h3>
        <div class="small muted">כתובת: <b>${escapeHTML(mail||"—")}</b></div>
        <div class="sep"></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <button class="btn gold" type="button" id="cmCopy">📋 העתק מייל</button>
          <a class="btn" href="${escapeHTML(mailto)}" style="text-decoration:none; ${mailto? "":"pointer-events:none;opacity:.6"}">✉️ פתח תוכנת מייל</a>
        </div>
        <div class="help">mailto תלוי בהגדרות המחשב שלך (Gmail/Outlook וכו'). אם לא נפתח—פשוט העתק.</div>
      </div>
    `);
    document.getElementById("cmCopy")?.addEventListener("click", async ()=>{
      try{ await navigator.clipboard.writeText(mail||""); toast("המייל הועתק 📋"); }catch{}
    });
  });

  if(cCopyPhone) cCopyPhone.addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(tel||""); toast("הטלפון הועתק 📋"); }catch{ toast("לא ניתן להעתיק");}
  });
  if(cCopyMail) cCopyMail.addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(mail||""); toast("המייל הועתק 📋"); }catch{ toast("לא ניתן להעתיק");}
  });

  document.getElementById("waOpenMsg")?.addEventListener("click", ()=>{
    if(!phoneIL) return;
    const txt = document.getElementById("waText")?.value || "";
    // WhatsApp web message param
    const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phoneIL)}&text=${encodeURIComponent(txt)}`;
    const frame = document.getElementById("waFrame");
    if(frame) frame.src = url;
    addEvent("wa_msg", `נפתח וואטסאפ עם הודעה לליד: ${lead.name||"—"}`, {leadId: lead.id});
    saveState();
  });

  // focus
  if(focus==="wa") cWA?.click();
}

/* =======================
   Tasks CRUD
   ======================= */
function openTaskForm(opts={}){
  // opts: { taskId, leadId, leadName, presetDate }
  const task = opts.taskId ? appState.tasks.find(t=>t.id===opts.taskId) : null;
  const isEdit = !!task;

  const leadId = opts.leadId || task?.leadId || "";
  const lead = leadId ? appState.leads.find(l=>l.id===leadId) : null;

  const data = task || {
    id: uid("task"),
    leadId: leadId || "",
    title: "",
    dueAt: opts.presetDate || "",
    priority: "בינונית",
    status: "פתוחה",
    createdAt: nowISO()
  };

  openModal(isEdit ? "עריכת משימה" : "משימה חדשה", `
    <form id="taskForm">
      <div class="row">
        <div>
          <label>שייך לליד</label>
          <select name="leadId">
            <option value="">ללא שיוך</option>
            ${appState.leads.map(l=>`
              <option value="${escapeHTML(l.id)}" ${l.id===data.leadId?"selected":""}>${escapeHTML(l.name || "(ללא שם)")}</option>
            `).join("")}
          </select>
          <div class="help">${lead ? `נבחר: <b>${escapeHTML(lead.name)}</b>` : "אפשר לבחור ליד או להשאיר ללא שיוך."}</div>
        </div>
        <div>
          <label>מתי (תאריך/שעה)</label>
          <input name="dueAt" type="datetime-local" value="${escapeHTML(toLocalDT(data.dueAt))}"/>
          <div class="help">אפשר גם “לחזור אליו עוד X ימים” למטה.</div>
        </div>
      </div>

      <div class="row" style="margin-top:10px">
        <div>
          <label>עדיפות</label>
          <select name="priority">
            ${["גבוהה","בינונית","נמוכה"].map(p=>`
              <option ${p===data.priority?"selected":""}>${p}</option>
            `).join("")}
          </select>
        </div>
        <div>
          <label>סטטוס</label>
          <select name="status">
            ${["פתוחה","בוצעה"].map(s=>`
              <option ${s===data.status?"selected":""}>${s}</option>
            `).join("")}
          </select>
        </div>
      </div>

      <div style="margin-top:10px">
        <label>תיאור</label>
        <textarea name="title" placeholder="לדוגמה: לחזור לליד ולתת הצעת מחיר…">${escapeHTML(data.title||"")}</textarea>
      </div>

      <div class="sep"></div>

      <div class="row">
        <div>
          <label>לחזור אליו עוד X ימים</label>
          <div style="display:flex; gap:10px">
            <input id="xDays" type="number" min="0" placeholder="לדוגמה: 3"/>
            <button type="button" class="btn" id="btnApplyX">📅 קבע תאריך</button>
          </div>
          <div class="help">יקבע Due לפי עכשיו + X ימים.</div>
        </div>
        <div>
          <label>פעולות</label>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn gold" type="submit">💾 שמירה</button>
            ${isEdit ? `<button class="btn danger" type="button" id="btnDeleteTask">🗑️ מחיקה</button>` : ""}
          </div>
        </div>
      </div>
    </form>
  `);

  document.getElementById("btnApplyX")?.addEventListener("click", ()=>{
    const x = Number(document.getElementById("xDays")?.value || 0);
    const d = new Date();
    d.setDate(d.getDate() + (Number.isFinite(x)? x : 0));
    const local = toLocalDT(d.toISOString());
    const due = document.querySelector('#taskForm input[name="dueAt"]');
    if(due) due.value = local;
    toast("נקבע תאריך ✅");
  });

  const form = document.getElementById("taskForm");
  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const updated = { ...data };
    for(const [k,v] of fd.entries()){
      updated[k] = v;
    }
    updated.dueAt = fromLocalDT(updated.dueAt);

    const idx = appState.tasks.findIndex(t=>t.id===updated.id);
    const leadName = updated.leadId ? (appState.leads.find(l=>l.id===updated.leadId)?.name || "ליד") : "ללא שיוך";
    if(idx>=0){
      appState.tasks[idx] = updated;
      addEvent("task_update", `עודכנה משימה (${updated.priority}) • ${leadName}`, {taskId: updated.id, leadId: updated.leadId||""});
      toast("משימה עודכנה ✅");
    }else{
      appState.tasks.unshift(updated);
      addEvent("task_create", `נוצרה משימה (${updated.priority}) • ${leadName}`, {taskId: updated.id, leadId: updated.leadId||""});
      toast("משימה נוספה ✅");
    }
    saveState();
    closeModal();
  });

  if(isEdit){
    document.getElementById("btnDeleteTask")?.addEventListener("click", ()=>{
      if(!confirm("למחוק את המשימה?")) return;
      appState.tasks = appState.tasks.filter(t=>t.id!==data.id);
      addEvent("task_delete", `נמחקה משימה`, {taskId: data.id, leadId: data.leadId||""});
      saveState();
      closeModal();
      toast("משימה נמחקה 🗑️");
    });
  }
}

function toggleTaskDone(taskId){
  const t = appState.tasks.find(x=>x.id===taskId);
  if(!t) return;
  t.status = (t.status==="בוצעה") ? "פתוחה" : "בוצעה";
  addEvent("task_toggle", `סטטוס משימה: ${t.status}`, {taskId: t.id, leadId: t.leadId||""});
  saveState();
}

/* =======================
   Rendering
   ======================= */

/* ===== Animated Counters (Dashboard) ===== */
function animateNumber(elm, to){
  if(!elm) return;
  const from = Number(String(elm.textContent||"0").replace(/[^\d.-]/g,"")) || 0;
  const target = Number(to) || 0;
  if(from === target){ elm.textContent = String(target); return; }
  const start = performance.now();
  const dur = 520;
  const step = (t)=>{
    const p = Math.min(1, (t-start)/dur);
    const eased = 1 - Math.pow(1-p, 3);
    const val = Math.round(from + (target-from)*eased);
    elm.textContent = String(val);
    if(p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderAll(){
  renderStats();
  renderLeads();
  renderTasks();
  renderTimeline();
  renderNavCounts();
}

function renderNavCounts(){
  el("navCount").textContent = String(appState.leads.length);
  const openTasks = appState.tasks.filter(t=>t.status!=="בוצעה").length;
  el("navTasks").textContent = String(openTasks);
  el("navEvents").textContent = String(appState.events.length);
}

function renderStats(){
  const total = appState.leads.length;
  const scores = appState.leads.map(l=>computeScore(l));
  const hot = scores.filter(s=>s>=75).length;

  const today = todayKey();
  const todayFollow = appState.leads.filter(l=>{
    if(!l.nextFollowUpAt) return false;
    const d = new Date(l.nextFollowUpAt);
    if(Number.isNaN(d.getTime())) return false;
    const k = d.toLocaleDateString("sv-SE");
    return k === today;
  }).length;

  const openTasks = appState.tasks.filter(t=>t.status!=="בוצעה").length;

  animateNumber(el("stTotal"), total);
  animateNumber(el("stHot"), hot);
  animateNumber(el("stToday"), todayFollow);
  animateNumber(el("stTasks"), openTasks);
}

function getFilteredSortedLeads(){
  const q = (el("q").value||"").trim().toLowerCase();
  const fStatus = el("fStatus").value;
  const fSource = el("fSource").value;
  const sortBy = el("sortBy").value;

  let arr = [...appState.leads];

  if(q){
    arr = arr.filter(l=>{
      const hay = [
        l.name, l.phone, l.email, l.status, l.source, l.owner, l.note
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  if(fStatus) arr = arr.filter(l=> (l.status||"")===fStatus);
  if(fSource) arr = arr.filter(l=> (l.source||"")===fSource);

  const scoreOf = (l)=>computeScore(l);
  const nextTime = (l)=> l.nextFollowUpAt ? new Date(l.nextFollowUpAt).getTime() : Infinity;
  const createdTime = (l)=> l.createdAt ? new Date(l.createdAt).getTime() : 0;

  if(sortBy==="hot"){
    arr.sort((a,b)=> scoreOf(b)-scoreOf(a));
  }else if(sortBy==="next"){
    arr.sort((a,b)=> nextTime(a)-nextTime(b));
  }else if(sortBy==="newest"){
    arr.sort((a,b)=> createdTime(b)-createdTime(a));
  }else if(sortBy==="oldest"){
    arr.sort((a,b)=> createdTime(a)-createdTime(b));
  }
  return arr;
}

function renderLeads(){
  const tbody = el("leadsTbody");
  const leads = getFilteredSortedLeads();

  el("emptyLeads").style.display = (appState.leads.length===0) ? "" : "none";

  tbody.innerHTML = leads.map(l=>{
    const score = computeScore(l);
    const ht = heatTag(score);
    return `
      <tr>
        <td><b>${escapeHTML(l.name||"—")}</b><div class="small muted">${escapeHTML(l.owner||"")}</div></td>
        <td>${escapeHTML(l.phone||"—")}</td>
        <td><span class="tag">${escapeHTML(l.status||"—")}</span></td>
        <td><span class="tag">${escapeHTML(l.source||"—")}</span></td>
        <td>
          <div class="score">
            <span class="tag ${ht.cls}">${ht.label}</span>
            <b>${score}</b>
          </div>
          <div class="bar" style="margin-top:8px"><i style="width:${score}%"></i></div>
        </td>
        <td>${l.nextFollowUpAt ? fmtDT(l.nextFollowUpAt) : "—"}</td>
        <td>
          <div class="actions">
            <button class="btn goldSoft openClientBtn" title="פתח תיק לקוח" data-tip="פתח תיק לקוח" data-act="open" data-id="${escapeHTML(l.id)}">📂 פתח תיק לקוח</button>
            <button class="iconBtn gold" title="ערוך" data-tip="ערוך" data-act="edit" data-id="${escapeHTML(l.id)}">✎</button>
            <button class="iconBtn" title="משימה" data-tip="צור משימה" data-act="task" data-id="${escapeHTML(l.id)}">⏰</button>
            <button class="iconBtn" title="קשר" data-tip="פעולות קשר" data-act="contact" data-id="${escapeHTML(l.id)}">📲</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      if(act==="open") openClientDossier(id);
      if(act==="edit") openLeadForm(id);
      if(act==="task"){
        const lead = appState.leads.find(l=>l.id===id);
        openTaskForm({ leadId:id, leadName: lead?.name || "" , presetDate: lead?.nextFollowUpAt || ""});
      }
      if(act==="contact"){
        const lead = appState.leads.find(l=>l.id===id);
        if(lead) openContactPanel(lead);
      }
    });
  });
}


/* =======================
   Client Dossier (תיק לקוח)
   ======================= */
let __dossierLeadId = null;

function _cdFmtMoney(v){
  const n = Number(v);
  if(!isFinite(n)) return "—";
  try{
    return new Intl.NumberFormat('he-IL', { style:'currency', currency:'ILS', maximumFractionDigits:0 }).format(n);
  }catch(e){
    return "₪" + Math.round(n).toString();
  }
}
function _cdDigits(s){ return String(s||'').replace(/\D/g,''); }
function _cdNowISO(){ return new Date().toISOString(); }

function _cdGetLead(){
  if(!__dossierLeadId) return null;
  return appState.leads.find(l=> (l.id===__dossierLeadId) || (l._id===__dossierLeadId)) || null;
}

function _cdEnsureLeadCollections(lead){
  if(!lead) return;
  if(!Array.isArray(lead.policies)) lead.policies = [];
  if(!Array.isArray(lead.docs)) lead.docs = [];
}

function _cdComputePremiumTotal(lead){
  _cdEnsureLeadCollections(lead);
  const sum = (lead.policies||[]).reduce((acc,p)=>{
    const v = Number(p?.premium);
    return acc + (isFinite(v) ? v : 0);
  }, 0);
  return sum;
}

function _cdRenderOverview(lead){
  const name = lead?.name || "—";
  const phone = lead?.phone || "—";
  const email = lead?.email || "—";
  const rep = lead?.rep || lead?.agent || lead?.owner || "—";

  const total = _cdComputePremiumTotal(lead);
  const count = (lead?.policies||[]).length;

  el("clientDossierTitle").textContent = "תיק לקוח";
  el("clientDossierSub").textContent = name ? ("לקוח: " + name) : "—";

  el("cd_name").textContent = name;
  el("cd_phone").textContent = phone;
  el("cd_email").textContent = email;
  el("cd_rep").textContent = rep || "—";
  el("cd_premiumTotal").textContent = count ? _cdFmtMoney(total) : "—";
  el("cd_policiesCount").textContent = String(count);

  // quick actions
  const waBtn = el("cd_quickWA");
  const callBtn = el("cd_quickCall");
  const mailBtn = el("cd_quickMail");

  const phoneDigits = _cdDigits(phone);
  const hasPhone = !!phoneDigits;
  const hasMail = !!String(lead?.email||"").trim();

  if(waBtn){
    waBtn.disabled = !hasPhone;
    waBtn.onclick = ()=>{
      if(!hasPhone) return;
      const norm = normalizeILPhone ? normalizeILPhone(phone) : ("972" + phoneDigits.replace(/^0/,''));
      const url = `https://wa.me/${encodeURIComponent(norm)}?text=${encodeURIComponent(`היי ${lead?.name||""}, מדבר/ת מ-LEADUP.`)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      addEvent("wa_open", `נפתח וואטסאפ מתיק לקוח: ${lead?.name||"—"}`, {leadId: lead.id});
      saveState();
    };
  }
  if(callBtn){
    callBtn.disabled = !hasPhone;
    callBtn.onclick = ()=>{
      if(!hasPhone) return;
      window.open(`tel:${encodeURIComponent(phoneDigits)}`, "_self");
      addEvent("call_open", `בוצעה יוזמת שיחה מתיק לקוח: ${lead?.name||"—"}`, {leadId: lead.id});
      saveState();
    };
  }
  if(mailBtn){
    mailBtn.disabled = !hasMail;
    mailBtn.onclick = ()=>{
      if(!hasMail) return;
      const subject = `LEADUP • ${lead?.name||"לקוח"}`;
      const body = `היי ${lead?.name||""},\n\n`;
      const mailto = `mailto:${encodeURIComponent(String(lead.email||"").trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailto, "_blank", "noopener,noreferrer");
      addEvent("mail_open", `נפתח מייל מתיק לקוח: ${lead?.name||"—"}`, {leadId: lead.id});
      saveState();
    };
  }

  // edit rep
  el("cd_editRep")?.addEventListener("click", ()=>{
    const lead = _cdGetLead();
    if(!lead) return;
    const curr = lead.rep || lead.agent || lead.owner || "";
    const val = prompt("שם הנציג המטפל:", curr);
    if(val===null) return;
    lead.rep = String(val||"").trim();
    addEvent("lead_rep", `עודכן נציג מטפל: ${lead.name||"—"} → ${lead.rep||"—"}`, {leadId: lead.id});
    saveState();
    // soft refresh
    _cdRenderOverview(lead);
  }, { once:true });
}

function _cdRenderPolicies(lead){
  _cdEnsureLeadCollections(lead);
  const list = el("cd_policiesList");
  const empty = el("cd_policiesEmpty");
  if(!list || !empty) return;

  const policies = lead.policies || [];
  list.innerHTML = policies.map(p=>{
    const type = p.type || "ביטוח";
    const company = p.company || "—";
    const premium = isFinite(Number(p.premium)) ? _cdFmtMoney(Number(p.premium)) : "—";
    const note = p.note ? String(p.note) : "";
    return `
      <div class="clientItem">
        <div class="top">
          <div class="t">${escapeHTML(type)} • ${escapeHTML(company)}</div>
          <div class="row" style="gap:8px">
            <span class="tag ok">פרמיה: <b>${escapeHTML(premium)}</b></span>
            <button class="iconBtn" data-cd-act="editPolicy" data-pid="${escapeHTML(p.id)}" title="ערוך">✎</button>
            <button class="iconBtn danger" data-cd-act="delPolicy" data-pid="${escapeHTML(p.id)}" title="מחק">🗑️</button>
          </div>
        </div>
        ${note ? `<div class="m">${escapeHTML(note)}</div>` : ``}
      </div>
    `;
  }).join("");

  empty.style.display = policies.length ? "none" : "";

  list.querySelectorAll("button[data-cd-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const act = btn.getAttribute("data-cd-act");
      const pid = btn.getAttribute("data-pid");
      if(act==="delPolicy"){
        if(!confirm("למחוק את הביטוח הזה?")) return;
        lead.policies = (lead.policies||[]).filter(x=>x.id!==pid);
        addEvent("policy_del", `נמחק ביטוח ללקוח: ${lead.name||"—"}`, {leadId: lead.id});
        saveState();
        _cdRenderPolicies(lead);
        _cdRenderOverview(lead);
        return;
      }
      if(act==="editPolicy"){ _cdOpenPolicyEditor(lead, pid); return; }
      if(false && act==="editPolicy"){
        const p = (lead.policies||[]).find(x=>x.id===pid);
        if(!p) return;
        const type = prompt("סוג ביטוח:", p.type||"") ?? null;
        if(type===null) return;
        const company = prompt("חברה:", p.company||"") ?? null;
        if(company===null) return;
        const premium = prompt("פרמיה חודשית (מספר):", p.premium??"") ?? null;
        if(premium===null) return;
        const note = prompt("הערה (אופציונלי):", p.note||"") ?? null;
        if(note===null) return;

        p.type = String(type||"").trim() || "ביטוח";
        p.company = String(company||"").trim();
        p.premium = Number(String(premium||"").replace(/[^\d.]/g,""));
        p.note = String(note||"").trim();

        addEvent("policy_edit", `עודכן ביטוח ללקוח: ${lead.name||"—"}`, {leadId: lead.id});
        saveState();
        _cdRenderPolicies(lead);
        _cdRenderOverview(lead);
      }
    });
  });
}



function _cdOpenPolicyEditor(lead, policyId){
  try{
    _cdEnsureLeadCollections(lead);
    const isEdit = !!policyId;
    const existing = isEdit ? (lead.policies||[]).find(p=>p.id===policyId) : null;

    const data = existing ? { ...existing } : {
      id: uid("pol"),
      type: "ביטוח",
      company: "",
      premium: "",
      note: "",
      createdAt: _cdNowISO()
    };

    openModal(isEdit ? "עריכת ביטוח" : "הוספת ביטוח", `
      <form id="policyForm" class="form">
        <div class="row">
          <div>
            <label>סוג ביטוח</label>
            <input name="type" value="${escapeHTML(data.type||"ביטוח")}" placeholder="למשל: רכב / דירה / חיים" required />
          </div>
          <div>
            <label>חברה</label>
            <input name="company" value="${escapeHTML(data.company||"")}" placeholder="למשל: הראל / מגדל" />
          </div>
        </div>

        <div class="row" style="margin-top:10px">
          <div>
            <label>פרמיה חודשית</label>
            <input name="premium" value="${escapeHTML(String(data.premium??""))}" placeholder="לדוגמה: 250" inputmode="decimal" />
            <div class="help">רק מספר. אפשר גם להדביק עם ₪/פסיקים – המערכת תנקה.</div>
          </div>
          <div>
            <label>תאריך התחלה (אופציונלי)</label>
            <input name="startAt" value="${escapeHTML(toLocalDT(data.startAt||""))}" type="datetime-local" />
          </div>
        </div>

        <div style="margin-top:10px">
          <label>הערה</label>
          <textarea name="note" placeholder="פרטים/החרגות/כיסויים…">${escapeHTML(data.note||"")}</textarea>
        </div>

        <div class="sep"></div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-start">
          <button class="btn gold" type="submit">💾 שמירה</button>
          <button class="btn" type="button" id="policyCancelBtn">סגור</button>
          ${isEdit ? `<button class="btn danger" type="button" id="policyDeleteBtn">🗑️ מחיקה</button>` : ``}
        </div>
      </form>
    `);

    const form = document.getElementById("policyForm");
    const cancelBtn = document.getElementById("policyCancelBtn");
    cancelBtn?.addEventListener("click", ()=>{ try{ closeModal(); }catch(e){} });

    document.getElementById("policyDeleteBtn")?.addEventListener("click", ()=>{
      if(!confirm("למחוק את הביטוח הזה?")) return;
      lead.policies = (lead.policies||[]).filter(p=>p.id!==data.id);
      addEvent("policy_del", `נמחק ביטוח ללקוח: ${lead.name||"—"}`, {leadId: lead.id});
      saveState();
      _cdRenderPolicies(lead);
      _cdRenderOverview(lead);
      closeModal();
    });

    form?.addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(form);

      const updated = { ...data };
      for(const [k,v] of fd.entries()){
        updated[k] = v;
      }

      // normalize numbers + dates
      const premRaw = String(updated.premium||"").trim();
      const premClean = premRaw.replace(/[^\d.]/g,"");
      updated.premium = premClean ? Number(premClean) : 0;

      updated.startAt = fromLocalDT(updated.startAt);
      updated.type = String(updated.type||"ביטוח").trim() || "ביטוח";
      updated.company = String(updated.company||"").trim();
      updated.note = String(updated.note||"").trim();
      updated.updatedAt = _cdNowISO();

      if(isEdit){
        const i = (lead.policies||[]).findIndex(p=>p.id===updated.id);
        if(i>=0) lead.policies[i] = updated;
        addEvent("policy_edit", `עודכן ביטוח ללקוח: ${lead.name||"—"}`, {leadId: lead.id});
      }else{
        lead.policies = [...(lead.policies||[]), updated];
        addEvent("policy_add", `נוסף ביטוח ללקוח: ${lead.name||"—"}`, {leadId: lead.id});
      }

      saveState();
      _cdRenderPolicies(lead);
      _cdRenderOverview(lead);
      toast("הביטוח נשמר ✅", "ok");
      closeModal();
    });
  }catch(err){
    console.error("_cdOpenPolicyEditor failed", err);
    toast("שגיאה בהוספת ביטוח", "bad");
  }
}


function _cdRenderDocs(lead){
  _cdEnsureLeadCollections(lead);
  const list = el("cd_docsList");
  const empty = el("cd_docsEmpty");
  if(!list || !empty) return;

  const docs = lead.docs || [];
  list.innerHTML = docs.map(d=>{
    const name = d.name || "מסמך";
    const url = d.url || "";
    const when = d.addedAt ? fmtDT(d.addedAt) : "";
    return `
      <div class="clientItem">
        <div class="top">
          <div class="t">${escapeHTML(name)}</div>
          <div class="row" style="gap:8px">
            ${url ? `<button class="btn ghost" style="padding:8px 10px;border-radius:12px" data-cd-act="openDoc" data-did="${escapeHTML(d.id)}">פתח</button>` : ``}
            <button class="iconBtn" data-cd-act="editDoc" data-did="${escapeHTML(d.id)}" title="ערוך">✎</button>
            <button class="iconBtn danger" data-cd-act="delDoc" data-did="${escapeHTML(d.id)}" title="מחק">🗑️</button>
          </div>
        </div>
        <div class="m">${url ? escapeHTML(url) : "<span class='muted'>אין קישור</span>"} ${when ? `<span class="muted"> • ${escapeHTML(when)}</span>`:""}</div>
      </div>
    `;
  }).join("");

  empty.style.display = docs.length ? "none" : "";

  list.querySelectorAll("button[data-cd-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const act = btn.getAttribute("data-cd-act");
      const did = btn.getAttribute("data-did");
      
      if(act==="openDoc"){
        const d = (lead.docs||[]).find(x=>x.id===did);
        if(!d || !d.url) return;
        _openDocViewer(lead, d);
        return;
      }
if(act==="delDoc"){
        if(!confirm("למחוק את המסמך הזה?")) return;
        lead.docs = (lead.docs||[]).filter(x=>x.id!==did);
        addEvent("doc_del", `נמחק מסמך מתיק לקוח: ${lead.name||"—"}`, {leadId: lead.id});
        saveState();
        _cdRenderDocs(lead);
        return;
      }
      if(act==="editDoc"){
        const d = (lead.docs||[]).find(x=>x.id===did);
        if(!d) return;
        const name = prompt("שם מסמך:", d.name||"") ?? null;
        if(name===null) return;
        const url = prompt("קישור (URL):", d.url||"") ?? null;
        if(url===null) return;
        d.name = String(name||"").trim() || "מסמך";
        d.url = String(url||"").trim();
        addEvent("doc_edit", `עודכן מסמך בתיק לקוח: ${lead.name||"—"}`, {leadId: lead.id});
        saveState();
        _cdRenderDocs(lead);
      }
    });
  });

/* ===== In-app Document Viewer ===== */
let _docViewer_ctx = { leadId:null, docId:null, url:null };

function _openDocViewer(lead, doc){
  try{
    const modal = el("docViewerModal");
    if(!modal) return;

    _docViewer_ctx = { leadId: lead?.id || null, docId: doc?.id || null, url: doc?.url || "" };

    el("docViewerTitle").textContent = doc?.name || "מסמך";
    el("docViewerSub").textContent = "צפייה בתוך המערכת";
    el("docViewerName").value = doc?.name || "";
    el("docViewerUrl").value = doc?.url || "";
    el("docViewerNote").value = doc?.note || "";
    el("docViewerWhen").textContent = doc?.addedAt ? fmtDT(doc.addedAt) : "";

    _docViewerLoadFrame(doc?.url || "");

    modal.style.display = "";
    modal.classList.add("show");
    document.body.classList.add("modalOpen");
  }catch(e){}
}

function _closeDocViewer(){
  const modal = el("docViewerModal");
  if(!modal) return;
  modal.classList.remove("show");
  modal.style.display = "none";
  document.body.classList.remove("modalOpen");
  // reset frame to stop network
  const fr = el("docViewerFrame");
  if(fr) fr.src = "about:blank";
}

function _docViewerLoadFrame(url){
  const fr = el("docViewerFrame");
  const st = el("docViewerStatus");
  if(!fr) return;
  const u = String(url||"").trim();
  if(!u){
    fr.src = "about:blank";
    if(st) st.textContent = "אין קישור למסמך";
    return;
  }
  // try to force embed for google drive links
  let finalUrl = u;
  try{
    const isDriveFile = /drive\.google\.com\/file\/d\//.test(u);
    const isDriveOpen = /drive\.google\.com\/open\?id=/.test(u);
    if(isDriveFile && !/\/preview/.test(u)){
      finalUrl = u.replace(/\/view.*$/, "/preview");
    }else if(isDriveOpen){
      const id = (u.match(/[?&]id=([^&]+)/)||[])[1];
      if(id) finalUrl = `https://drive.google.com/file/d/${id}/preview`;
    }
  }catch(e){}
  fr.src = finalUrl;
  if(st) st.textContent = "טוען מסמך…";
  fr.onload = ()=>{ if(st) st.textContent = "תצוגה"; };
}

(function _bindDocViewer(){
  const modal = el("docViewerModal");
  if(!modal) return;

  el("docViewerCloseBtn")?.addEventListener("click", _closeDocViewer);
  el("docViewerOpenNewTab")?.addEventListener("click", ()=>{
    const url = String(el("docViewerUrl")?.value || _docViewer_ctx.url || "").trim();
    if(url) window.open(url, "_blank", "noopener,noreferrer");
  });

  el("docViewerReloadBtn")?.addEventListener("click", ()=>{
    _docViewerLoadFrame(String(el("docViewerUrl")?.value||"").trim());
  });

  el("docViewerSaveBtn")?.addEventListener("click", ()=>{
    const lead = (appState.leads||[]).find(l=>l.id===_docViewer_ctx.leadId);
    if(!lead) return;
    const d = (lead.docs||[]).find(x=>x.id===_docViewer_ctx.docId);
    if(!d) return;

    const newName = String(el("docViewerName")?.value||"").trim() || "מסמך";
    const newUrl  = String(el("docViewerUrl")?.value||"").trim();
    const newNote = String(el("docViewerNote")?.value||"").trim();

    d.name = newName;
    d.url = newUrl;
    d.note = newNote;

    addEvent("doc_edit", `עודכן מסמך בתיק לקוח: ${lead.name||"—"}`, {leadId: lead.id});
    saveState();
    _cdRenderDocs(lead);

    // refresh frame with updated URL
    _docViewer_ctx.url = newUrl;
    _docViewerLoadFrame(newUrl);
  });

  modal.addEventListener("click", (e)=>{
    if(e.target === modal) _closeDocViewer();
  });

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && modal.classList.contains("show")) _closeDocViewer();
  });
})();

}

function _cdRenderHistory(lead){
  const list = el("cd_historyList");
  const empty = el("cd_historyEmpty");
  if(!list || !empty) return;

  const items = (appState.events || []).filter(e=> e?.meta?.leadId === lead?.id || e?.leadId === lead?.id).slice().reverse();
  list.innerHTML = items.map(ev=>{
    const t = (ev.type || "אירוע");
    const ts = ev.at ? fmtDT(ev.at) : "";
    const msg = ev.text || "";
    return `
      <div class="clientItem">
        <div class="top">
          <div class="t">${escapeHTML(t)}</div>
          <div class="muted small">${escapeHTML(ts)}</div>
        </div>
        ${msg ? `<div class="m">${escapeHTML(msg)}</div>` : ``}
      </div>
    `;
  }).join("");

  empty.style.display = items.length ? "none" : "";
}

function _cdSetTab(key){
  const wrap = el("clientDossierModal");
  if(!wrap) return;
  wrap.querySelectorAll(".clientTabs .tabBtn").forEach(b=>{
    b.classList.toggle("active", b.getAttribute("data-tab")===key);
  });
  wrap.querySelectorAll(".clientSection").forEach(sec=>{
    sec.classList.toggle("show", sec.getAttribute("data-sec")===key);
  });

  const lead = _cdGetLead();
  if(!lead) return;
  if(key==="overview") _cdRenderOverview(lead);
  if(key==="policies") _cdRenderPolicies(lead);
  if(key==="docs") _cdRenderDocs(lead);
  if(key==="history") _cdRenderHistory(lead);
}

function closeClientDossier(){
  const modal = el("clientDossierModal");
  modal?.classList.remove("show");
  __dossierLeadId = null;
}

function openClientDossier(id){
  const lead = appState.leads.find(l=>l.id===id);
  if(!lead){
    toast && toast("לא נמצא לקוח", "warn");
    return;
  }
  __dossierLeadId = lead.id;
  _cdEnsureLeadCollections(lead);

  const modal = el("clientDossierModal");
  if(!modal){
    alert("שגיאה: תיק לקוח לא נטען (clientDossierModal)");
    return;
  }
  modal.classList.add("show");

  // Wire tabs
  const tabs = el("clientDossierTabs");
  tabs?.querySelectorAll(".tabBtn").forEach(btn=>{
    btn.onclick = ()=> _cdSetTab(btn.getAttribute("data-tab"));
  });

  // Close
  const _cdCloseBtn = el("clientDossierClose"); if(_cdCloseBtn) _cdCloseBtn.onclick = closeClientDossier;

  // Add policy/doc/event
  const _cdAddPol = el("cd_addPolicy"); if(_cdAddPol) _cdAddPol.onclick = ()=>{ const lead=_cdGetLead(); if(!lead) return; _cdOpenPolicyEditor(lead, null); };

  const _cdAddDoc = el("cd_addDoc"); if(_cdAddDoc) _cdAddDoc.onclick = ()=>{
    const lead = _cdGetLead();
    if(!lead) return;
    const name = prompt("שם מסמך:", "מסמך") ?? null;
    if(name===null) return;
    const url = prompt("קישור למסמך (URL):", "https://") ?? null;
    if(url===null) return;

    const d = {
      id: uid("doc"),
      name: String(name||"").trim() || "מסמך",
      url: String(url||"").trim(),
      addedAt: _cdNowISO()
    };
    lead.docs = [...(lead.docs||[]), d];
    addEvent("doc_add", `נוסף מסמך לתיק לקוח: ${lead.name||"—"}`, {leadId: lead.id});
    saveState();
    _cdRenderDocs(lead);
  };

  function addEventFromDossier(){
    const lead = _cdGetLead();
    if(!lead) return;
    const title = prompt("כותרת אירוע:", "שיחת שירות") ?? null;
    if(title===null) return;
    const msg = prompt("פרטים (אופציונלי):", "") ?? null;
    if(msg===null) return;
    addEvent("client_note", (title + (msg? (" — " + String(msg).trim()) : "")), { leadId: lead.id });
    saveState();
    _cdRenderHistory(lead);
  }

  const _cdAddEv1 = el("clientDossierAddNote"); if(_cdAddEv1) _cdAddEv1.onclick = addEventFromDossier;
  const _cdAddEv2 = el("cd_addEvent2"); if(_cdAddEv2) _cdAddEv2.onclick = addEventFromDossier;

  // default tab
  _cdSetTab("overview");

  // ESC closes (only once per open)
  const onEsc = (e)=>{
    if(e.key==="Escape"){
      closeClientDossier();
      document.removeEventListener("keydown", onEsc);
    }
  };
  document.addEventListener("keydown", onEsc);
}

function renderTasks(){
  const tbody = el("tasksTbody");
  const tasks = [...appState.tasks].sort((a,b)=>{
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return da-db;
  });

  const openTasks = tasks.filter(t=>t.status!=="בוצעה");
  el("emptyTasks").style.display = (openTasks.length===0) ? "" : "none";

  tbody.innerHTML = openTasks.map(t=>{
    const leadName = t.leadId ? (appState.leads.find(l=>l.id===t.leadId)?.name || "ליד") : "—";
    const priTag = t.priority==="גבוהה" ? "hot" : (t.priority==="בינונית" ? "ok" : "cold");
    return `
      <tr>
        <td>${t.dueAt ? fmtDT(t.dueAt) : "—"}</td>
        <td><span class="tag ${priTag}">${escapeHTML(t.priority||"")}</span></td>
        <td>${escapeHTML(leadName)}</td>
        <td>${escapeHTML(t.title||"")}</td>
        <td><span class="tag">${escapeHTML(t.status||"")}</span></td>
        <td>
          <div class="actions">
            <button class="iconBtn gold" title="ערוך" data-tip="ערוך" data-act="edit" data-id="${escapeHTML(t.id)}">✎</button>
            <button class="iconBtn" title="בוצעה/פתוחה" data-act="done" data-id="${escapeHTML(t.id)}">✓</button>
            <button class="iconBtn" title="מחיקה" data-act="del" data-id="${escapeHTML(t.id)}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      if(act==="edit") openTaskForm({ taskId:id });
      if(act==="done") toggleTaskDone(id);
      if(act==="del"){
        if(!confirm("למחוק משימה?")) return;
        appState.tasks = appState.tasks.filter(t=>t.id!==id);
        addEvent("task_delete", "נמחקה משימה", {taskId:id});
        saveState();
      }
    });
  });
}

function renderTimeline(){
  const list = el("timelineList");
  const events = appState.events.slice(0, 200);
  el("emptyTimeline").style.display = (events.length===0) ? "" : "none";

  list.innerHTML = events.map(ev=>{
    const who = ev.who || "משתמש";
    return `
      <div class="event">
        <div class="t">${fmtDT(ev.at)} • ${escapeHTML(who)} • <span class="muted">${escapeHTML(ev.type||"")}</span></div>
        <div class="d">${escapeHTML(ev.text||"")}</div>
      </div>
    `;
  }).join("");
}

/* =======================
   Insights
   ======================= */
function openInsights(){
  const total = appState.leads.length;
  const scores = appState.leads.map(l=>computeScore(l));
  const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

  const byStatus = {};
  for(const l of appState.leads){
    const k = l.status || "לא מוגדר";
    byStatus[k] = (byStatus[k]||0)+1;
  }
  const bySource = {};
  for(const l of appState.leads){
    const k = l.source || "לא מוגדר";
    bySource[k] = (bySource[k]||0)+1;
  }

  const topHot = [...appState.leads]
    .sort((a,b)=>computeScore(b)-computeScore(a))
    .slice(0, 5);

  openModal("סטטיסטיקות • LEADUP", `
    <div class="twoCols">
      <div class="miniCard">
        <h3>סיכום</h3>
        <div class="small muted">סה״כ לידים: <b>${total}</b></div>
        <div class="small muted">ממוצע Score: <b>${avg}</b></div>
        <div class="sep"></div>
        <h3>Top 5 חמים</h3>
        ${topHot.length ? topHot.map(l=>`
          <div class="event">
            <div class="t">${escapeHTML(l.name||"—")} • ${escapeHTML(l.status||"")}</div>
            <div class="d"><b>${computeScore(l)}</b>/100 • ${l.nextFollowUpAt ? "מעקב: "+fmtDT(l.nextFollowUpAt) : "ללא מעקב"}</div>
          </div>
        `).join("") : `<div class="help">אין לידים.</div>`}
      </div>

      <div class="miniCard">
        <h3>התפלגות</h3>
        <div class="small muted"><b>לפי סטטוס</b></div>
        ${Object.keys(byStatus).length ? Object.entries(byStatus).map(([k,v])=>`
          <div class="event"><div class="t">${escapeHTML(k)}</div><div class="d">${v}</div></div>
        `).join("") : `<div class="help">אין נתונים.</div>`}
        <div class="sep"></div>
        <div class="small muted"><b>לפי מקור</b></div>
        ${Object.keys(bySource).length ? Object.entries(bySource).map(([k,v])=>`
          <div class="event"><div class="t">${escapeHTML(k)}</div><div class="d">${v}</div></div>
        `).join("") : `<div class="help">אין נתונים.</div>`}
      </div>
    </div>
  `);
}

/* =======================
   Seed sample data
   ======================= */
function seedSample(){
  if(appState.leads.length && !confirm("כבר יש לידים. להוסיף עוד דוגמאות?")) return;

  const mkLead = (name, phone, status, source, nextDays, talks=0)=>({
    id: uid("lead"),
    name, phone,
    email: "",
    status, source,
    owner: "",
    note: "",
    createdAt: new Date(Date.now() - (Math.random()*8+1)*86400000).toISOString(),
    lastContactAt: talks ? new Date(Date.now() - (Math.random()*4+1)*86400000).toISOString() : "",
    nextFollowUpAt: nextDays!=null ? new Date(Date.now()+nextDays*86400000).toISOString() : "",
    contactCount: talks
  });

  const demo = [
    mkLead("איתי כהן","052-1234567","מתעניין","הפניה",1,3),
    mkLead("נועה לוי","054-9876543","נוצר קשר","פייסבוק",0,1),
    mkLead("דניאל אוחנה","050-2223344","הצעת מחיר","גוגל",2,4),
    mkLead("רועי ביטון","053-5556677","חדש","אתר",3,0),
    mkLead("שחר ממן","052-7654321","נסגר","טלפון",null,6),
  ];

  appState.leads.unshift(...demo);
  addEvent("seed", "נוצרו לידים לדוגמה");
  // גם משימות לדוגמה
  appState.tasks.unshift(
    { id: uid("task"), leadId: demo[0].id, title:"לחזור עם הצעת מחיר", dueAt: new Date(Date.now()+86400000).toISOString(), priority:"גבוהה", status:"פתוחה", createdAt: nowISO() },
    { id: uid("task"), leadId: demo[2].id, title:"בדיקת מסמכים", dueAt: new Date(Date.now()+2*86400000).toISOString(), priority:"בינונית", status:"פתוחה", createdAt: nowISO() }
  );
  addEvent("seed", "נוצרו משימות לדוגמה");
  saveState();
  toast("נוצרו דוגמאות ✅");
}

/* =======================
   Init
   ======================= */
(async function init(){
  if(!appState.events.length){
    addEvent("init", "המערכת עלתה • מצב LocalStorage");
    saveState();
  }
  renderAll();
  // Settings / Google Sheets wiring (safe if Settings view hidden)
  wireGsUI();
  // Auto-load from Sheets if user already enabled it
  if(appCfg.mode==="sheets" && appCfg.webAppUrl){
    try{
      gsSetStatus("בודק חיבור...", true);
      await gsPing();
      gsSetStatus("טוען נתונים...", true);
      await gsPull();
      gsSetStatus("✅ מצב Sheets פעיל", true);
    }catch(e){
      gsSetStatus("❌ " + (e?.message || "שגיאה"), false);
    }
  }
})();
/* =======================
   Transitions + Loader
   ======================= */


/* =======================
   Dynamic Greeting
   ======================= */
function updateGreeting(){
  const h = new Date().getHours();
  let txt = "שלום 👋";
  if(h >= 5 && h < 12) txt = "☀️ בוקר טוב";
  else if(h >= 12 && h < 17) txt = "🌤️ צהריים טובים";
  else if(h >= 17 && h < 21) txt = "🌆 ערב טוב";
  else txt = "🌙 לילה טוב";

  const uName = (window.appState && window.appState.user && window.appState.user.name) ? window.appState.user.name : "";
  const uRole = (window.appState && window.appState.user && window.appState.user.role) ? window.appState.user.role : "";
  const suffix = uName ? (" • " + uName + (uRole ? " ("+uRole+")" : "")) : "";

  const elG = document.getElementById("greetingBadge");
  if(elG) elG.textContent = txt + suffix;
}
updateGreeting();
setInterval(updateGreeting, 60 * 1000);


/* ===== Micro-interaction: subtle haptic on mobile taps ===== */
document.addEventListener("click", (e)=>{
  const b = e.target.closest(".btn, .iconBtn");
  if(!b) return;
  if(navigator.vibrate){
    try{ navigator.vibrate(8); }catch{}
  }
}, {passive:true});


/* ===== Sidebar: My Flows (replaces Quick Task button) ===== */

;




// ===== script block 3 extracted from index (13).html =====

/* ===== Proposal Builder Logic ===== */
(function(){
  const modal = document.getElementById('proposalModal');
  if(!modal) return;

  const frame = document.getElementById('proposalFrame');
  const crumb = document.getElementById('proposalCrumb');
  const openExternal = document.getElementById('proposalOpenExternal');
  const closeBtn = document.getElementById('proposalCloseBtn');
  const doneBtn = document.getElementById('proposalDoneBtn');
  const clearBtn = document.getElementById('proposalClearBtn');
  const backBtn = document.getElementById('proposalBackBtn');
  const companyList = document.getElementById('companyList');

  function showModal(){
    modal.classList.add('show');
    // focus close for accessibility
    setTimeout(()=> closeBtn?.focus(), 0);
  }
  function hideModal(){
    modal.classList.remove('show');
  }
  function clearFrame(){
    frame.src = 'about:blank';
    crumb.textContent = 'לא נבחרה חברה';
    openExternal.style.display = 'none';
    openExternal.href = '#';
    backBtn.style.display = 'none';
    companyList.scrollTop = 0;
  }
  function loadCompany(name, url){
    crumb.textContent = 'נבחר: ' + name;
    frame.src = url;
    openExternal.href = url;
    openExternal.style.display = 'inline';
    backBtn.style.display = 'inline-flex';
  }

  // Close actions
  closeBtn?.addEventListener('click', hideModal);
  doneBtn?.addEventListener('click', hideModal);
  clearBtn?.addEventListener('click', clearFrame);

  // Back (go to list state)
  backBtn?.addEventListener('click', clearFrame);

  // Click outside card closes
  modal.addEventListener('click', (e)=>{
    if(e.target === modal) hideModal();
  });

  // Company selection
  modal.querySelectorAll('.companyBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const name = btn.getAttribute('data-company') || 'חברה';
      const url = btn.getAttribute('data-url') || 'about:blank';
      loadCompany(name, url);
    });
  });

  // Hook into navigation:
  // If there is a nav button with data-view="proposal", open modal when user clicks it.
  const navProposal = document.querySelector('[data-view="proposal"]');
  navProposal?.addEventListener('click', (e)=>{
    // allow the normal tab behavior to mark active etc., but open our modal
    showModal();
  });

  // Also allow programmatic open if setView('proposal') is called somewhere.
  const _setView = window.setView;
  if(typeof _setView === 'function'){
    window.setView = function(view){
      const r = _setView.apply(this, arguments);
      if(view === 'proposal') showModal();
      return r;
    }
  }

  // ESC closes
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && modal.classList.contains('show')) hideModal();
  });

})();



// ===== script block 4 extracted from index (13).html =====

/* ===== E-Sign Logic ===== */
(function(){
  const modal = document.getElementById('esignModal');
  if(!modal) return;

  const openBtn = document.getElementById('navESign') || document.querySelector('[data-view="esign"]');
  const closeBtn = document.getElementById('esignClose');
  const cancelBtn = document.getElementById('esignCancel');
  const sendBtn = document.getElementById('esignSend');

  const docName = document.getElementById('esignDocName');
  const emailEl = document.getElementById('esignEmail');
  const phoneEl = document.getElementById('esignPhone');
  const phoneWrap = document.getElementById('esignPhoneWrap');
  const linkEl  = document.getElementById('esignLink');
  const msgEl   = document.getElementById('esignMsg');
  const optionBtns = Array.from(document.querySelectorAll('.esignOptionBtn'));
  const channelRadios = Array.from(document.querySelectorAll('input[name="esignChannel"]'));

  // Client fetch (TZ/Name/Phone)
  const findTypeWrap = document.getElementById('esignFindType');
  const findQ = document.getElementById('esignFindQ');
  const findBtn = document.getElementById('esignFindBtn');
  const findHint = document.getElementById('esignFindHint');
  let esignFindType = 'tz';
  let esignPickedLeadId = null;

  const templates = {
    health: {
      name: "הצהרת בריאות",
      msg: (client="הלקוח") => `שלום ${client},\nמצורפת הצהרת בריאות לחתימה.\nאנא קרא/י ואשר/י שהפרטים נכונים.\nלאחר החתימה נחזור אליך להמשך תהליך.\nתודה!`
    },
    cancel: {
      name: "בקשה לביטול פוליסה",
      msg: (client="הלקוח") => `שלום ${client},\nמצורף מסמך לבקשה לביטול פוליסה לחתימה.\nלאחר החתימה נעדכן אותך בסטטוס ובאישור הביטול.\nתודה!`
    },
    terms: {
      name: "אישור תנאים",
      msg: (client="הלקוח") => `שלום ${client},\nמצורף מסמך אישור תנאים לחתימה.\nאנא אשר/י שקראת והבנת את התנאים.\nתודה!`
    },
    agent: {
      name: "מינוי סוכן בפוליסה",
      msg: (client="הלקוח") => `שלום ${client},\nמצורף מסמך מינוי סוכן בפוליסה לחתימה.\nלאחר החתימה נמשיך לעדכון מול החברה.\nתודה!`
    }
  };

  function norm(s){ return String(s||'').trim().toLowerCase(); }
  function digitsOnly(s){ return String(s||'').replace(/\D/g,''); }
  function findLead(q, type){
    const leads = (window.appState?.leads || []);
    const qq = norm(q);
    const qd = digitsOnly(q);
    if(!qq) return null;

    let best=null, bestScore=0;
    const score = (l)=>{
      if(type==='tz'){
        const v = digitsOnly(l.tz || l.idNumber || '');
        if(!qd) return 0;
        if(v===qd) return 100;
        if(v.endsWith(qd) || v.includes(qd)) return 70;
        return 0;
      }
      if(type==='phone'){
        const v = digitsOnly(l.phone || '');
        if(!qd) return 0;
        if(v===qd) return 100;
        if(v.endsWith(qd) || v.includes(qd)) return 70;
        return 0;
      }
      const v = norm(l.name || '');
      if(v===qq) return 100;
      if(v.startsWith(qq)) return 80;
      if(v.includes(qq)) return 60;
      return 0;
    };

    for(const l of leads){
      const s = score(l);
      if(s>bestScore){ bestScore=s; best=l; }
    }
    return bestScore>0 ? best : null;
  }


  function getChannel(){
    return (channelRadios.find(r=>r.checked)?.value) || "email";
  }

  
function getSelectedLead(){
    const leads = (window.appState?.leads || []);
    const sel = document.getElementById('leadSelect');
    const picked = esignPickedLeadId || window.__esignLeadId || '';
    const leadId = picked || (sel?.value || '');
    if(!leadId) return null;
    let lead = leads.find(l=> (l.id===leadId) || (l._id===leadId));
    if(!lead){
      const dig = String(leadId).replace(/\D/g,'');
      if(dig) lead = leads.find(l=> String(l.phone||'').replace(/\D/g,'') === dig);
    }
    return lead || null;
  }



  function setPickedLead(lead){
    if(!lead) return;
    esignPickedLeadId = lead.id || lead._id || null;
    window.__esignLeadId = esignPickedLeadId || null;
    try{
      if(findHint){
        findHint.innerHTML = 'נבחר לקוח: <span class="esignFetchSelected">✅ ' + (lead.name||'—') + ' • ' + (lead.phone||'') + '</span>';
      }
    }catch(e){}
    if(emailEl && lead.email && !emailEl.value) emailEl.value = lead.email;
    if(phoneEl && lead.phone && !phoneEl.value) phoneEl.value = lead.phone;
    if(docName && !docName.value) docName.value = 'מסמך לחתימה • ' + (lead.name||'');
  }

  function doFetchLead(){
    const q = findQ ? findQ.value : '';
    const lead = findLead(q, esignFindType);
    if(!lead){
      window.toast && window.toast('לא נמצא לקוח מתאים. נסה שוב.', 'warn');
      return;
    }
    setPickedLead(lead);
    window.toast && window.toast('נטען לקוח: ' + (lead.name||'—'), 'ok');
  }

  if(findTypeWrap){
    findTypeWrap.addEventListener('click', (e)=>{
      const b = e.target.closest('.segBtn');
      if(!b) return;
      [...findTypeWrap.querySelectorAll('.segBtn')].forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      esignFindType = b.dataset.type || 'tz';
      if(findQ){
        findQ.placeholder = esignFindType==='tz' ? 'הקלד ת.ז…' : (esignFindType==='phone' ? 'הקלד טלפון…' : 'הקלד שם מלא…');
        findQ.focus();
      }
    });
  }
  if(findBtn) findBtn.addEventListener('click', doFetchLead);
  if(findQ) findQ.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); doFetchLead(); } });
  function autofillFromLead(){
    const lead = getSelectedLead();
    if(!lead) return;
    if(emailEl && lead.email && !emailEl.value){
      emailEl.value = lead.email;
    }
    if(phoneEl && lead.phone && !phoneEl.value){
      phoneEl.value = lead.phone;
    }
  }

  function openModal(){
    modal.classList.add('show');
    syncChannelUI();
    try{
      const lead = getSelectedLead();
      if(lead) setPickedLead(lead);
    }catch(e){}
    autofillFromLead(); // <<< AUTO FILL HERE
  }

  // Expose for global navigation handler
  window.openESignModal = openModal;

  function closeModal(){
    modal.classList.remove('show');
  }

  function syncChannelUI(){
    const ch = getChannel();
    if(phoneWrap){
      phoneWrap.style.display = (ch === "whatsapp") ? "" : "none";
    }
    if(ch === "whatsapp"){
      phoneEl?.focus();
    }else{
      emailEl?.focus();
    }
  }

  channelRadios.forEach(r=> r.addEventListener('change', syncChannelUI));

  // Open from sidebar button, without changing other nav behavior
  openBtn?.addEventListener('click', (e)=>{
    e.preventDefault?.();
    e.stopPropagation?.();
    openModal();
  });

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  function setActive(btn){
    optionBtns.forEach(b=>b.classList.toggle('active', b===btn));
  }

  function currentClientName(){
    const lead = getSelectedLead();
    return lead?.name || "הלקוח";
  }

  optionBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-doc');
      const t = templates[key];
      setActive(btn);
      if(t){
        if(docName && !docName.value.trim()) docName.value = t.name;
        const client = currentClientName();
        if(msgEl && (!msgEl.value.trim() || msgEl.value.includes("מצורף"))){
          msgEl.value = t.msg(client);
        }
      }
    });
  });

  function normalizeILPhone(p){
    const digits = (p||"").replace(/[^\d]/g, "");
    if(!digits) return "";
    if(digits.startsWith("0")) return "972" + digits.slice(1);
    if(digits.startsWith("972")) return digits;
    return digits;
  }

  function buildMessage(name, link, msg){
    const parts = [];
    if(name) parts.push(`מסמך לחתימה: ${name}`);
    if(msg) parts.push(msg);
    if(link) parts.push(`קישור לחתימה: ${link}`);
    return parts.join("\n\n").trim();
  }


  // ===== E-Sign API (Google Apps Script Web App) =====
  const ESIGN_API_URL = "https://script.google.com/macros/s/AKfycbykXZlXZzITTvf8ZMvBRZ009OLTVhs9VVxpZfSE_OknvMT6KwXYOzkbMWaIWcXdctWG8w/exec";

  

  // ===== E-Sign helpers (robust JSON + JSONP fallback) =====
  async function _esignReadJSON(resp){
    const txt = await resp.text();
    try{ return JSON.parse(txt); }
    catch(e){ return { ok:false, error:"NON_JSON_RESPONSE", raw: txt }; }
  }

  function _esignJsonp(baseUrl, params){
    return new Promise((resolve, reject)=>{
      const cb = "__esign_cb_" + Math.random().toString(36).slice(2);
      const u = new URL(baseUrl);
      Object.entries(params||{}).forEach(([k,v])=> u.searchParams.set(k, String(v)));
      // common callback param names
      u.searchParams.set("callback", cb);
      u.searchParams.set("cb", cb);

      const script = document.createElement("script");
      const timeout = setTimeout(()=>{
        cleanup();
        reject(new Error("JSONP_TIMEOUT"));
      }, 12000);

      function cleanup(){
        clearTimeout(timeout);
        if(script.parentNode) script.parentNode.removeChild(script);
        try{ delete window[cb]; }catch(e){ window[cb] = undefined; }
      }

      window[cb] = (data)=>{ cleanup(); resolve(data); };
      script.onerror = ()=>{ cleanup(); reject(new Error("JSONP_ERROR")); };
      script.src = u.toString();
      document.head.appendChild(script);
    });
  }

  async function _esignCreate(payload){
    // Preferred: POST JSON
    try{
      const r = await fetch(ESIGN_API_URL, {
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect:"follow"
      });
      const data = await _esignReadJSON(r);
      if(!data || data.ok !== true){
        const err = (data && (data.error || data.message)) || ("HTTP_" + r.status);
        const raw = (data && data.raw) ? (" | " + String(data.raw).slice(0,220)) : "";
        throw new Error(err + raw);
      }
      return data;
    }catch(err){
      // Fallback: JSONP GET (works even when CORS blocks fetch)
      console.warn("ESIGN POST failed; trying JSONP fallback...", err);
      return await _esignJsonp(ESIGN_API_URL, payload);
    }
  }
sendBtn?.addEventListener('click', async ()=>{
    const ch = getChannel();

    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const name  = (docName?.value || "").trim();
    const msg   = (msgEl?.value || "").trim();

    const lead = getSelectedLead();
    if(!lead){
      alert("בחר קודם לקוח לשליחה לחתימה");
      return;
    }

    // Validate destination
    if(ch === "email"){
      if(!email){
        alert("נא להזין אימייל לקוח");
        emailEl?.focus();
        return;
      }
    }else{
      const norm = normalizeILPhone(phone);
      if(!norm){
        alert("נא להזין טלפון וואטסאפ של הלקוח");
        phoneEl?.focus();
        return;
      }
    }

    // Create a signing request and get signUrl from Apps Script
    if(!ESIGN_API_URL || ESIGN_API_URL.includes("PASTE_APPS_SCRIPT_URL_HERE")){
      alert("חסר קישור API של מערכת החתימות (ESIGN_API_URL). הכנס את ה-URL שקיבלת מ-Apps Script בתוך index.html.");
      return;
    }

    let signUrl = "";
    try{
      const data = await _esignCreate({
        action:"create",
        leadId: lead.id || lead._id || lead.phone || "",
        customerName: lead.name || "",
        channel: ch,
        to: (ch==="email" ? email : phone),
        templateKey: name || "SIGN"
      });

      if(!data || data.ok !== true) throw new Error(data?.error || "CREATE_FAILED");
      signUrl = data.signUrl || "";
      if(!signUrl) throw new Error("NO_SIGN_URL");
    }catch(e){
      console.error(e);
      alert(`שגיאה ביצירת לינק חתימה.

בדיקות מהירות:
1) ב-Apps Script: Deploy → Web app → מי יכול לגשת: Anyone
2) ודא שה-URL מסתיים ב /exec (לא /dev)
3) פתח את ה-URL בטאב חדש פעם אחת כדי לאשר הרשאות.

פרטים טכניים (לבדיקה): ${e?.message || e}`);
      return;
    }

    // Update lead progress markers (optional)
    try{
      lead.esignSentAt = new Date().toISOString();
      lead.stage = Math.max(Number(lead.stage||1), 5); // שלב חתימה
      addEvent("esign", `נשלח לינק לחתימה: ${name || "מסמך"}`, { leadId: lead.id || lead._id, url: signUrl });
      saveState();
    }catch(e){}

    const fullMsg = buildMessage(name, signUrl, msg);
    const subject = name ? `LEADUP • ${name} לחתימה` : "LEADUP • מסמך לחתימה";

    if(ch === "email"){
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMsg)}`;
      window.open(mailto, "_blank", "noopener,noreferrer");
      closeModal();
      return;
    }

    const norm = normalizeILPhone(phone);
    const wa = `https://wa.me/${encodeURIComponent(norm)}?text=${encodeURIComponent(fullMsg)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
    closeModal();
  });

  modal.addEventListener('click', (e)=>{
    if(e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });
})();



// ===== script block 5 extracted from index (13).html =====

/* ===== Views Patch (proposal + esign) ===== */
(function(){
  try{
    if(window.titles){
      if(!window.titles.proposal) window.titles.proposal = ["יצירת הצעה","בחירת חברה וטופס הצעה"];
      if(!window.titles.esign) window.titles.esign = ["שליחה לחתימת לקוח","שליחת מסמך לחתימה דיגיטלית"];
    }
  }catch(e){}
})();



// ===== script block 6 extracted from index (13).html =====

/* ===== Auth & Users (multi-user base) =====
   - Users are stored in localStorage: leadup_users_v1
   - Current session user stored in sessionStorage: leadup_session_user
   - Gate is handled in index.html before app.js loads, but app.js also supports logout & role checks.
*/
(function(){
  const USERS_KEY = "leadup_users_v1";
  const AUTH_KEY = "leadup_auth_ok";
  const SESSION_USER_KEY = "leadup_session_user";

  function safeJsonParse(raw, fallback){
    try{ return JSON.parse(raw); }catch(_){ return fallback; }
  }

  function seedUsersIfEmpty(){
    try{
      const raw = localStorage.getItem(USERS_KEY);
      const arr = raw ? safeJsonParse(raw, null) : null;
      if(Array.isArray(arr) && arr.length) return arr;
      const admin = { id:"u_admin", name:"מנהל מערכת", pin:"3316", role:"Admin", active:true, createdAt: Date.now() };
      localStorage.setItem(USERS_KEY, JSON.stringify([admin]));
      return [admin];
    }catch(e){
      return [{ id:"u_admin", name:"מנהל מערכת", pin:"3316", role:"Admin", active:true, createdAt: Date.now() }];
    }
  }

  function getUsers(){
    try{
      const raw = localStorage.getItem(USERS_KEY);
      const arr = raw ? safeJsonParse(raw, null) : null;
      return Array.isArray(arr) ? arr : seedUsersIfEmpty();
    }catch(e){
      return seedUsersIfEmpty();
    }
  }

  function setUsers(arr){
    localStorage.setItem(USERS_KEY, JSON.stringify(arr));
  }

  function getSessionUser(){
    try{
      const raw = sessionStorage.getItem(SESSION_USER_KEY);
      if(!raw) return null;
      const u = safeJsonParse(raw, null);
      if(!u || !u.id) return null;
      return u;
    }catch(e){
      return null;
    }
  }

  function logout(){
    try{
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(SESSION_USER_KEY);
    }catch(e){}
    // show gate again by reloading the page (index.html contains the gate)
    location.reload();
  }

  // Ensure users exist
  seedUsersIfEmpty();

  // Attach current user to appState.user (used by the app)
  const su = getSessionUser();
  if(su){
    try{
      appState.user = { name: su.name || "", role: su.role || "Agent", id: su.id };
    }catch(e){}
  }else{
    // fallback for older states
    if(!appState.user) appState.user = { name:"", role:"Admin" };
  }

  // Expose helpers
  window.LEADUP_USERS = {
    getUsers, setUsers, getSessionUser, logout,
    isAdmin: ()=> (getSessionUser()?.role === "Admin" || appState.user?.role === "Admin")
  };

  // Wire logout button if present
  document.addEventListener("DOMContentLoaded", ()=>{
    const b = document.getElementById("btnLogout");
    if(b) b.addEventListener("click", ()=>{
      if(confirm("להתנתק מהמערכת?")) logout();
    });
  });
})();
// ===== script block 7 extracted from index (13).html =====

/* === In-app Back/Forward (Lead screens) === */
(function(){
  const stack = [];
  let idx = -1;

  function setButtons(){
    const b = document.getElementById('leadNavBack');
    const f = document.getElementById('leadNavForward');
    if(!b || !f) return;
    b.disabled = idx <= 0;
    f.disabled = idx >= stack.length - 1;
  }

  function applyState(state){
    // state can be {view:"...", payload:{...}} or a function
    if(!state) return;
    try{
      if(typeof state === 'function'){ state(); return; }
      if(state.view && typeof window.setView === 'function'){
        window.setView(state.view, state.payload || null);
      }else if(state.open && typeof window[state.open] === 'function'){
        window[state.open](state.payload || null);
      }
    }catch(e){ console.warn('nav applyState error', e); }
  }

  function push(state){
    // drop forward history
    if(idx < stack.length - 1) stack.splice(idx + 1);
    stack.push(state);
    idx = stack.length - 1;
    setButtons();
  }

  function back(){
    if(idx <= 0) return;
    idx--;
    setButtons();
    applyState(stack[idx]);
  }

  function forward(){
    if(idx >= stack.length - 1) return;
    idx++;
    setButtons();
    applyState(stack[idx]);
  }

  // Expose helpers so existing code can push states
  window.__leadNavPush = push;
  window.__leadNavBack = back;
  window.__leadNavForward = forward;

  // Bind buttons
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest('#leadNavBack')) back();
    if(e.target && e.target.closest('#leadNavForward')) forward();
  });

  // Auto-track lead screens: whenever setView is called, push it (only when lead modal is open)
  const _setView = window.setView;
  if(typeof _setView === 'function'){
    window.setView = function(view, payload){
      const res = _setView.apply(this, arguments);
      // Only track meaningful transitions
      if(view){
        push({view, payload});
      }
      return res;
    }
  }

  // Wrap common lead functions to keep history
  function wrapLeadFunctions(){
    const _olf = window.openLeadForm;
    if(typeof _olf==='function' && !_olf.__navWrapped){
      window.openLeadForm = function(leadId){
        const res = _olf.apply(this, arguments);
        // push lead screen as a root state
        try{ push(()=>_olf(leadId||null)); }catch(e){}
        return res;
      };
      window.openLeadForm.__navWrapped = true;
    }
  }
  wrapLeadFunctions();

  // When lead modal opens, mark body and seed first state if empty
  window.__markLeadFullOpen = function(isOpen){
    document.body.classList.toggle('lead-full-open', !!isOpen);
    if(isOpen && idx === -1){
      // try to detect current view from global
      const cv = window.currentView || window.activeView || 'lead_new';
      push({view: cv, payload: null});
    }
    if(!isOpen){
      // keep history (so user can reopen and still have it) - or reset if you prefer:
      // stack.length = 0; idx = -1;
      setButtons();
    }
  };

  // Initial
  setButtons();
})();



// ===== script block 8 extracted from index (13).html =====

(function(){
  function closeLeadAndBack(){
    // If we are inside a nested lead screen, go back within the lead flow
    try{ if(typeof window.__leadNavBack==="function" && window.__leadNavBack && (window.__leadNavCanBack?window.__leadNavCanBack():true)){
      // if stack has previous state, navigate back instead of exiting
      const __idx = window.__leadNavIndex?window.__leadNavIndex():null;
      if(__idx!==null && __idx>0){ window.__leadNavBack(); return; }
    }}catch(e){}
// Prefer existing close functions if exist
    try{
      if(typeof window.closeModal === 'function'){
        window.closeModal('lead');
      }
      // Common patterns
      const leadModal = document.getElementById('leadModal') || document.getElementById('newLeadModal') || document.querySelector('.lead-modal');
      if(leadModal){
        leadModal.classList.remove('open','show','is-open','active');
        leadModal.style.display = 'none';
      }
      // remove body lock if we set it
      if(typeof window.__markLeadFullOpen === 'function') window.__markLeadFullOpen(false);

      // Navigate back to leads list inside app
      if(typeof window.setView === 'function'){
        window.setView('leads');
      }else{
        // fallback: click menu item if exists
        const btn = document.querySelector('[data-view="leads"], #btnLeads, .nav-leads');
        if(btn) btn.click();
      }
    }catch(e){ console.warn('closeLeadAndBack error', e); }
  }

  document.addEventListener('click', function(e){
    if(e.target && e.target.closest('#leadNavClose')) closeLeadAndBack();
  });
})();



/* ===== Users Management UI (Admin only) ===== */
(function(){
  function el(id){ return document.getElementById(id); }

  function maskPin(pin){
    const p = String(pin||"");
    if(p.length <= 2) return "••";
    return "•".repeat(Math.max(2, p.length-2)) + p.slice(-2);
  }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function render(){
    const adminArea = el("usersAdminArea");
    const msg = el("usersAccessMsg");
    const tbody = el("usersTbody");
    if(!adminArea || !msg || !tbody) return;

    const isAdmin = (window.LEADUP_USERS && window.LEADUP_USERS.isAdmin && window.LEADUP_USERS.isAdmin());
    adminArea.style.display = isAdmin ? "" : "none";
    msg.style.display = isAdmin ? "none" : "";
    if(!isAdmin){
      msg.textContent = "אין הרשאה לניהול משתמשים. פנה למנהל מערכת.";
      return;
    }

    const users = window.LEADUP_USERS.getUsers().slice().sort((a,b)=> (a.role||"").localeCompare(b.role||"") || (a.name||"").localeCompare(b.name||""));
    tbody.innerHTML = users.map(u=>{
      const id = escapeHtml(u.id||"");
      const name = escapeHtml(u.name||"");
      const role = escapeHtml(u.role||"Agent");
      const pin = escapeHtml(maskPin(u.pin));
      const active = u.active === false ? "לא פעיל" : "פעיל";
      return `
        <tr>
          <td><b>${name}</b></td>
          <td>${role}</td>
          <td dir="ltr">${pin}</td>
          <td>${active}</td>
          <td style="white-space:nowrap">
            <button class="btn ghost" data-act="edit" data-id="${id}">✏️</button>
            <button class="btn danger" data-act="toggle" data-id="${id}">${u.active===false ? "הפעל" : "השבת"}</button>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5"><span class="muted small">אין משתמשים</span></td></tr>`;
  }

  function promptUser(existing){
    const name = prompt("שם משתמש:", existing?.name || "");
    if(name===null) return null;
    const pin = prompt("PIN (ספרות בלבד):", existing?.pin || "");
    if(pin===null) return null;
    const cleanPin = String(pin).trim();
    if(!/^\d{3,8}$/.test(cleanPin)){
      alert("PIN חייב להיות 3-8 ספרות.");
      return null;
    }
    const role = prompt("תפקיד (Admin / Agent):", existing?.role || "Agent");
    if(role===null) return null;
    const cleanRole = (String(role).trim().toLowerCase()==="admin") ? "Admin" : "Agent";
    return { name:String(name).trim(), pin:cleanPin, role:cleanRole };
  }

  document.addEventListener("click", (e)=>{
    const add = e.target.closest("#usersAddBtn");
    if(add){
      const u = promptUser(null);
      if(!u) return;
      const users = window.LEADUP_USERS.getUsers();
      if(users.some(x => String(x.pin||"").trim() === u.pin)){
        alert("PIN כבר קיים. בחר PIN אחר.");
        return;
      }
      users.push({ id: uid("u"), name:u.name, pin:u.pin, role:u.role, active:true, createdAt: Date.now() });
      window.LEADUP_USERS.setUsers(users);
      render();
      return;
    }

    const resetAdmin = e.target.closest("#usersResetAdminPinBtn");
    if(resetAdmin){
      if(!confirm("לאפס את קוד מנהל המערכת ל-3316?")) return;
      const users = window.LEADUP_USERS.getUsers();
      const admin = users.find(x => x.id === "u_admin") || users.find(x => x.role === "Admin");
      if(admin){
        admin.pin = "3316";
        admin.active = true;
        if(!admin.id) admin.id = "u_admin";
      }else{
        users.unshift({ id:"u_admin", name:"מנהל מערכת", pin:"3316", role:"Admin", active:true, createdAt: Date.now() });
      }
      window.LEADUP_USERS.setUsers(users);
      render();
      alert("בוצע. קוד מנהל: 3316");
      return;
    }

    const btn = e.target.closest("button[data-act][data-id]");
    if(!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    const users = window.LEADUP_USERS.getUsers();
    const u = users.find(x => x.id === id);
    if(!u) return;

    if(act === "toggle"){
      if(u.id === "u_admin"){ alert("אי אפשר להשבית את מנהל המערכת הראשי."); return; }
      u.active = (u.active === false) ? true : false;
      window.LEADUP_USERS.setUsers(users);
      render();
      return;
    }

    if(act === "edit"){
      if(u.id === "u_admin"){
        alert("את המשתמש הראשי אפשר לערוך דרך החלפת PIN בלבד (או ליצור Admin נוסף).");
      }
      const next = promptUser(u);
      if(!next) return;
      // check pin uniqueness (if changed)
      const pinDup = users.some(x => x.id !== u.id && String(x.pin||"").trim() === next.pin);
      if(pinDup){ alert("PIN כבר קיים למשתמש אחר."); return; }
      u.name = next.name;
      u.pin = next.pin;
      u.role = next.role;
      window.LEADUP_USERS.setUsers(users);
      render();
      return;
    }
  });

  window.addEventListener("DOMContentLoaded", render);
  document.addEventListener("leaup:viewChanged", render);
})();
