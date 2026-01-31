/* api.js — Sheets mode: תקשורת ל-Google Apps Script Web App
   הפרוטוקול כאן מינימלי: 
   GET  ?action=list
   GET  ?action=get&id=...
   POST action=upsert (JSON)
   POST action=remove (JSON)
   אם ה-WebApp שלך עובד אחרת — רק מעדכנים כאן, בלי לגעת ב-UI.
*/
(function(){
  async function call(url, { method="GET", params=null, body=null } = {}){
    const u = new URL(url);
    if(params){
      Object.entries(params).forEach(([k,v])=> u.searchParams.set(k, v));
    }
    const opts = { method, headers:{} };
    if(method !== "GET"){
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body || {});
    }
    const res = await fetch(u.toString(), opts);
    const txt = await res.text();
    let data = null;
    try{ data = JSON.parse(txt); }catch(e){ /* allow non-json */ }
    if(!res.ok){
      throw new Error((data && data.error) ? data.error : `HTTP ${res.status}`);
    }
    if(data && data.ok === false){
      throw new Error(data.error || "שגיאה מהשרת");
    }
    return data ?? { ok:true, raw:txt };
  }

  function ensureUrl(){
    const url = (window.APP?.settings?.scriptUrl || "").trim();
    if(!url) throw new Error("אין URL ל-Web App. עבור להגדרות והדבק את ה-URL של Apps Script.");
    return url;
  }

  window.SheetsAPI = {
    async list(){
      const url = ensureUrl();
      const data = await call(url, { method:"GET", params:{ action:"list" } });
      return data.leads || [];
    },
    async get(id){
      const url = ensureUrl();
      const data = await call(url, { method:"GET", params:{ action:"get", id } });
      return data.lead || null;
    },
    async upsert(lead){
      const url = ensureUrl();
      const data = await call(url, { method:"POST", body:{ action:"upsert", lead } });
      return data.lead || lead;
    },
    async remove(id){
      const url = ensureUrl();
      const data = await call(url, { method:"POST", body:{ action:"remove", id } });
      return !!data.ok;
    }
  };
})();
