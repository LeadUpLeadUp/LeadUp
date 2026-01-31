(function(){
  const $ = (s)=>document.querySelector(s);
  const modeLocal = $("#modeLocal");
  const modeSheets = $("#modeSheets");
  const scriptUrl = $("#scriptUrl");
  const saveBtn = $("#saveSettings");
  const testBtn = $("#testConnection");

  function load(){
    const s = window.APP.settings;
    modeLocal.checked = s.mode === "local";
    modeSheets.checked = s.mode === "sheets";
    scriptUrl.value = s.scriptUrl || "";
    scriptUrl.disabled = (s.mode !== "sheets");
  }

  function currentMode(){
    return modeSheets.checked ? "sheets" : "local";
  }

  modeLocal.addEventListener("change", ()=>{
    scriptUrl.disabled = (currentMode() !== "sheets");
  });
  modeSheets.addEventListener("change", ()=>{
    scriptUrl.disabled = (currentMode() !== "sheets");
  });

  saveBtn.addEventListener("click", ()=>{
    window.APP.setSettings({
      mode: currentMode(),
      scriptUrl: scriptUrl.value
    });
    window.DataSource.toast("נשמר", "ההגדרות נשמרו.");
  });

  testBtn.addEventListener("click", async ()=>{
    const next = { mode: currentMode(), scriptUrl: scriptUrl.value };
    window.APP.setSettings(next);
    if(next.mode !== "sheets"){
      window.DataSource.toast("טיפ", "במצב Local אין בדיקת חיבור. החלף ל-Google Sheets כדי לבדוק.");
      return;
    }
    const res = await window.safeRun(()=> window.SheetsAPI.list());
    if(res){
      window.DataSource.toast("מחובר ✅", `נשלפו ${res.length} לידים (או 0 אם השיטס ריק).`);
    }
  });

  load();
})();
