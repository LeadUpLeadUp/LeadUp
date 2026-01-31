/* core.js — מצב גלובלי מינימלי + הגדרות */
(function(){
  const KEY = "LEADUP_SETTINGS_V1";

  function loadSettings(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return { mode:"local", scriptUrl:"" };
      const s = JSON.parse(raw);
      return {
        mode: (s.mode === "sheets") ? "sheets" : "local",
        scriptUrl: (typeof s.scriptUrl === "string") ? s.scriptUrl.trim() : ""
      };
    }catch(e){
      return { mode:"local", scriptUrl:"" };
    }
  }

  function saveSettings(next){
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  window.APP = window.APP || {};
  window.APP.settings = loadSettings();
  window.APP.setSettings = (partial) => {
    const next = { ...window.APP.settings, ...partial };
    // normalize
    next.mode = (next.mode === "sheets") ? "sheets" : "local";
    next.scriptUrl = (next.scriptUrl || "").trim();
    window.APP.settings = next;
    saveSettings(next);
    document.dispatchEvent(new CustomEvent("leaup:settings", { detail: next }));
  };

  // Utility: safe id
  window.APP.makeId = () => "L" + Date.now().toString(36) + Math.random().toString(36).slice(2,8).toUpperCase();
})();
