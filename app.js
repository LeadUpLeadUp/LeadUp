const SUPABASE_URL="https://vhvlkerectggovfihjgm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=(id)=>document.getElementById(id);
const safe=(v)=>String(v??"").trim();
const money=(n)=>"₪"+Math.round(Number(n||0)).toLocaleString("he-IL");
let STATE={customers:[],proposals:[],agents:[]};

function parsePayload(row){ if(!row) return {}; if(row.payload&&typeof row.payload==="object") return row.payload; if(typeof row.payload==="string"){try{return JSON.parse(row.payload)}catch(e){return {}}} return {}; }
function num(v){ const n=Number(String(v??"").replace(/[^\d.-]/g,"")); return Number.isFinite(n)?n:0; }
function dateOf(r){ return new Date(r.created_at||r.createdAt||r.updated_at||r.updatedAt||Date.now()); }
function isToday(d){ const n=new Date(); return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate(); }
function isThisMonth(d){ const n=new Date(); return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth(); }

function policyPremium(p){
  if(!p||typeof p!=="object") return 0;
  const base = num(p.premiumAfterDiscountValue ?? p.premiumAfterDiscount ?? p.monthlyPremiumAfterDiscount ?? p.finalMonthlyPremium ?? p.premiumMonthly ?? p.monthlyPremium ?? p.premium ?? p.premiumBefore);
  let addon=0;
  if(p.type==="בריאות" && p.healthAddonPremiums && typeof p.healthAddonPremiums==="object"){
    Object.values(p.healthAddonPremiums).forEach(byInsured=>{
      if(byInsured&&typeof byInsured==="object") Object.values(byInsured).forEach(v=>addon+=num(v));
    });
  }
  return Math.max(0,base+addon);
}

function collectNewPolicies(row){
  const payload=parsePayload(row);
  const arr=[];
  const direct = Array.isArray(payload.newPolicies) ? payload.newPolicies : [];
  const operational = Array.isArray(payload?.operational?.newPolicies) ? payload.operational.newPolicies : [];
  direct.concat(operational).forEach(p=>{ if(p&&typeof p==="object") arr.push(p); });
  const insureds = Array.isArray(payload.insureds) ? payload.insureds : (Array.isArray(payload?.operational?.insureds)?payload.operational.insureds:[]);
  insureds.forEach(ins=>{
    const d=ins?.data||{};
    const np=Array.isArray(d.newPolicies)?d.newPolicies:[];
    np.forEach(p=>{ if(p&&typeof p==="object") arr.push(p); });
  });
  return arr;
}

function proposalPremium(row){
  const top = num(row.monthlyPremium ?? row.monthly_premium ?? row.premium ?? row.totalPremium ?? row.total_premium);
  if(top>0) return top;
  const p=parsePayload(row);
  const direct = num(p.totalPremiumAfterDiscount ?? p.totalMonthlyPremium ?? p.monthlyPremium ?? p.premium ?? p.summary?.totalPremiumAfterDiscount ?? p.summary?.totalMonthlyPremium ?? p.operationalReport?.totalPremium);
  if(direct>0) return direct;
  const policies = collectNewPolicies(row);
  const sum = policies.reduce((s,p)=>s+policyPremium(p),0);
  return sum;
}

function agentName(row){
  const p=parsePayload(row);
  return safe(row.agent_name||row.agentName||row.createdBy||row.created_by||p.agentName||p.createdByName||p.agent) || "ללא נציג";
}
function customerName(row){ const p=parsePayload(row); const op=p?.operational?.primary||{}; return safe(row.full_name||row.fullName||row.name||p.fullName||((op.firstName||"")+" "+(op.lastName||""))) || "ללא שם"; }
function statusOf(row){ const p=parsePayload(row); return safe(row.status||row.proposalStatus||p.status) || "פתוחה"; }

function setTab(tab){
  document.querySelectorAll(".tabPage").forEach(el=>el.classList.toggle("active",el.id===`tab-${tab}`));
  document.querySelectorAll("[data-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.tab===tab));
  $("sideMenu").classList.remove("open");
}
document.addEventListener("click",(e)=>{
  const btn=e.target.closest("[data-tab]");
  if(btn) setTab(btn.dataset.tab);
});
$("menuToggle").addEventListener("click",()=>$("sideMenu").classList.toggle("open"));

async function loadData(){
  const [cr,pr,ar]=await Promise.all([
    supabaseClient.from("customers").select("*"),
    supabaseClient.from("proposals").select("*"),
    supabaseClient.from("agents").select("*")
  ]);
  const ok=!cr.error&&!pr.error&&!ar.error;
  $("serverStatus").textContent=ok?"Supabase Online":"שגיאת חיבור";
  STATE={customers:cr.data||[],proposals:pr.data||[],agents:ar.data||[]};
  render();
}

function render(){
  const {customers,proposals,agents}=STATE;
  const todayProps=proposals.filter(p=>isToday(dateOf(p)));
  const monthProps=proposals.filter(p=>isThisMonth(dateOf(p)));
  $("agentsCount").textContent=`${agents.length} נציגים`;
  $("todayPremium").textContent=money(todayProps.reduce((s,p)=>s+proposalPremium(p),0));
  $("todayProposals").textContent=`${todayProps.length} הצעות היום`;
  $("monthPremium").textContent=money(monthProps.reduce((s,p)=>s+proposalPremium(p),0));
  $("openProposals").textContent=proposals.length.toLocaleString("he-IL");
  $("customersCount").textContent=customers.length.toLocaleString("he-IL");
  $("lastUpdate").textContent=new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
  renderAgents();
  renderFeed();
  renderChart();
  renderStatus();
  renderTables();
}

function agentStats(period){
  const rows = period==="today" ? STATE.proposals.filter(p=>isToday(dateOf(p))) : STATE.proposals.filter(p=>isThisMonth(dateOf(p)));
  const map=new Map();
  STATE.agents.forEach(a=>{
    const name=safe(a.name||a.username||a.user);
    if(name) map.set(name,{name,premium:0,proposals:0,target:num(a.monthlySalesTarget||a.monthly_sales_target)});
  });
  rows.forEach(p=>{
    const name=agentName(p);
    if(!map.has(name)) map.set(name,{name,premium:0,proposals:0,target:0});
    const r=map.get(name); r.premium+=proposalPremium(p); r.proposals++;
  });
  return Array.from(map.values()).sort((a,b)=>b.premium-a.premium);
}
function agentHtml(a,i){
  const pct=a.target?Math.min(100,Math.round((a.premium/a.target)*100)):Math.min(100,Math.round(a.premium/2500));
  return `<div class="agentRow"><div class="agentLeft"><div class="agentRank">${i+1}</div><div><div class="agentName">${a.name}</div><div class="agentPremium">${money(a.premium)} · ${a.proposals} הצעות</div></div></div><div class="targetWrap"><div>${a.target?pct+"%":"ללא יעד"}</div><div class="targetBar"><div class="targetFill" style="width:${pct}%"></div></div></div></div>`;
}
function renderAgents(){
  const today=agentStats("today");
  $("agentsTodayList").innerHTML=today.length?today.map(agentHtml).join(""):`<div class="feedItem">אין מכירות היום עדיין</div>`;
  const month=agentStats("month");
  $("allAgentsList").innerHTML=month.length?month.map(agentHtml).join(""):`<div class="feedItem">אין נציגים להצגה</div>`;
}
function renderFeed(){
  const rows=[
    ...STATE.proposals.map(p=>({t:`נפתחה/עודכנה הצעה עבור ${customerName(p)} · ${money(proposalPremium(p))}`,d:dateOf(p)})),
    ...STATE.customers.map(c=>({t:`נפתח/עודכן תיק לקוח ${customerName(c)}`,d:dateOf(c)}))
  ].sort((a,b)=>b.d-a.d).slice(0,12);
  const html=rows.length?rows.map(r=>`<div class="feedItem"><div class="feedDot"></div><div>${r.t}<br><span style="color:#93c5fd;font-size:12px">${r.d.toLocaleString("he-IL")}</span></div></div>`).join(""):`<div class="feedItem">אין פעילות להצגה</div>`;
  $("feedList").innerHTML=html; $("activityFull").innerHTML=html;
}
function renderChart(){
  const labels=["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  const data=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return {label:labels[d.getMonth()],y:d.getFullYear(),m:d.getMonth(),value:0};});
  STATE.proposals.forEach(p=>{const d=dateOf(p);const x=data.find(a=>a.y===d.getFullYear()&&a.m===d.getMonth());if(x)x.value+=proposalPremium(p);});
  const max=Math.max(1,...data.map(x=>x.value)); const pts=data.map((x,i)=>[50+i*(800/(data.length-1)),255-(x.value/max)*210,x]);
  const path=pts.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(" ");
  $("salesChart").innerHTML=`<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#4da3ff"/><stop offset="1" stop-color="#8dd0ff"/></linearGradient></defs><path d="${path}" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="#8dd0ff"></circle><text x="${p[0]}" y="285" fill="#93c5fd" text-anchor="middle" font-size="18">${p[2].label}</text>`).join("")}`;
}
function renderStatus(){
  const counts={}; STATE.proposals.forEach(p=>counts[statusOf(p)]=(counts[statusOf(p)]||0)+1);
  const entries=Object.entries(counts).slice(0,5); $("donutText").textContent=STATE.proposals.length;
  $("statusLegend").innerHTML=entries.length?entries.map(([k,v],i)=>`<div class="legendRow"><span><span class="legendDot" style="background:${["#4da3ff","#2563eb","#38bdf8","#60a5fa","#1d4ed8"][i]}"></span>${k}</span><b>${v}</b></div>`).join(""):`<div class="legendRow">אין סטטוסים</div>`;
}
function renderTables(){
  $("salesTable").innerHTML=STATE.proposals.slice().sort((a,b)=>dateOf(b)-dateOf(a)).map(p=>`<tr><td>${customerName(p)}</td><td>${agentName(p)}</td><td>${money(proposalPremium(p))}</td><td>${statusOf(p)}</td><td>${dateOf(p).toLocaleDateString("he-IL")}</td></tr>`).join("");
  $("customersTable").innerHTML=STATE.customers.slice().sort((a,b)=>dateOf(b)-dateOf(a)).map(c=>`<tr><td>${customerName(c)}</td><td>${agentName(c)}</td><td>${statusOf(c)}</td><td>${dateOf(c).toLocaleDateString("he-IL")}</td></tr>`).join("");
}
loadData(); setInterval(loadData,15000);
