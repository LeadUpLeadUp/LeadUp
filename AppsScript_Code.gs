/**
 * LEADUP • Google Sheets Sync (Apps Script Web App)
 * Storage model:
 * - Tab: DB
 * - A1: JSON of whole CRM state
 * - B1: last updated ISO
 */
const TAB_NAME = "DB";
const CELL_JSON = "A1";
const CELL_AT = "B1";

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "ping";
  if(action === "ping") return jsonOut({ ok:true, msg:"pong" });

  if(action === "get"){
    const sh = getTab_();
    const raw = String(sh.getRange(CELL_JSON).getValue() || "").trim();
    if(!raw){
      return jsonOut({ ok:true, payload: normalizePayload_({}) });
    }
    try{
      const payload = normalizePayload_(JSON.parse(raw));
      // (Optional) keep DB normalized
      sh.getRange(CELL_JSON).setValue(JSON.stringify(payload));
      return jsonOut({ ok:true, payload });
    }catch(err){
      return jsonOut({ ok:false, error:"JSON parse failed: " + err });
    }
  }

  return jsonOut({ ok:false, error:"Unknown action: " + action });
}

function doPost(e){
  try{
    const body = e && e.postData && e.postData.contents ? e.postData.contents : "";
    const data = body ? JSON.parse(body) : {};
    const action = String(data.action || "put");

    if(action !== "put"){
      return jsonOut({ ok:false, error:"Unknown action: " + action });
    }

    const payload = normalizePayload_(data.payload || {});
    const sh = getTab_();
    sh.getRange(CELL_JSON).setValue(JSON.stringify(payload));
    sh.getRange(CELL_AT).setValue(new Date().toISOString());
    return jsonOut({ ok:true });
  }catch(err){
    return jsonOut({ ok:false, error:String(err) });
  }
}

function normalizePayload_(p){
  // tolerate older DB versions / partial payloads
  const out = (p && typeof p === "object") ? p : {};
  if(!Array.isArray(out.leads)) out.leads = [];
  if(!Array.isArray(out.tasks)) out.tasks = [];
  if(!Array.isArray(out.events)) out.events = [];
  out.leadsSeq = Number(out.leadsSeq || 1) || 1;
  out.tasksSeq = Number(out.tasksSeq || 1) || 1;
  return out;
}

function getTab_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB_NAME);
  if(!sh){
    sh = ss.insertSheet(TAB_NAME);
    sh.getRange(CELL_JSON).setValue("");
    sh.getRange(CELL_AT).setValue("");
    sh.hideSheet();
  }
  return sh;
}

function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
