
/* LEADUP • Smart Action Bar Pack
   - Standalone demo project
   - Storage: localStorage
*/

const STORE_KEY = "LEADUP_LEADS_V1";

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function nowTs(){ return Date.now(); }

function toast(msg, type="success"){
  const t = $("#toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>{ t.className = "toast"; }, 1700);
}

function loadLeads(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}
function saveLeads(leads){
  localStorage.setItem(STORE_KEY, JSON.stringify(leads));
}

function fmtDT(ts){
  if(!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("he-IL", {day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit"});
}

function isOverdue(lead){
  if(!lead.nextFollowup) return false;
  return lead.nextFollowup < nowTs() && lead.status !== "סגור";
}

function computeCounters(leads){
  const open = leads.filter(l=> l.status !== "סגור");
  const urgent = open.filter(l=> isOverdue(l) || l.score === "חם");
  const overdue = open.filter(l=> isOverdue(l));
  const needSign = open.filter(l=> l.needSign === true);
  const newToday = open.filter(l=>{
    const d = new Date(l.createdAt || 0);
    const n = new Date();
    return d.toDateString() === n.toDateString();
  });
  return { total: leads.length, open: open.length, urgent: urgent.length, overdue: overdue.length, needSign: needSign.length, newToday: newToday.length };
}

let state = {
  leads: loadLeads(),
  filter: { kind: null, label: "ללא סינון" }
};

function setFilter(kind, label){
  state.filter = { kind, label };
  render();
}

function applyFilter(leads){
  const k = state.filter.kind;
  if(!k) return leads;

  switch(k){
    case "urgent":
      return leads.filter(l=> l.status !== "סגור" && (isOverdue(l) || l.score === "חם"));
    case "overdue":
      return leads.filter(l=> l.status !== "סגור" && isOverdue(l));
    case "needSign":
      return leads.filter(l=> l.status !== "סגור" && l.needSign === true);
    case "newToday":
      return leads.filter(l=>{
        const d = new Date(l.createdAt || 0);
        const n = new Date();
        return l.status !== "סגור" && d.toDateString() === n.toDateString();
      });
    case "hot":
      return leads.filter(l=> l.status !== "סגור" && l.score === "חם");
    default:
      return leads;
  }
}

function buildActionBar(leads){
  const c = computeCounters(leads);

  // Smart cards: each one maps to a filter and is clickable
  const cards = [
    {
      id:"urgent",
      kind: c.urgent > 0 ? "warn" : "ok",
      label:"מחכים לפעולה",
      count:c.urgent,
      meta:"חם או באיחור • לפתוח ולטפל עכשיו",
      chip:"🔔 פעולה",
      onClick: ()=> setFilter("urgent", "מחכים לפעולה (חם/איחור)")
    },
    {
      id:"overdue",
      kind: c.overdue > 0 ? "danger" : "ok",
      label:"עבר זמן חזרה",
      count:c.overdue,
      meta:"חזרות שעברו את המועד",
      chip:"⏰ איחור",
      onClick: ()=> setFilter("overdue", "איחור בחזרה")
    },
    {
      id:"needSign",
      kind: c.needSign > 0 ? "warn" : "ok",
      label:"ממתינים לחתימה",
      count:c.needSign,
      meta:"לקוחות שצריכים לחתום על מסמך",
      chip:"📝 חתימה",
      onClick: ()=> setFilter("needSign", "מחכה לחתימה")
    },
    {
      id:"newToday",
      kind: c.newToday > 0 ? "ok" : "ok",
      label:"לידים חדשים היום",
      count:c.newToday,
      meta:"לבדוק ולחזור מהר • זה מעלה סגירות",
      chip:"✨ היום",
      onClick: ()=> setFilter("newToday", "נוצרו היום")
    }
  ];

  const bar = $("#actionBar");
  bar.innerHTML = "";

  cards.forEach(card=>{
    const el = document.createElement("div");
    el.className = "actionCard";
    el.dataset.kind = card.kind;
    el.innerHTML = `
      <div class="glow"></div>
      <div class="top">
        <div>
          <div class="label">${card.label}</div>
          <div class="meta">${card.meta}</div>
        </div>
        <div class="count">${card.count}</div>
      </div>
      <div style="margin-top:10px; display:flex; justify-content:flex-start;">
        <span class="chip">${card.chip}</span>
      </div>
    `;
    el.addEventListener("click", card.onClick);
    bar.appendChild(el);
  });

  // Update sidebar pill
  $("#pillLeads").textContent = String(c.total);
}

function tagForScore(score){
  if(score === "חם") return `<span class="tag hot">חם</span>`;
  if(score === "בינוני") return `<span class="tag ok">בינוני</span>`;
  return `<span class="tag cold">קר</span>`;
}

function renderTable(leads){
  const tbody = $("#leadsTbody");
  tbody.innerHTML = "";

  if(leads.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">אין תוצאות לסינון הנוכחי.</td>`;
    tbody.appendChild(tr);
    return;
  }

  leads.forEach(lead=>{
    const tr = document.createElement("tr");
    const overdue = isOverdue(lead);
    const sign = lead.needSign ? `<span class="tag hot">כן</span>` : `<span class="tag cold">לא</span>`;
    const follow = lead.nextFollowup ? fmtDT(lead.nextFollowup) : "—";
    const statusTag = overdue
      ? `<span class="tag hot">איחור</span>`
      : `<span class="tag cold">${lead.status}</span>`;

    tr.innerHTML = `
      <td><b>${escapeHtml(lead.name)}</b></td>
      <td>${escapeHtml(lead.phone)}</td>
      <td>${statusTag}</td>
      <td>${tagForScore(lead.score)}</td>
      <td>${follow}</td>
      <td>${sign}</td>
      <td>
        <div class="actions">
          <button class="iconBtn gold" data-act="call" title="התקשר">📞</button>
          <button class="iconBtn" data-act="edit" title="ערוך">✏️</button>
          <button class="iconBtn" data-act="close" title="סגור ליד">✅</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-act="call"]').addEventListener("click", (e)=>{
      e.stopPropagation();
      toast("📞 דמו: קריאה ללקוח", "success");
    });
    tr.querySelector('[data-act="edit"]').addEventListener("click", (e)=>{
      e.stopPropagation();
      openLeadModal(lead);
    });
    tr.querySelector('[data-act="close"]').addEventListener("click", (e)=>{
      e.stopPropagation();
      closeLead(lead.id);
    });

    tbody.appendChild(tr);
  });

  $("#leadsMeta").textContent = `${leads.length} תוצאות`;
}

function render(){
  const leads = state.leads;
  buildActionBar(leads);

  $("#activeFilterTag").textContent = state.filter.label || "ללא סינון";

  // quick pills
  $$(".filterPill").forEach(b=> b.classList.remove("active"));
  const activeQuick = state.filter.kind ? state.filter.kind : "all";
  const pillMap = { all:"all", hot:"hot", overdue:"overdue", sign:"needSign" };
  const toActivate = Object.keys(pillMap).find(k=> pillMap[k] === activeQuick) || "all";
  const btn = $(`.filterPill[data-quick="${toActivate}"]`);
  if(btn) btn.classList.add("active");

  const filtered = applyFilter(leads);
  renderTable(filtered);
}

function seedDemoData(){
  const base = nowTs();
  const demo = [
    { id: uid(), name:"דניאל כהן", phone:"052-1234567", status:"בטיפול", score:"חם", createdAt: base-2*60*60*1000, nextFollowup: base-30*60*1000, needSign:true },
    { id: uid(), name:"שירה לוי", phone:"054-2223334", status:"חדש", score:"בינוני", createdAt: base-3*60*60*1000, nextFollowup: base+3*60*60*1000, needSign:false },
    { id: uid(), name:"איתי ישראלי", phone:"050-9998877", status:"מחכה", score:"קר", createdAt: base-26*60*60*1000, nextFollowup: base-6*60*60*1000, needSign:false },
    { id: uid(), name:"מיכל פרץ", phone:"053-1010101", status:"בטיפול", score:"חם", createdAt: base-1*60*60*1000, nextFollowup: base+60*60*1000, needSign:true },
  ];
  state.leads = demo;
  saveLeads(state.leads);
  toast("✨ נטענו נתוני דמו", "success");
  render();
}

function uid(){
  return Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

/* ===== Lead modal (add/edit) ===== */
let editingId = null;

function openLeadModal(lead=null){
  editingId = lead ? lead.id : null;

  $("#name").value = lead?.name || "";
  $("#phone").value = lead?.phone || "";
  $("#status").value = lead?.status || "חדש";
  $("#score").value = lead?.score || "חם";
  $("#needSign").value = lead?.needSign ? "כן" : "לא";

  if(lead?.nextFollowup){
    const d = new Date(lead.nextFollowup);
    const pad = (n)=> String(n).padStart(2,"0");
    const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $("#nextFollowup").value = v;
  }else{
    $("#nextFollowup").value = "";
  }

  $("#leadModalBack").style.display = "flex";
  requestAnimationFrame(()=> $("#leadModalBack").classList.add("show"));
}

function closeLeadModal(){
  const back = $("#leadModalBack");
  back.classList.add("closing");
  back.classList.remove("show");
  setTimeout(()=>{
    back.classList.remove("closing");
    back.style.display = "none";
  }, 180);
}

function upsertLeadFromForm(){
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  if(!name || !phone){
    toast("חסר שם/טלפון", "warn");
    return;
  }

  const status = $("#status").value;
  const score = $("#score").value;
  const needSign = $("#needSign").value === "כן";

  let nextFollowup = null;
  const dt = $("#nextFollowup").value;
  if(dt){
    const parsed = new Date(dt).getTime();
    if(!Number.isNaN(parsed)) nextFollowup = parsed;
  }

  const leads = state.leads.slice();
  if(editingId){
    const idx = leads.findIndex(l=> l.id === editingId);
    if(idx >= 0){
      leads[idx] = { ...leads[idx], name, phone, status, score, needSign, nextFollowup, updatedAt: nowTs() };
    }
  }else{
    leads.unshift({ id: uid(), name, phone, status, score, needSign, nextFollowup, createdAt: nowTs() });
  }

  state.leads = leads;
  saveLeads(leads);
  toast("✅ נשמר", "success");
  closeLeadModal();
  render();
}

function closeLead(id){
  const leads = state.leads.slice();
  const idx = leads.findIndex(l=> l.id === id);
  if(idx < 0) return;
  leads[idx] = { ...leads[idx], status:"סגור", updatedAt: nowTs() };
  state.leads = leads;
  saveLeads(leads);
  toast("✅ הליד נסגר", "success");
  render();
}

/* ===== Theme ===== */
function setTheme(theme){
  const html = document.documentElement;
  html.setAttribute("data-theme", theme);
  $("#themeLight").classList.toggle("active", theme==="light");
  $("#themeDark").classList.toggle("active", theme==="dark");
}

/* ===== Wire events ===== */
function wire(){
  $("#btnSeed").addEventListener("click", seedDemoData);
  $("#btnAddLead").addEventListener("click", ()=> openLeadModal(null));

  $("#leadModalClose").addEventListener("click", closeLeadModal);
  $("#leadModalCancel").addEventListener("click", closeLeadModal);
  $("#leadModalBack").addEventListener("click", (e)=>{
    if(e.target.id === "leadModalBack") closeLeadModal();
  });

  $("#leadForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    upsertLeadFromForm();
  });

  $("#btnClearFilter").addEventListener("click", ()=> setFilter(null, "ללא סינון"));

  $$(".filterPill").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const q = btn.dataset.quick;
      if(q === "all") setFilter(null, "ללא סינון");
      if(q === "hot") setFilter("hot", "חמים");
      if(q === "overdue") setFilter("overdue", "איחור בחזרה");
      if(q === "sign") setFilter("needSign", "מחכה לחתימה");
    });
  });

  $("#themeLight").addEventListener("click", ()=> setTheme("light"));
  $("#themeDark").addEventListener("click", ()=> setTheme("dark"));

  // initial pills
  render();
}

wire();
