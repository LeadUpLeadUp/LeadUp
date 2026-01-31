(function(){
  const qs = new URLSearchParams(location.search);
  const leadId = qs.get("id");

  const $ = (sel) => document.querySelector(sel);

  const form = $("#leadForm");
  const idEl = $("#leadId");
  const nameEl = $("#name");
  const phoneEl = $("#phone");
  const emailEl = $("#email");
  const ownerEl = $("#owner");
  const statusEl = $("#status");
  const notesEl = $("#notes");

  const saveBtn = $("#saveLead");
  const delBtn = $("#deleteLead");
  const backBtn = $("#backToLeads");

  let current = null;

  function fill(lead){
    current = lead;
    idEl.textContent = lead?.id ? lead.id : "— (חדש)";
    nameEl.value = lead?.name || "";
    phoneEl.value = lead?.phone || "";
    emailEl.value = lead?.email || "";
    ownerEl.value = lead?.owner || "";
    statusEl.value = lead?.status || "חדש";
    notesEl.value = lead?.notes || "";
    delBtn.disabled = !lead?.id;
  }

  async function load(){
    if(!leadId){
      fill({ status:"חדש" });
      return;
    }
    const lead = await window.safeRun(()=> window.DataSource.get(leadId));
    if(!lead){
      window.DataSource.toast("לא נמצא", "הליד לא קיים. חזרה לרשימה.");
      setTimeout(()=> location.href="index.html", 900);
      return;
    }
    fill(lead);
  }

  saveBtn.addEventListener("click", async (e)=>{
    e.preventDefault();
    const payload = {
      id: current?.id,
      name: nameEl.value,
      phone: phoneEl.value,
      email: emailEl.value,
      owner: ownerEl.value,
      status: statusEl.value,
      notes: notesEl.value,
      createdAt: current?.createdAt
    };
    const saved = await window.safeRun(()=> window.DataSource.upsert(payload));
    if(!saved) return;
    fill(saved);
    // update URL if new
    if(!leadId){
      history.replaceState(null, "", "lead.html?id=" + encodeURIComponent(saved.id));
    }
    window.DataSource.toast("נשמר", "תיק הלקוח נשמר בהצלחה.");
  });

  delBtn.addEventListener("click", async ()=>{
    if(!current?.id) return;
    if(!confirm("למחוק את הליד הזה?")) return;
    const ok = await window.safeRun(()=> window.DataSource.remove(current.id));
    if(ok){
      window.DataSource.toast("נמחק", "הליד נמחק. חוזר לרשימה…");
      setTimeout(()=> location.href="index.html", 650);
    }
  });

  backBtn.addEventListener("click", ()=> location.href="index.html");

  load();
})();
