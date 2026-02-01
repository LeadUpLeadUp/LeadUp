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
   Agents / Assignment (simple v1)
   - Agents list is derived from the same users list used by the login gate: leadup_users_v1
   - This keeps it simple (no admin UI yet) and avoids typos.
   ======================= */
const USERS_KEY = "leadup_users_v1";
const SESSION_USER_KEY = "leadup_session_user";

function getActiveAgents(){
  try{
    const raw = localStorage.getItem(USERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const names = (Array.isArray(arr) ? arr : [])
      .filter(u => u && u.active !== false && String(u.name||"").trim())
      .map(u => String(u.name).trim());
    // Ensure uniqueness
    return Array.from(new Set(names));
  }catch(e){
    return [];
  }
}

function getSessionUser(){
  try{
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    const u = raw ? JSON.parse(raw) : null;
    if(u && typeof u === "object"){
      return { id: u.id||"", name: String(u.name||"").trim(), role: u.role||"" };
    }
  }catch(e){}
  return { id:"", name:"", role:"" };
}

// Set current user in appState (for default assignment / timeline)
try{
  const su = getSessionUser();
  if(su && su.name){
    appState.user = appState.user || {};
    appState.user.name = su.name;
    if(su.role) appState.user.role = su.role;
  }
}catch(e){}


/* =======================
   Demo seed (safe, idempotent)
   - Adds demo agents + demo leads ONLY ONCE
   - Only if there are no leads yet (clean environment)
   - Does NOT overwrite existing real data
   ======================= */
const DEMO_SEEDED_KEY = "leadup_demo_seeded_v1";

function seedDemoDataOnce(){
  try{
    if(localStorage.getItem(DEMO_SEEDED_KEY)==="1") return;
  }catch(e){}

  // Seed ONLY if there are no leads yet
  if(Array.isArray(appState.leads) && appState.leads.length>0) return;

  // --- Demo agents (login users) ---
  try{
    const raw = localStorage.getItem(USERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const users = Array.isArray(arr) ? arr : [];

    const ensureUser = (u)=>{
      if(!u || !u.id) return;
      const exists = users.some(x=>x && x.id===u.id);
      if(!exists) users.push(u);
    };

    // Keep your admin
    ensureUser({ id:"u_admin", name:"מנהל מערכת", pin:"3316", role:"Admin", active:true, createdAt: Date.now()-86400000 });

    // Demo agents
    ensureUser({ id:"u_demo_1", name:"דנה לוי", pin:"1111", role:"Agent", active:true, createdAt: Date.now()-7200000 });
    ensureUser({ id:"u_demo_2", name:"יוסי כהן", pin:"2222", role:"Agent", active:true, createdAt: Date.now()-5400000 });
    ensureUser({ id:"u_demo_3", name:"נועה ישראלי", pin:"3333", role:"Agent", active:true, createdAt: Date.now()-3600000 });

    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }catch(e){}

  const mkLead = (o)=>({
    id: uid("lead"),
    firstName: o.firstName||"",
    lastName: o.lastName||"",
    name: (String(o.firstName||"")+" "+String(o.lastName||"")).trim() || o.name || "לקוח דמו",
    phone: o.phone||"",
    phone2: o.phone2||"",
    email: o.email||"",
    tz: o.tz||"",
    idNumber: o.tz||"",
    address: o.address||"",
    city: o.city||"",
    company: o.company||"",
    campaign: o.campaign||"",
    source: o.source||"אחר",
    status: o.status||"חדש",
    owner: o.assignedTo||o.owner||"מנהל מערכת",
    assignedTo: o.assignedTo||o.owner||"מנהל מערכת",
    note: o.note||"",
    createdAt: o.createdAt||nowISO(),
    lastContactAt: o.lastContactAt||"",
    nextFollowUpAt: o.nextFollowUpAt||"",
    contactCount: o.contactCount||0
  });

  const now = Date.now();
  appState.leads = [
    mkLead({
      firstName:"אור", lastName:"בן-דוד", phone:"052-1234567", email:"or@example.com",
      city:"תל אביב", source:"פייסבוק", status:"מתעניין", assignedTo:"דנה לוי",
      note:"דמו: ביקש הצעת מחיר לביטוח רכב. לחזור מחר 10:30.",
      nextFollowUpAt: new Date(now + 24*3600*1000).toISOString()
    }),
    mkLead({
      firstName:"שירה", lastName:"כהן", phone:"054-7778899", email:"shira@example.com",
      city:"חיפה", source:"גוגל", status:"נוצר קשר", assignedTo:"יוסי כהן",
      note:"דמו: שיחה ראשונית, לשלוח פרטים במייל.",
      nextFollowUpAt: new Date(now + 2*24*3600*1000).toISOString()
    }),
    mkLead({
      firstName:"מיכאל", lastName:"לוין", phone:"050-9988776", email:"michael@example.com",
      city:"ראשון לציון", source:"הפניה", status:"הצעת מחיר", assignedTo:"נועה ישראלי",
      note:"דמו: הוכן מחיר, ממתינים לאישור לקוח.",
      nextFollowUpAt: new Date(now + 6*3600*1000).toISOString()
    }),
    mkLead({
      firstName:"לירון", lastName:"מזרחי", phone:"053-3332211", email:"liron@example.com",
      city:"באר שבע", source:"טלפון", status:"חדש", assignedTo:"מנהל מערכת",
      note:"דמו: ליד חדש נכנס, טרם שיחה."
    })
  ];

  // Mark as seeded
  try{ localStorage.setItem(DEMO_SEEDED_KEY,"1"); }catch(e){}

  // Persist and render
  try{ saveState(); }catch(e){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(appState));
      renderAll();
    
  // Auto-seed demo in empty environment
  try{ seedDemoDataOnce(); }catch(e){}
}catch(e2){}
  }
  toast("נטענו נתוני דמו ✅", "success");
}

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
  saveState();

/* LEADUP_PATCH: lead_form_close_after_save_v1 */
// Close immediately after local save (Sheets sync can continue in background)
try{ closeModal(); }catch(e){}
try{ renderLeads(); }catch(e){} // also re-render
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
  if(!["leads","myflows","tasks","timeline","settings","customer"].includes(view)) view="leads";
  document.querySelectorAll(".nav button[data-view]").forEach(b=>b.classList.toggle("active", b.dataset.view===view));

  el("viewLeads").style.display = (view==="leads") ? "" : "none";
  const __vr = el("viewRight");
  if(__vr) __vr.style.display = (view==="leads") ? "" : "none";
  el("viewMyFlows").style.display = (view==="myflows") ? "" : "none";
  el("viewTasks").style.display = (view==="tasks") ? "" : "none";
  el("viewTimeline").style.display = (view==="timeline") ? "" : "none";
  el("viewSettings").style.display = (view==="settings") ? "" : "none";
  const vc = el("viewCustomer");
  if(vc) vc.style.display = (view==="customer") ? "" : "none";

  const titles = {
    leads: ["לידים", "ניהול לידים, סטטוסים, פעולות ומעקב"],
    myflows: ["הלקוחות שלי", "ניהול וצפייה בלקוחות, פעולות ומעקב"],
    tasks: ["משימות", "תזכורות עם תאריך/שעה + עדיפות + שיוך לליד"],
    timeline: ["יצירת הצעה", "Timeline של כל פעולה ושינוי במערכת"],
    settings: ["הגדרות", "גיבוי/איפוס וחיבור ל-Google Sheets"],
    customer: ["תיק לקוח", "פרטי לקוח, פרמיה חודשית ומסמכים"],
  };
  const t = titles[view] || ["LEADUP", ""];
  el("viewTitle").textContent = t[0];
  el("viewSub").textContent = t[1];

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

/* ===== Customer full-page view ===== */
let __customerId = null;
let __customerTab = "details";

function setCustomerTab(tab){
  __customerTab = tab || "details";
  const tabs = ["details","docs"];
  tabs.forEach(t=>{
    const b = el("ctab_"+t);
    if(b) b.classList.toggle("gold", t===__customerTab);
    const v = el("ctab_"+t+"_view");
    if(v) v.style.display = (t===__customerTab) ? "" : "none";
  });
}

function openCustomerView(idOrLead){
  const lead = (typeof idOrLead === "string")
    ? appState.leads.find(l=>l.id===idOrLead)
    : idOrLead;

  if(!lead){
    toast("לא נמצא לקוח", "warn");
    return;
  }
  __customerId = lead.id;
  _cdEnsureLeadCollections(lead);

  // Switch view
  setView("customer");

  // Header
  const title = el("customerTitle");
  const sub = el("customerSub");
  if(title) title.textContent = "תיק לקוח";
  if(sub) sub.textContent = `לקוח: ${lead.name || "—"} • ת.ז: ${lead.tz || "—"} • טלפון: ${lead.phone || "—"}`;

  // Stats
  el("cd_name2").textContent = lead.name || "—";
  el("cd_phone2").textContent = lead.phone || "—";
  el("cd_tz2").textContent = lead.tz ? ("ת.ז: " + lead.tz) : "";
  el("cd_rep2").textContent = (lead.rep || lead.agent || lead.owner || lead.assignedTo || "—");

  const total = _cdComputePremiumTotal(lead);
  const count = (lead.policies||[]).length;
  el("cd_premiumTotal2").textContent = count ? _cdFmtMoney(total) : "—";
  el("cd_policiesCount2").textContent = String(count);
  const pi = el("cd_premium_inline");
  if(pi) pi.textContent = (count ? _cdFmtMoney(total) : "—");

  // Populate edit fields
  safeSet("cd_edit_name", lead.name || "");
  safeSet("cd_edit_phone", lead.phone || "");
  safeSet("cd_edit_phone2", lead.phone2 || "");
  safeSet("cd_edit_tz", lead.tz || "");
  safeSet("cd_edit_email", lead.email || "");
  safeSet("cd_edit_address", lead.address || "");

  renderCustomerDocs();

  // Simplified customer view: only Details + Docs
  try{
    el("ctab_flows") && (el("ctab_flows").style.display="none");
    el("ctab_sign") && (el("ctab_sign").style.display="none");
    el("ctab_history") && (el("ctab_history").style.display="none");
    el("btnCustomerSendSign") && (el("btnCustomerSendSign").style.display="none");
  }catch(e){}

  setCustomerTab("details");
}


function getCustomerLead(){
  return appState.leads.find(l=>l.id===__customerId) || null;
}

function renderCustomerPolicies(){
  const lead = getCustomerLead();
  if(!lead) return;
  _cdEnsureLeadCollections(lead);
  const tb = el("cd_policies_tbody");
  if(!tb) return;

  tb.innerHTML = (lead.policies||[]).map((p,idx)=>`
    <tr>
      <td><b>${escapeHTML(p?.name || "—")}</b></td>
      <td>${_cdFmtMoney(Number(p?.premium)||0)}</td>
      <td><button class="btn danger" data-pol-del="${idx}">מחק</button></td>
    </tr>
  `).join("");

  tb.querySelectorAll("button[data-pol-del]").forEach(b=>{
    b.onclick = ()=>{
      const i = Number(b.getAttribute("data-pol-del"));
      if(!isFinite(i)) return;
      lead.policies.splice(i,1);
      addEvent("policy", `נמחקה פוליסה: ${(lead.policies[i]?.name)||""}`);
      saveState();
      // refresh header totals
      const total = _cdComputePremiumTotal(lead);
      el("cd_premiumTotal2").textContent = (lead.policies||[]).length ? _cdFmtMoney(total) : "—";
      el("cd_policiesCount2").textContent = String((lead.policies||[]).length);
      renderCustomerPolicies();
    };
  });
}

function renderCustomerDocs(){
  const lead = getCustomerLead();
  if(!lead) return;
  _cdEnsureLeadCollections(lead);
  const tb = el("cd_docs_tbody");
  if(!tb) return;

  tb.innerHTML = (lead.docs||[]).map((d,idx)=>`
    <tr>
      <td><b>${escapeHTML(d?.name || "—")}</b></td>
      <td><a href="${escapeHTML(d?.url||"#")}" target="_blank" rel="noopener">פתח בחלון חדש</a></td>
      <td style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-doc-open="${idx}">פתח כאן</button>
        <button class="btn danger" data-doc-del="${idx}">מחק</button>
      </td>
    </tr>
  `).join("");

  tb.querySelectorAll("button[data-doc-open]").forEach(b=>{
    b.onclick = ()=>{
      const i = Number(b.getAttribute("data-doc-open"));
      const doc = lead.docs[i];
      if(!doc?.url) return;
      const fr = el("cd_doc_frame");
      if(fr) fr.src = doc.url;
    };
  });
  tb.querySelectorAll("button[data-doc-del]").forEach(b=>{
    b.onclick = ()=>{
      const i = Number(b.getAttribute("data-doc-del"));
      if(!isFinite(i)) return;
      lead.docs.splice(i,1);
      addEvent("doc", "נמחק מסמך");
      saveState();
      renderCustomerDocs();
    };
  });
}

function renderCustomerHistory(){
  const lead = getCustomerLead();
  const box = el("cd_history_box");
  if(!box) return;
  if(!lead){ box.innerHTML=""; return; }

  const events = (appState.events||[]).filter(ev=>ev?.leadId===lead.id).slice().reverse();
  if(!events.length){
    box.innerHTML = '<div class="event"><div class="t">אין היסטוריה עדיין</div><div class="d muted">כשיש שינויים/חתימות/מסמכים — זה יופיע כאן.</div></div>';
    return;
  }
  box.innerHTML = events.map(ev=>`
    <div class="event">
      <div class="t">${fmtDT(ev.at)} • ${escapeHTML(ev.type||"")}</div>
      <div class="d">${escapeHTML(ev.msg||"")}</div>
    </div>
  `).join("");
}

function renderCustomerFlows(){
  const lead = getCustomerLead();
  const box = el("cd_flows_box");
  if(!box) return;
  if(!lead){ box.innerHTML=""; return; }

  const tasks = (appState.tasks||[]).filter(t=>t?.leadId===lead.id);
  const next = tasks.filter(t=>t?.status!=="done").slice(0,8);

  const parts = [];
  parts.push(`<div class="event"><div class="t">סטטוס</div><div class="d"><b>${escapeHTML(lead.status||"—")}</b> • מקור: ${escapeHTML(lead.source||"—")}</div></div>`);
  if(next.length){
    parts.push(...next.map(t=>`<div class="event"><div class="t">משימה</div><div class="d">${escapeHTML(t.title||"")}</div></div>`));
  }else{
    parts.push('<div class="event"><div class="t">משימות</div><div class="d muted">אין משימות פתוחות כרגע.</div></div>');
  }
  box.innerHTML = parts.join("");
}

function wireCustomerView(){
  // Simplified customer view: only Details + Docs
  try{
    el("ctab_flows") && (el("ctab_flows").style.display="none");
    el("ctab_sign") && (el("ctab_sign").style.display="none");
    el("ctab_history") && (el("ctab_history").style.display="none");
    el("btnCustomerSendSign") && (el("btnCustomerSendSign").style.display="none");
  }catch(e){}

  el("btnCustomerBack")?.addEventListener("click", ()=>{ setView("leads"); });

  // Header "הוסף מסמך" => jump to docs tab
  el("btnCustomerAddDoc")?.addEventListener("click", ()=>{
    setCustomerTab("docs");
    try{ el("cd_doc_url")?.focus(); }catch(e){}
  });

  el("btnCustomerSave")?.addEventListener("click", ()=>{
    const lead = getCustomerLead();
    if(!lead) return;
    lead.name = safeVal("cd_edit_name","");
    lead.phone = safeVal("cd_edit_phone","");
    lead.phone2 = safeVal("cd_edit_phone2","");
    lead.tz = safeVal("cd_edit_tz","");
    lead.email = safeVal("cd_edit_email","");
    lead.address = safeVal("cd_edit_address","");
    addEvent("edit", "עודכנו פרטי לקוח", {leadId: lead.id});
    saveState();
    toast("נשמר ✅", "success");
    openCustomerView(lead); // refresh
  });

  el("btnDocAdd")?.addEventListener("click", ()=>{
    const lead = getCustomerLead();
    if(!lead) return;
    const url = safeVal("cd_doc_url","").trim();
    const name = safeVal("cd_doc_name","").trim() || "מסמך";
    if(!url){ toast("הדבק קישור למסמך", "warn"); return; }
    _cdEnsureLeadCollections(lead);
    lead.docs.push({ name, url, at: Date.now() });
    safeSet("cd_doc_url",""); safeSet("cd_doc_name","");
    addEvent("doc", `נוסף מסמך: ${name}`, {leadId: lead.id});
    saveState();
    renderCustomerDocs();
    toast("מסמך נוסף ✅", "success");
  });

  // Tabs
  document.querySelectorAll("button[data-ctab]").forEach(b=>{
    b.addEventListener("click", ()=> setCustomerTab(b.getAttribute("data-ctab")));
  });
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
  try{ wireTopSearch(); }catch(e){}
  try{ wireCustomerView(); }catch(e){}
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

  // Wire logout button if present (app.js may be injected AFTER DOMContentLoaded)
  function attachLogout(){
    const b = document.getElementById("btnLogout");
    if(!b) return;
    // avoid double-binding
    if(b.dataset.boundLogout === "1") return;
    b.dataset.boundLogout = "1";
    b.addEventListener("click", ()=>{
      if(confirm("להתנתק מהמערכת?")) logout();
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", attachLogout);
  }else{
    attachLogout();
  }
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

function safeVal(id, def=""){ const e = el(id); return e ? (e.value ?? def) : def; }
function safeSet(id, val){ const e = document.getElementById(id); if(e) e.value = (val ?? ""); }

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
