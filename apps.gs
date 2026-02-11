/**
 * GEMEL INVEST • Apps Script Web App (Sheets backend)
 * 1) Create a Google Sheet.
 * 2) Extensions -> Apps Script. Paste this file.
 * 3) Set SPREADSHEET_ID below.
 * 4) Deploy -> New deployment -> Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5) Copy the /exec URL and paste into app.js (GOOGLE_SCRIPT_URL).
 */
const SPREADSHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

// Sheet tabs
const SHEET_CUSTOMERS = 'Customers';
const SHEET_PROPOSALS = 'Proposals';

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) || '';
  if(action === 'ping') return json({ ok:true, ts: new Date().toISOString() });
  return json({ ok:false, error:'Unknown GET action' });
}

function doPost(e){
  const action = (e && e.parameter && e.parameter.action) || '';
  let body = {};
  try{
    body = JSON.parse(e.postData.contents || '{}');
  }catch(err){
    body = {};
  }
  const payload = body.payload || {};

  try{
    if(action === 'listCustomers') return json({ ok:true, customers: listCustomers_() });
    if(action === 'upsertCustomer') return json({ ok:true, customer: upsertCustomer_(payload.customer) });

    if(action === 'listProposals') return json({ ok:true, proposals: listProposals_() });
    if(action === 'upsertProposal') return json({ ok:true, proposal: upsertProposal_(payload.proposal) });

    return json({ ok:false, error:'Unknown POST action' });
  }catch(err){
    return json({ ok:false, error:String(err) });
  }
}

function getSheet_(name, headers){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function listCustomers_(){
  const headers = ['id','fullName','tz','phone','email','status','segment','updatedAt'];
  const sh = getSheet_(SHEET_CUSTOMERS, headers);
  const values = sh.getDataRange().getValues();
  if(values.length <= 1) return [];
  const rows = values.slice(1);
  return rows.map(r => ({
    id: r[0] || '',
    fullName: r[1] || '',
    tz: r[2] || '',
    phone: r[3] || '',
    email: r[4] || '',
    status: r[5] || 'פעיל',
    segment: r[6] || 'פרימיום',
    updatedAt: r[7] || ''
  })).filter(x => x.id);
}

function upsertCustomer_(c){
  if(!c || !c.id) throw new Error('customer.id required');
  const headers = ['id','fullName','tz','phone','email','status','segment','updatedAt'];
  const sh = getSheet_(SHEET_CUSTOMERS, headers);
  const data = sh.getDataRange().getValues();
  const now = new Date().toISOString();
  const row = [c.id, c.fullName||'', c.tz||'', c.phone||'', c.email||'', c.status||'פעיל', c.segment||'פרימיום', now];

  // find
  let idx = -1;
  for(let i=1;i<data.length;i++){
    if(String(data[i][0]) === String(c.id)){ idx = i+1; break; }
  }
  if(idx === -1){
    sh.appendRow(row);
  }else{
    sh.getRange(idx,1,1,row.length).setValues([row]);
  }
  return Object.assign({}, c, { updatedAt: now });
}

function listProposals_(){
  const headers = ['id','createdAt','status','customerId','customerName','payloadJson','updatedAt'];
  const sh = getSheet_(SHEET_PROPOSALS, headers);
  const values = sh.getDataRange().getValues();
  if(values.length <= 1) return [];
  const rows = values.slice(1);
  return rows.map(r => {
    const payload = safeJsonParse_(r[5]);
    return Object.assign({
      id: r[0] || '',
      createdAt: r[1] || '',
      status: r[2] || 'טיוטה',
      customerId: r[3] || '',
      customerName: r[4] || '',
      updatedAt: r[6] || ''
    }, payload);
  }).filter(x => x.id);
}

function upsertProposal_(p){
  if(!p || !p.id) throw new Error('proposal.id required');
  const headers = ['id','createdAt','status','customerId','customerName','payloadJson','updatedAt'];
  const sh = getSheet_(SHEET_PROPOSALS, headers);
  const data = sh.getDataRange().getValues();
  const now = new Date().toISOString();

  const payload = Object.assign({}, p);
  // remove duplicated columns (already stored separately)
  delete payload.id; delete payload.createdAt; delete payload.status; delete payload.customerId; delete payload.customerName; delete payload.updatedAt;

  const row = [p.id, p.createdAt||now, p.status||'טיוטה', p.customerId||'', p.customerName||'', JSON.stringify(payload), now];

  let idx = -1;
  for(let i=1;i<data.length;i++){
    if(String(data[i][0]) === String(p.id)){ idx = i+1; break; }
  }
  if(idx === -1){
    sh.appendRow(row);
  }else{
    sh.getRange(idx,1,1,row.length).setValues([row]);
  }
  return Object.assign({}, p, { updatedAt: now });
}

function safeJsonParse_(s){
  try{ return s ? JSON.parse(s) : {}; }catch(e){ return {}; }
}

function json(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
