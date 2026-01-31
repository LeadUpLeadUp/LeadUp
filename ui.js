/* ui.js — UI helpers + datasource facade */
(function(){
  const badge = document.getElementById("connectionBadge");
  const toastEl = document.getElementById("toast");
  const toastTitle = document.getElementById("toastTitle");
  const toastText = document.getElementById("toastText");
  const toastClose = document.getElementById("toastClose");

  function setBadge(){
    const mode = window.APP.settings.mode;
    const url = window.APP.settings.scriptUrl;
    if(mode === "sheets"){
      badge.textContent = url ? `מצב: Google Sheets • מחובר ל-WebApp` : "מצב: Google Sheets • חסר URL (הגדרות)";
    }else{
      badge.textContent = "מצב: Local • שמירה במחשב (LocalStorage)";
    }
  }

  function toast(title, text){
    toastTitle.textContent = title;
    toastText.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(()=> toastEl.hidden = true, 4200);
  }

  toastClose?.addEventListener("click", ()=> toastEl.hidden = true);

  document.addEventListener("leaup:settings", setBadge);
  setBadge();

  // DataSource facade — כל המסכים עובדים אותו דבר, בלי לדעת אם זה Local או Sheets
  window.DataSource = {
    async list(){
      if(window.APP.settings.mode === "sheets") return await window.SheetsAPI.list();
      window.StorageAPI.seedIfEmpty();
      return window.StorageAPI.list();
    },
    async get(id){
      if(window.APP.settings.mode === "sheets") return await window.SheetsAPI.get(id);
      return window.StorageAPI.get(id);
    },
    async upsert(lead){
      if(window.APP.settings.mode === "sheets") return await window.SheetsAPI.upsert(lead);
      return window.StorageAPI.upsert(lead);
    },
    async remove(id){
      if(window.APP.settings.mode === "sheets") return await window.SheetsAPI.remove(id);
      return window.StorageAPI.remove(id);
    },
    toast
  };

  // Safe wrapper for actions
  window.safeRun = async (fn) => {
    try{
      return await fn();
    }catch(e){
      console.error(e);
      window.DataSource.toast("שגיאה", e.message || "משהו השתבש");
      return null;
    }
  };
})();
