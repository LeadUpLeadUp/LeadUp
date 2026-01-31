(function(){
  const q = (sel) => document.querySelector(sel);
  const listBody = q("#leadsTbody");
  const search = q("#search");
  const newBtn = q("#newLead");
  const seedBtn = q("#seed");
  const clearBtn = q("#clearAll");

  function rowHtml(lead){
    const name = escapeHtml(lead.name || "");
    const phone = escapeHtml(lead.phone || "");
    const status = escapeHtml(lead.status || "חדש");
    const owner = escapeHtml(lead.owner || "");
    const id = encodeURIComponent(lead.id);
    return `
      <tr>
        <td><strong>${name || "—"}</strong><div><small>${escapeHtml(lead.id || "")}</small></div></td>
        <td>${phone || "—"}</td>
        <td><span class="pill">${status}</span></td>
        <td>${owner || "—"}</td>
        <td>
          <a class="btn" href="lead.html?id=${id}">פתח תיק</a>
        </td>
      </tr>
    `;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  let cache = [];

  async function load(){
    const leads = await window.safeRun(()=> window.DataSource.list());
    if(!leads) return;
    cache = leads;
    render();
  }

  function render(){
    const term = (search.value || "").trim().toLowerCase();
    const filtered = !term ? cache : cache.filter(l => 
      (l.name||"").toLowerCase().includes(term) ||
      (l.phone||"").toLowerCase().includes(term) ||
      (l.email||"").toLowerCase().includes(term) ||
      (l.owner||"").toLowerCase().includes(term) ||
      (l.status||"").toLowerCase().includes(term) ||
      (l.id||"").toLowerCase().includes(term)
    );
    listBody.innerHTML = filtered.map(rowHtml).join("") || `<tr><td colspan="5"><small>אין תוצאות</small></td></tr>`;
  }

  search.addEventListener("input", render);

  newBtn.addEventListener("click", ()=>{
    // create empty lead in lead.html
    window.location.href = "lead.html";
  });

  seedBtn.addEventListener("click", async ()=>{
    if(window.APP.settings.mode === "sheets"){
      window.DataSource.toast("טיפ", "במצב Sheets מומלץ ליצור ליד חדש דרך 'תיק לקוח' כדי שיישמר בשיטס.");
      return;
    }
    window.StorageAPI.seedIfEmpty();
    await load();
    window.DataSource.toast("בוצע", "נוצר ליד דוגמה (Local).");
  });

  clearBtn.addEventListener("click", async ()=>{
    if(!confirm("למחוק את כל הלידים?")) return;
    if(window.APP.settings.mode === "sheets"){
      window.DataSource.toast("לא בוצע", "במצב Sheets מחיקה קבוצתית לא מופעלת בסקאפולד (בטיחות).");
      return;
    }
    localStorage.removeItem("LEADUP_LEADS_V1");
    cache = [];
    await load();
    window.DataSource.toast("בוצע", "כל הלידים נמחקו (Local).");
  });

  load();
})();
