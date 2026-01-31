/**
 * LEADUP • Google Sheets Sync (Apps Script Web App)
 *
 * Tab: DB
 * A1: JSON payload
 * B1: last updated ISO
 *
 * GET  ?action=ping
 * GET  ?action=get
 * GET  ?action=get&callback=cb   (JSONP for GitHub Pages)
 * POST (text/plain or application/json): {action:"put", payload:{...}}
 */

const TAB_NAME = "DB";
const CELL_JSON = "A1";
const CELL_AT   = "B1";

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "ping";

  if(action === "ping") {
    return output_({ ok:true, msg:"pong" }, e);
  }

  if(action === "get") {
    const sh = getTab_();
    const raw = String(sh.getRange(CELL_JSON).getValue() || "").trim();

    if(!raw) {
      return output_({ ok:true, payload: normalizePayload_({}) }, e);
    }

    try {
      const payload = normalizePayload_(JSON.parse(raw));
      // Optional: store normalized payload back (prevents schema drift)
      sh.getRange(CELL_JSON).setValue(JSON.stringify(payload));
      return output_({ ok:true, payload }, e);
    } catch(err) {
      return output_({ ok:false, error:"JSON parse failed: " + String(err) }, e);
    }
  }

  return output_({ ok:false, error:"Unknown action: " + action }, e);
}

function doPost(e){
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : "";
    const data = body ? JSON.parse(body) : {};
    const action = String(data.action || "put");

    if(action !== "put") {
      return output_({ ok:false, error:"Unknown action: " + action }, null);
    }

    const payload = normalizePayload_(data.payload || {});
    const sh = getTab_();
    sh.getRange(CELL_JSON).setValue(JSON.stringify(payload));
    sh.getRange(CELL_AT).setValue(new Date().toISOString());

    return output_({ ok:true }, null);

  } catch(err) {
    return output_({ ok:false, error:String(err) }, null);
  }
}

function normalizePayload_(p){
  const out = (p && typeof p === "object") ? p : {};
  if(!Array.isArray(out.leads))  out.leads  = [];
  if(!Array.isArray(out.tasks))  out.tasks  = [];
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

function output_(obj, e){
  const cb = e && e.parameter && e.parameter.callback ? String(e.parameter.callback) : "";

  if(cb){
    const js = `${safeCallback_(cb)}(${JSON.stringify(obj)});`;
    return ContentService
      .createTextOutput(js)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeCallback_(name){
  return String(name).replace(/[^a-zA-Z0-9_$.]/g, "");
}
