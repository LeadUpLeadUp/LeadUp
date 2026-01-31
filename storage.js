/* storage.js — Local mode: שמירה ב-localStorage (יציב ומהיר) */
(function(){
  const KEY = "LEADUP_LEADS_V1";

  function readAll(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      return [];
    }
  }

  function writeAll(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  window.StorageAPI = {
    list(){
      const arr = readAll();
      // newest first
      return arr.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
    },
    get(id){
      return readAll().find(x => x.id === id) || null;
    },
    upsert(lead){
      const arr = readAll();
      const now = Date.now();
      const clean = {
        id: lead.id || window.APP.makeId(),
        name: (lead.name||"").trim(),
        phone: (lead.phone||"").trim(),
        email: (lead.email||"").trim(),
        owner: (lead.owner||"").trim(),
        status: (lead.status||"חדש").trim(),
        notes: (lead.notes||"").trim(),
        createdAt: lead.createdAt || now,
        updatedAt: now
      };
      const idx = arr.findIndex(x=>x.id===clean.id);
      if(idx >= 0) arr[idx] = { ...arr[idx], ...clean, updatedAt: now };
      else arr.push(clean);
      writeAll(arr);
      return clean;
    },
    remove(id){
      const arr = readAll().filter(x=>x.id!==id);
      writeAll(arr);
      return true;
    },
    seedIfEmpty(){
      const arr = readAll();
      if(arr.length) return;
      writeAll([
        {
          id: window.APP.makeId(),
          name: "דוגמה – לקוח ראשון",
          phone: "050-0000000",
          email: "client@example.com",
          owner: "אוריה",
          status: "חדש",
          notes: "זה ליד לדוגמה. אפשר למחוק ולהתחיל לעבוד.",
          createdAt: Date.now()-100000,
          updatedAt: Date.now()-100000
        }
      ]);
    }
  };
})();
