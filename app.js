const SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
const money = (n) => "₪" + Math.round(Number(n || 0)).toLocaleString("he-IL");
const safe = (v) => String(v ?? "").trim();

function getPayload(row){
  if(!row) return {};
  if(row.payload && typeof row.payload === "object") return row.payload;
  if(typeof row.payload === "string"){
    try { return JSON.parse(row.payload); } catch(e){ return {}; }
  }
  return {};
}

function getPremium(row){
  const p = getPayload(row);
  const candidates = [
    row.monthlyPremium, row.monthly_premium, row.premium,
    p.monthlyPremium, p.premium, p.totalPremium, p.totalMonthlyPremium,
    p.summary?.totalPremiumAfterDiscount,
    p.summary?.totalMonthlyPremium,
    p.operationalReport?.totalPremium
  ];
  for(const val of candidates){
    const num = Number(String(val ?? "").replace(/[^\d.-]/g,""));
    if(Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function getAgentName(row, agents){
  const p = getPayload(row);
  const raw = safe(row.agentName || row.agent_name || row.ownerName || row.createdByName || p.agentName || p.agent || p.createdByName);
  if(raw) return raw;
  const id = safe(row.agentId || row.agent_id || p.agentId);
  const agent = agents.find(a => safe(a.id) === id);
  return agent ? safe(agent.name || agent.username) : "ללא נציג";
}

function getDate(row){
  return new Date(row.created_at || row.createdAt || row.updated_at || row.updatedAt || Date.now());
}

async function loadData(){
  const [customersRes, proposalsRes, agentsRes] = await Promise.all([
    supabaseClient.from("customers").select("*"),
    supabaseClient.from("proposals").select("*"),
    supabaseClient.from("agents").select("*")
  ]);

  const ok = !customersRes.error && !proposalsRes.error && !agentsRes.error;
  $("serverStatus").textContent = ok ? "Supabase Online" : "שגיאת חיבור";
  $("serverStatus").parentElement.classList.toggle("online", ok);

  const customers = customersRes.data || [];
  const proposals = proposalsRes.data || [];
  const agents = agentsRes.data || [];

  const totalPremium = proposals.reduce((sum,p) => sum + getPremium(p), 0);
  $("totalPremium").textContent = money(totalPremium);
  $("openProposals").textContent = proposals.length.toLocaleString("he-IL");
  $("customersCount").textContent = customers.length.toLocaleString("he-IL");
  $("agentsCount").textContent = `${agents.length} נציגים`;

  const targetSum = agents.reduce((s,a)=> s + (Number(a.monthlySalesTarget || a.monthly_sales_target || 0) || 0), 0);
  $("targetPercent").textContent = targetSum ? Math.min(999, Math.round((totalPremium / targetSum) * 100)) + "%" : "—";

  renderAgents(agents, proposals);
  renderFeed(customers, proposals);
  renderChart(proposals);
  renderStatus(proposals);
  $("lastUpdate").textContent = "עודכן " + new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
}

function renderAgents(agents, proposals){
  const byAgent = new Map();
  agents.forEach(a => byAgent.set(safe(a.name || a.username), {
    name: safe(a.name || a.username || "נציג"),
    premium: 0,
    proposals: 0,
    target: Number(a.monthlySalesTarget || a.monthly_sales_target || 0) || 0
  }));

  proposals.forEach(p => {
    const name = getAgentName(p, agents);
    if(!byAgent.has(name)) byAgent.set(name, { name, premium:0, proposals:0, target:0 });
    const rec = byAgent.get(name);
    rec.premium += getPremium(p);
    rec.proposals += 1;
  });

  const list = Array.from(byAgent.values()).sort((a,b)=>b.premium-a.premium).slice(0,7);
  $("agentsList").innerHTML = list.length ? list.map((a,i)=>{
    const pct = a.target ? Math.min(100, Math.round((a.premium/a.target)*100)) : Math.min(100, Math.round(a.premium / 2500));
    return `<div class="agentRow">
      <div class="agentLeft">
        <div class="agentRank">${i+1}</div>
        <div>
          <div class="agentName">${a.name}</div>
          <div class="agentPremium">${money(a.premium)} · ${a.proposals} הצעות</div>
        </div>
      </div>
      <div class="targetWrap">
        <div>${a.target ? pct + "%" : "ללא יעד"}</div>
        <div class="targetBar"><div class="targetFill" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }).join("") : `<div class="feedItem">לא נמצאו נציגים להצגה</div>`;
}

function renderFeed(customers, proposals){
  const rows = [
    ...proposals.map(p => ({type:"proposal", name:safe(p.customerName || p.customer_name || getPayload(p).customerName || "לקוח"), date:getDate(p)})),
    ...customers.map(c => ({type:"customer", name:safe(c.full_name || c.fullName || c.name || "לקוח"), date:getDate(c)}))
  ].sort((a,b)=>b.date-a.date).slice(0,8);

  $("feedList").innerHTML = rows.length ? rows.map(r => {
    const txt = r.type === "proposal" ? `נפתחה הצעה עבור ${r.name}` : `נפתח/עודכן תיק לקוח ${r.name}`;
    return `<div class="feedItem"><div class="feedDot"></div><div>${txt}<br><span style="color:#93c5fd;font-size:12px">${r.date.toLocaleString("he-IL")}</span></div></div>`;
  }).join("") : `<div class="feedItem">אין פעילות להצגה עדיין</div>`;
}

function renderChart(proposals){
  const months = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  const data = Array.from({length:6},(_,i)=>{
    const d = new Date();
    d.setMonth(d.getMonth() - (5-i));
    return { label: months[d.getMonth()], y:d.getFullYear(), m:d.getMonth(), value:0 };
  });

  proposals.forEach(p=>{
    const d = getDate(p);
    const item = data.find(x=>x.y===d.getFullYear() && x.m===d.getMonth());
    if(item) item.value += getPremium(p) || 1;
  });

  const max = Math.max(1,...data.map(x=>x.value));
  const points = data.map((x,i)=>{
    const px = 50 + i * (800/(data.length-1));
    const py = 255 - (x.value/max)*210;
    return [px,py,x];
  });

  const path = points.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(" ");
  $("salesChart").innerHTML = `
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#4da3ff"/><stop offset="1" stop-color="#8dd0ff"/></linearGradient></defs>
    <path d="${path}" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="#8dd0ff"></circle>`).join("")}
    ${points.map(p=>`<text x="${p[0]}" y="285" fill="#93c5fd" text-anchor="middle" font-size="18">${p[2].label}</text>`).join("")}
  `;
}

function renderStatus(proposals){
  const counts = {};
  proposals.forEach(p=>{
    const st = safe(p.status || p.proposalStatus || getPayload(p).status || "ללא סטטוס");
    counts[st] = (counts[st] || 0) + 1;
  });
  const entries = Object.entries(counts).slice(0,5);
  $("donutText").textContent = proposals.length;
  $("statusLegend").innerHTML = entries.length ? entries.map(([k,v],i)=>`
    <div class="legendRow"><span><span class="legendDot" style="background:${["#4da3ff","#2563eb","#38bdf8","#60a5fa","#1d4ed8"][i]}"></span>${k}</span><b>${v}</b></div>
  `).join("") : `<div class="legendRow">אין סטטוסים להצגה</div>`;
}

loadData();
setInterval(loadData, 15000);
