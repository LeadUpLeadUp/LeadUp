const SUPABASE_URL="https://vhvlkerectggovfihjgm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const SESSION_KEY="INVEST_EXECUTIVE_SESSION_V3";
const $=(id)=>document.getElementById(id);
const safe=(v)=>String(v??"").trim();
const money=(n)=>"₪"+Math.round(Number(n||0)).toLocaleString("he-IL");
let STATE={customers:[],proposals:[],agents:[],current:null,authUser:null};

function parsePayload(row){ if(!row) return {}; if(row.payload&&typeof row.payload==="object") return row.payload; if(typeof row.payload==="string"){try{return JSON.parse(row.payload)}catch(e){return {}}} return {}; }
function num(v){ const n=Number(String(v??"").replace(/[^\d.-]/g,"")); return Number.isFinite(n)?n:0; }
function dateOf(r){ return new Date(r.created_at||r.createdAt||r.updated_at||r.updatedAt||Date.now()); }
function isToday(d){ const n=new Date(); return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate(); }
function isThisMonth(d){ const n=new Date(); return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth(); }
function roleLabel(role){ return role==="manager"?"מנהל":role==="ops"?"תפעול":"נציג"; }
function normalizeRole(v){ const r=safe(v).toLowerCase(); if(["manager","admin","adminlite","מנהל"].includes(r)) return "manager"; if(["ops","operations","תפעול"].includes(r)) return "ops"; return "agent"; }
function normalizeAgent(a){ return {...a, name:safe(a.name||a.username||a.user||"נציג"), username:safe(a.username||a.user||a.name), role:normalizeRole(a.role||a.type), active:a.active!==false}; }

function policyPremium(p){
  if(!p||typeof p!=="object") return 0;
  const base=num(p.premiumAfterDiscountValue??p.premiumAfterDiscount??p.monthlyPremiumAfterDiscount??p.finalMonthlyPremium??p.premiumMonthly??p.monthlyPremium??p.premium??p.premiumBefore);
  let addon=0;
  if(p.type==="בריאות"&&p.healthAddonPremiums&&typeof p.healthAddonPremiums==="object"){
    Object.values(p.healthAddonPremiums).forEach(byInsured=>{ if(byInsured&&typeof byInsured==="object") Object.values(byInsured).forEach(v=>addon+=num(v)); });
  }
  return Math.max(0,base+addon);
}
function collectNewPolicies(row){
  const payload=parsePayload(row), arr=[];
  const direct=Array.isArray(payload.newPolicies)?payload.newPolicies:[];
  const operational=Array.isArray(payload?.operational?.newPolicies)?payload.operational.newPolicies:[];
  direct.concat(operational).forEach(p=>{if(p&&typeof p==="object")arr.push(p)});
  const insureds=Array.isArray(payload.insureds)?payload.insureds:(Array.isArray(payload?.operational?.insureds)?payload.operational.insureds:[]);
  insureds.forEach(ins=>{ const np=Array.isArray(ins?.data?.newPolicies)?ins.data.newPolicies:[]; np.forEach(p=>{if(p&&typeof p==="object")arr.push(p)}); });
  return arr;
}
function proposalPremium(row){
  const top=num(row.monthlyPremium??row.monthly_premium??row.premium??row.totalPremium??row.total_premium); if(top>0)return top;
  const p=parsePayload(row);
  const direct=num(p.totalPremiumAfterDiscount??p.totalMonthlyPremium??p.monthlyPremium??p.premium??p.summary?.totalPremiumAfterDiscount??p.summary?.totalMonthlyPremium??p.operationalReport?.totalPremium); if(direct>0)return direct;
  return collectNewPolicies(row).reduce((s,p)=>s+policyPremium(p),0);
}
function agentName(row){
  const p=parsePayload(row);
  return safe(row.agent_name||row.agentName||row.createdBy||row.created_by||p.agentName||p.createdByName||p.agent)||"ללא נציג";
}
function customerName(row){ const p=parsePayload(row); const op=p?.operational?.primary||{}; return safe(row.full_name||row.fullName||row.name||p.fullName||((op.firstName||"")+" "+(op.lastName||"")))||"ללא שם"; }
function statusOf(row){ const p=parsePayload(row); return safe(row.status||row.proposalStatus||p.status)||"פתוחה"; }
function belongsToCurrent(row){
  const cur=STATE.current; if(!cur||cur.role==="manager"||cur.role==="ops") return true;
  const names=[cur.name,cur.username].map(safe).filter(Boolean);
  return names.includes(agentName(row));
}
function filteredProposals(){
  if(!STATE.current) return [];
  if(STATE.current.role==="manager"||STATE.current.role==="ops") return STATE.proposals;
  return STATE.proposals.filter(belongsToCurrent);
}
function filteredCustomers(){
  if(!STATE.current) return [];
  if(STATE.current.role==="manager"||STATE.current.role==="ops") return STATE.customers;
  return STATE.customers.filter(belongsToCurrent);
}

async function fetchAgentsPublic(){
  const res=await supabaseClient.from("agents").select("*");
  return (res.data||[]).map(normalizeAgent);
}
function findAgentByLogin(agents, login, authUser=null){
  const q=safe(login).toLowerCase();
  const email=safe(authUser?.email).toLowerCase();
  return agents.find(a=>{
    const authEmail=safe(a.authEmail||a.auth_email||a.email).toLowerCase();
    return safe(a.username).toLowerCase()===q || safe(a.name).toLowerCase()===q || authEmail===q || (email&&authEmail===email);
  })||null;
}
async function doLogin(login, pass){
  $("loginError").textContent="";
  let agents=await fetchAgentsPublic();

  let authUser=null, authOk=false;
  if(login.includes("@")){
    const auth=await supabaseClient.auth.signInWithPassword({email:login,password:pass});
    if(!auth.error){ authOk=true; authUser=auth.data?.user||null; }
  }

  let agent=findAgentByLogin(agents, login, authUser);
  if(!agent && authUser) agent=findAgentByLogin(agents, authUser.email, authUser);

  const pinOk=agent && safe(agent.pin||agent.pass)===safe(pass);
  if(!authOk && !pinOk) throw new Error("שם משתמש או סיסמה לא תקינים");

  if(agent && agent.active===false) throw new Error("המשתמש לא פעיל");
  if(!agent && authOk) agent={id:authUser.id,name:authUser.email,username:authUser.email,role:"agent",active:true};

  STATE.agents=agents;
  STATE.current=agent;
  STATE.authUser=authUser;
  if($("rememberMe").checked){
    localStorage.setItem(SESSION_KEY, JSON.stringify({login, ts:Date.now(), agentId:agent.id, name:agent.name, role:agent.role}));
  }
  showApp();
}
async function tryRestoreSession(){
  const raw=localStorage.getItem(SESSION_KEY);
  if(!raw) return;
  try{
    const saved=JSON.parse(raw);
    const agents=await fetchAgentsPublic();
    const agent=agents.find(a=>safe(a.id)===safe(saved.agentId))||agents.find(a=>safe(a.name)===safe(saved.name));
    if(agent&&agent.active!==false){
      STATE.agents=agents; STATE.current=agent; showApp();
    }
  }catch(e){}
}
function showApp(){
  document.body.classList.remove("authLocked");
  $("loginScreen").classList.add("hidden");
  $("appShell").hidden=false;
  applyRoleUI();
  loadData();
}
function logout(){
  localStorage.removeItem(SESSION_KEY);
  supabaseClient.auth.signOut().catch(()=>{});
  location.reload();
}

function applyRoleUI(){
  const cur=STATE.current||{role:"agent",name:"נציג"};
  $("userName").textContent=cur.name;
  $("userRole").textContent=roleLabel(cur.role);
  $("helloText").textContent=`שלום ${cur.name}`;
  const isManager=cur.role==="manager", isOps=cur.role==="ops", isAgent=cur.role==="agent";
  $("pageTitle").textContent=isManager?"INVEST Executive Control Center":isOps?"מרכז תפעול INVEST":"הדשבורד האישי שלי";
  $("roleSubtitle").textContent=isManager?"Dashboard מלא לכל הסוכנות":isOps?"תיקים, סטטוסים ומשימות תפעול":"נתונים אישיים בלבד";
  document.querySelectorAll(".navAdminOnly").forEach(el=>el.style.display=isManager?"":"none");
  document.querySelectorAll(".navSalesOnly").forEach(el=>el.style.display=isOps?"none":"");
  document.querySelectorAll(".roleManagerBlock").forEach(el=>el.hidden=!isManager);
  document.querySelectorAll(".roleAgentBlock").forEach(el=>el.hidden=!isAgent);
  document.querySelectorAll(".roleSalesBlock").forEach(el=>el.style.display=isOps?"none":"grid");
  $("customersHint").textContent=isAgent?"הלקוחות שלי בלבד":isOps?"כל התיקים לטיפול":"כל תיקי הלקוח";
}
function setTab(tab){
  if(STATE.current?.role==="ops" && tab==="sales") tab="dashboard";
  if(STATE.current?.role!=="manager" && tab==="agents") tab="dashboard";
  document.querySelectorAll(".tabPage").forEach(el=>el.classList.toggle("active",el.id===`tab-${tab}`));
  document.querySelectorAll("[data-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.tab===tab));
  $("sideMenu").classList.remove("open");
}
document.addEventListener("click",(e)=>{const btn=e.target.closest("[data-tab]"); if(btn) setTab(btn.dataset.tab);});
$("menuToggle").addEventListener("click",()=>$("sideMenu").classList.toggle("open"));
$("logoutBtn").addEventListener("click",logout);
$("togglePassword").addEventListener("click",()=>{const p=$("loginPass");p.type=p.type==="password"?"text":"password";});
$("loginForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const login=safe($("loginUser").value), pass=safe($("loginPass").value);
  if(!login||!pass){$("loginError").textContent="נא להזין שם משתמש וסיסמה";return;}
  $("loginBtn").disabled=true; $("loginBtn").textContent="מתחבר...";
  try{ await doLogin(login,pass); }catch(err){ $("loginError").textContent=err.message||"שגיאת התחברות"; }
  finally{ $("loginBtn").disabled=false; $("loginBtn").textContent="🔒 כניסה למערכת"; }
});

async function loadData(){
  const [cr,pr,ar]=await Promise.all([
    supabaseClient.from("customers").select("*"),
    supabaseClient.from("proposals").select("*"),
    supabaseClient.from("agents").select("*")
  ]);
  const ok=!cr.error&&!pr.error&&!ar.error;
  $("serverStatus").textContent=ok?"Supabase Online":"שגיאת חיבור";
  STATE.customers=cr.data||[]; STATE.proposals=pr.data||[]; if((ar.data||[]).length) STATE.agents=(ar.data||[]).map(normalizeAgent);
  render();
}
function kpiHtml(title,value,icon,sub){return `<div class="glass kpiCard"><div class="kpiTop"><div><div class="kpiTitle">${title}</div><div class="kpiValue">${value}</div></div><div class="kpiIcon">${icon}</div></div><div class="kpiChange">${sub}</div></div>`}
function render(){
  const props=filteredProposals(), customers=filteredCustomers(), cur=STATE.current;
  const todayProps=props.filter(p=>isToday(dateOf(p))), monthProps=props.filter(p=>isThisMonth(dateOf(p)));
  $("agentsCount").textContent=`${STATE.agents.length} נציגים`;
  $("lastUpdate").textContent=new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
  if(cur.role==="ops"){
    $("kpiGrid").innerHTML=[
      kpiHtml("תיקים במערכת",customers.length.toLocaleString("he-IL"),"🗂","צפייה תפעולית"),
      kpiHtml("הצעות בטיפול",props.length.toLocaleString("he-IL"),"📋","כלל הסטטוסים"),
      kpiHtml("עודכנו היום",customers.filter(c=>isToday(dateOf(c))).length,"⏱","תיקי לקוח"),
      kpiHtml("פעילות היום",todayProps.length,"🔔","הצעות שעודכנו")
    ].join("");
  }else{
    $("kpiGrid").innerHTML=[
      kpiHtml(cur.role==="agent"?"המכירות שלי היום":"מכירות היום",money(todayProps.reduce((s,p)=>s+proposalPremium(p),0)),"⚡",`${todayProps.length} הצעות היום`),
      kpiHtml(cur.role==="agent"?"הפרמיה שלי החודש":"פרמיה חודשית",money(monthProps.reduce((s,p)=>s+proposalPremium(p),0)),"📈","חודש נוכחי"),
      kpiHtml("הצעות",props.length.toLocaleString("he-IL"),"💼",cur.role==="agent"?"ההצעות שלי":"כל ההצעות"),
      kpiHtml("תיקי לקוח",customers.length.toLocaleString("he-IL"),"🛡️",cur.role==="agent"?"הלקוחות שלי":"לקוחות קיימים")
    ].join("");
  }
  renderAgents(); renderFeed(); renderChart(); renderStatus(); renderTables();
}
function agentStats(period){
  const rows=(period==="today"?STATE.proposals.filter(p=>isToday(dateOf(p))):STATE.proposals.filter(p=>isThisMonth(dateOf(p)))).filter(p=>STATE.current.role==="manager"||belongsToCurrent(p));
  const map=new Map();
  const baseAgents=STATE.current.role==="manager"?STATE.agents:[STATE.current];
  baseAgents.forEach(a=>{const name=safe(a.name||a.username); if(name)map.set(name,{name,premium:0,proposals:0,target:num(a.monthlySalesTarget||a.monthly_sales_target)});});
  rows.forEach(p=>{const name=agentName(p); if(!map.has(name))map.set(name,{name,premium:0,proposals:0,target:0}); const r=map.get(name); r.premium+=proposalPremium(p); r.proposals++;});
  return Array.from(map.values()).sort((a,b)=>b.premium-a.premium);
}
function agentHtml(a,i){const pct=a.target?Math.min(100,Math.round((a.premium/a.target)*100)):Math.min(100,Math.round(a.premium/2500));return `<div class="agentRow"><div class="agentLeft"><div class="agentRank">${i+1}</div><div><div class="agentName">${a.name}</div><div class="agentPremium">${money(a.premium)} · ${a.proposals} הצעות</div></div></div><div class="targetWrap"><div>${a.target?pct+"%":"ללא יעד"}</div><div class="targetBar"><div class="targetFill" style="width:${pct}%"></div></div></div></div>`}
function renderAgents(){
  const today=agentStats("today"), month=agentStats("month");
  if($("agentsTodayList")) $("agentsTodayList").innerHTML=today.length?today.map(agentHtml).join(""):`<div class="feedItem">אין מכירות היום עדיין</div>`;
  if($("myTodayList")) $("myTodayList").innerHTML=today.length?today.map(agentHtml).join(""):`<div class="feedItem">אין מכירות היום עדיין</div>`;
  if($("allAgentsList")) $("allAgentsList").innerHTML=month.length?month.map(agentHtml).join(""):`<div class="feedItem">אין נציגים להצגה</div>`;
}
function renderFeed(){
  const props=filteredProposals(), customers=filteredCustomers();
  const rows=[...props.map(p=>({t:`נפתחה/עודכנה הצעה עבור ${customerName(p)} · ${money(proposalPremium(p))}`,d:dateOf(p)})),...customers.map(c=>({t:`נפתח/עודכן תיק לקוח ${customerName(c)}`,d:dateOf(c)}))].sort((a,b)=>b.d-a.d).slice(0,12);
  const html=rows.length?rows.map(r=>`<div class="feedItem"><div class="feedDot"></div><div>${r.t}<br><span style="color:#93c5fd;font-size:12px">${r.d.toLocaleString("he-IL")}</span></div></div>`).join(""):`<div class="feedItem">אין פעילות להצגה</div>`;
  $("feedList").innerHTML=html; $("activityFull").innerHTML=html;
}
function renderChart(){
  const props=filteredProposals();
  const labels=["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  const data=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return{label:labels[d.getMonth()],y:d.getFullYear(),m:d.getMonth(),value:0};});
  props.forEach(p=>{const d=dateOf(p);const x=data.find(a=>a.y===d.getFullYear()&&a.m===d.getMonth());if(x)x.value+=proposalPremium(p);});
  const max=Math.max(1,...data.map(x=>x.value)); const pts=data.map((x,i)=>[50+i*(800/(data.length-1)),255-(x.value/max)*210,x]);
  const path=pts.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(" ");
  $("salesChart").innerHTML=`<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#4da3ff"/><stop offset="1" stop-color="#8dd0ff"/></linearGradient></defs><path d="${path}" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="#8dd0ff"></circle><text x="${p[0]}" y="285" fill="#93c5fd" text-anchor="middle" font-size="18">${p[2].label}</text>`).join("")}`;
}
function renderStatus(){
  const props=filteredProposals(), counts={}; props.forEach(p=>counts[statusOf(p)]=(counts[statusOf(p)]||0)+1);
  const entries=Object.entries(counts).slice(0,5); $("donutText").textContent=props.length;
  $("statusLegend").innerHTML=entries.length?entries.map(([k,v],i)=>`<div class="legendRow"><span><span class="legendDot" style="background:${["#4da3ff","#2563eb","#38bdf8","#60a5fa","#1d4ed8"][i]}"></span>${k}</span><b>${v}</b></div>`).join(""):`<div class="legendRow">אין סטטוסים</div>`;
}
function renderTables(){
  $("salesTable").innerHTML=filteredProposals().slice().sort((a,b)=>dateOf(b)-dateOf(a)).map(p=>`<tr><td>${customerName(p)}</td><td>${agentName(p)}</td><td>${money(proposalPremium(p))}</td><td>${statusOf(p)}</td><td>${dateOf(p).toLocaleDateString("he-IL")}</td></tr>`).join("");
  $("customersTable").innerHTML=filteredCustomers().slice().sort((a,b)=>dateOf(b)-dateOf(a)).map(c=>`<tr><td>${customerName(c)}</td><td>${agentName(c)}</td><td>${statusOf(c)}</td><td>${dateOf(c).toLocaleDateString("he-IL")}</td></tr>`).join("");
}
tryRestoreSession();
setInterval(()=>{ if(STATE.current) loadData(); },15000);
