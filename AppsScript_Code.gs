/**
 * LEADUP • Google Sheets Sync (Apps Script Web App)
 *
 * 1) Create a Google Sheet (any name)
 * 2) Extensions → Apps Script
 * 3) Paste this file as Code.gs
 * 4) Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone with the link
 * 5) Copy the Web App URL (ends with /exec) and paste it in LEADUP → הגדרות → Google Sheets
 *
 * Storage model:
 * - Sheet tab name: DB
 * - Cell A1: JSON string of the whole CRM state
 * - Cell B1: ISO timestamp
 */

const TAB_NAME = "DB";
const CELL_JSON = "A1";
const CELL_AT = "B1";

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  if(action === "ping") return jsonOut({ ok:true, msg:"pong" });

  if(action === "get"){
    const sh = getTab_();
    const raw = String(sh.getRange(CELL_JSON).getValue() || "").trim();
    if(!raw){
      // empty DB – return minimal default
      return jsonOut({ ok:true, payload: { leads:[], tasks:[], events:[], leadsSeq:1, tasksSeq:1 } });
    }
    try{
      const payload = JSON.parse(raw);
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
    const action = data.action || "put";

    if(action !== "put"){
      return jsonOut({ ok:false, error:"Unknown action: " + action });
    }

    const payload = data.payload || data.appState || data.state || data;
    if(!payload || typeof payload !== "object"){
      return jsonOut({ ok:false, error:"Invalid payload" });
    }

    // Normalize structure
    payload.leads = Array.isArray(payload.leads) ? payload.leads : [];
    payload.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    payload.events = Array.isArray(payload.events) ? payload.events : [];
    payload.leadsSeq = Number(payload.leadsSeq || 1);
    payload.tasksSeq = Number(payload.tasksSeq || 1);
    }

    const sh = getTab_();
    sh.getRange(CELL_JSON).setValue(JSON.stringify(payload));
    sh.getRange(CELL_AT).setValue(new Date().toISOString());

    return jsonOut({ ok:true });
  }catch(err){
    return jsonOut({ ok:false, error:String(err) });
  }
}

function getTab_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB_NAME);
  if(!sh){
    sh = ss.insertSheet(TAB_NAME);
    sh.getRange(CELL_JSON).setValue("");
    sh.getRange(CELL_AT).setValue("");
    sh.hideSheet(); // keep it clean
  }
  return sh;
}

function jsonOut(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
