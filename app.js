/* Insurance CRM Onboarding – Single-file JS (no frameworks) */

const STEPS = [
  { key: "client", title: "פרטי לקוח", hint: "מילוי פרטי מבוטחים ומסמכים בסיסיים" },
  { key: "existing", title: "ביטוחים קיימים", hint: "היסטוריית ביטוחים/פרמיות בחברות קודמות" },
  { key: "newPolicy", title: "פוליסה חדשה", hint: "מה נרכש בפוליסה החדשה לכל מבוטח" },
  { key: "medical", title: "שאלון רפואי", hint: "תשאול רפואי נפרד לכל מבוטח" },
  { key: "payment", title: "אמצעי תשלום", hint: "חיוב/אמצעי תשלום ואישור" },
  { key: "summary", title: "סיכום", hint: "צפייה, בדיקה והפקת סיכום" },
];

const TASK_COVERS = [
  "בריאות",
  "חיים",
  "תאונות אישיות",
  "אובדן כושר עבודה",
  "חיסכון/פנסיה",
  "סיעוד"
];

const MED_QUESTIONS = [
  { id: "q1", text: "האם קיימות מחלות כרוניות / מצב רפואי מתמשך?" },
  { id: "q2", text: "האם בוצע ניתוח / אשפוז ב-5 השנים האחרונות?" },
  { id: "q3", text: "האם קיימת נטילת תרופות קבועה?" },
  { id: "q4", text: "עישון?" },
  { id: "q5", text: "האם קיימת מגבלה רפואית משמעותית בעבודה/תפקוד?" }
];

const state = {
  step: 0,
  client: {
    dealOwner: "",
    leadSource: "",
    notes: "",
    insured: [
      mkInsured("primary", "מבוטח ראשי"),
      // spouse / child added dynamically
    ],
    documents: [
      // {name,type,urlOrName,date}
    ]
  },
  existingPolicies: [
    // {company, policyType, premiumMonthly, premiumTotal, status, notes}
  ],
  newPolicy: {
    company: "",
    product: "",
    startDate: "",
    coveragesByInsured: {
      // insuredId: [ {coverage, sumInsured, premiumMonthly, notes} ]
    }
  },
  medical: {
    answersByInsured: {
      // insuredId: { q1:{answer,details}, ... }
    }
  },
  payment: {
    method: "credit",
    payerName: "",
    payerId: "",
    cardLast4: "",
    installments: "1",
    billingDate: "",
    consent: false
  }
};

/* ---------- helpers ---------- */

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function mkInsured(role, label){
  return {
    id: uid("insured"),
    role, // primary|spouse|child
    label,
    firstName: "",
    lastName: "",
    idNumber: "",
    dob: "",
    phone: "",
    email: "",
    address: "",
    occupation: "",
    relation: role === "primary" ? "עצמי" : (role === "spouse" ? "בן/בת זוג" : "ילד/ה")
  };
}

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.remove("show"), 2200);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function currency(n){
  const x = Number(n || 0);
  return x.toLocaleString("he-IL", { style:"currency", currency:"ILS", maximumFractionDigits:0 });
}

/* ---------- init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  bindTop();
  bindTabs();
  render();
});

function bindTop(){
  $("#btnPrev").addEventListener("click", () => gotoStep(state.step - 1));
  $("#btnNext").addEventListener("click", () => {
    if (!validateStep(state.step)) return;
    gotoStep(state.step + 1);
  });

  $("#btnPrimary").addEventListener("click", () => {
    if (!validateAll()) return;
    toast("נשמר (דמו). השלב הבא: חיבור לשרת/שיטס.");
    // פה בעתיד עושים POST לשרת שלך (Sheets Web App / API)
    // fetch(SERVER_URL, {method:'POST', body: JSON.stringify(state) ...})
  });

  $("#btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `client_onboarding_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("הורד סיכום JSON");
  });

  $("#btnReset").addEventListener("click", () => {
    if (!confirm("לאפס את כל הנתונים?")) return;
    location.reload();
  });
}

function bindTabs(){
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = Number(btn.dataset.step);
      if (s === state.step) return;
      // allow jump only if current is valid or backward
      if (s > state.step && !validateStep(state.step)) return;
      gotoStep(s);
    });
  });
}

function gotoStep(n){
  state.step = clamp(n, 0, STEPS.length - 1);
  render();
}

/* ---------- validation ---------- */

function validateStep(step){
  if (step === 0){
    const primary = state.client.insured.find(x => x.role === "primary");
    if (!primary.firstName || !primary.lastName || !primary.idNumber){
      toast("חסר: שם פרטי/משפחה/ת״ז למבוטח הראשי");
      return false;
    }
  }
  if (step === 4){
    if (!state.payment.consent){
      toast("חסר: אישור תשלום/הרשאה");
      return false;
    }
  }
  return true;
}

function validateAll(){
  for (let i=0;i<STEPS.length;i++){
    if (!validateStep(i)) {
      gotoStep(i);
      return false;
    }
  }
  return true;
}

/* ---------- render ---------- */

function render(){
  // tabs state
  $all(".tab").forEach(t => t.classList.toggle("active", Number(t.dataset.step) === state.step));

  // progress
  $("#progressLabel").textContent = `שלב ${state.step + 1} מתוך ${STEPS.length}`;
  $("#progressHint").textContent = STEPS[state.step].hint;
  $("#progressFill").style.width = `${((state.step + 1) / STEPS.length) * 100}%`;

  // prev/next
  $("#btnPrev").disabled = state.step === 0;
  $("#btnNext").disabled = state.step === STEPS.length - 1;

  // main step
  const host = $("#stepHost");
  host.innerHTML = "";
  host.appendChild(renderKPIs());

  const stepKey = STEPS[state.step].key;
  if (stepKey === "client") host.appendChild(renderStepClient());
  if (stepKey === "existing") host.appendChild(renderStepExisting());
  if (stepKey === "newPolicy") host.appendChild(renderStepNewPolicy());
  if (stepKey === "medical") host.appendChild(renderStepMedical());
  if (stepKey === "payment") host.appendChild(renderStepPayment());
  if (stepKey === "summary") host.appendChild(renderStepSummary());
}

function renderKPIs(){
  const wrap = document.createElement("div");
  wrap.className = "grid cols3";
  wrap.style.marginBottom = "12px";

  const totalExistingMonthly = state.existingPolicies.reduce((s,p)=> s + Number(p.premiumMonthly||0), 0);
  const totalNewMonthly = calcNewMonthly();

  wrap.appendChild(kpi("פרמיה חודשית קיימת", currency(totalExistingMonthly), "סך כל הביטוחים הקיימים"));
  wrap.appendChild(kpi("פרמיה חודשית חדשה", currency(totalNewMonthly), "מה שנרכש בפוליסה החדשה"));
  wrap.appendChild(kpi("מס׳ מבוטחים", String(state.client.insured.length), "ראשי + בני משפחה (אם הוספת)"));
  return wrap;
}

function kpi(title, value, sub){
  const el = document.createElement("div");
  el.className = "kpi";
  el.innerHTML = `
    <div class="k">${escapeHtml(title)}</div>
    <div class="v">${escapeHtml(value)}</div>
    <div class="s">${escapeHtml(sub)}</div>
  `;
  return el;
}

function renderStepClient(){
  const box = document.createElement("div");
  box.className = "grid cols2";

  // left: insured cards
  const left = document.createElement("div");
  left.className = "card";

  left.appendChild(sectionHeader("מבוטחים", "ראשי / בן-בת זוג / ילד", [
    { text: "הוסף בן/בת זוג", onClick: addSpouse },
    { text: "הוסף ילד", onClick: addChild }
  ]));

  const insuredWrap = document.createElement("div");
  insuredWrap.className = "grid";
  insuredWrap.style.gap = "12px";

  state.client.insured.forEach((ins, idx) => {
    insuredWrap.appendChild(renderInsuredCard(ins, idx));
  });

  left.appendChild(insuredWrap);

  // right: documents + meta
  const right = document.createElement("div");
  right.className = "card";

  right.appendChild(sectionHeader("מסמכים ומידע כללי", "אפשר קובץ/קישור (דמו)", []));

  const meta = document.createElement("div");
  meta.className = "grid cols2";
  meta.innerHTML = `
    <div class="field">
      <label>נציג/סוכן סוגר</label>
      <input class="input" id="dealOwner" placeholder="לדוגמה: דוד לוי" value="${escapeAttr(state.client.dealOwner)}"/>
    </div>
    <div class="field">
      <label>מקור ליד</label>
      <input class="input" id="leadSource" placeholder="פייסבוק / הפניה / אתר..." value="${escapeAttr(state.client.leadSource)}"/>
    </div>
    <div class="field" style="grid-column:1/-1">
      <label>הערות כלליות</label>
      <textarea id="clientNotes" placeholder="כל דבר חשוב לעסקה...">${escapeHtml(state.client.notes || "")}</textarea>
      <small class="help">בשלבים הבאים נבנה גם שמירה לשרת/שיטס.</small>
    </div>
  `;
  right.appendChild(meta);

  right.appendChild(divHr());
  right.appendChild(renderDocuments());

  // wire meta
  setTimeout(() => {
    $("#dealOwner").addEventListener("input", e => state.client.dealOwner = e.target.value);
    $("#leadSource").addEventListener("input", e => state.client.leadSource = e.target.value);
    $("#clientNotes").addEventListener("input", e => state.client.notes = e.target.value);
  });

  box.appendChild(left);
  box.appendChild(right);
  return box;
}

function renderInsuredCard(insured){
  const card = document.createElement("div");
  card.className = "card";

  const canRemove = insured.role !== "primary";
  const badge = insured.role === "primary" ? "badgeOk" : (insured.role === "spouse" ? "badgeWarn" : "");

  const header = document.createElement("div");
  header.className = "sectionTitle";
  header.innerHTML = `
    <div>
      <h3>${escapeHtml(insured.label)}</h3>
      <div class="hint">${escapeHtml(insured.relation)} • ID: <span class="muted">${escapeHtml(insured.id.slice(-8))}</span></div>
    </div>
    <div class="rowActions">
      <span class="badge ${badge}">${escapeHtml(insured.role === "primary" ? "PRIMARY" : "FAMILY")}</span>
      ${canRemove ? `<button class="btn btnGhost" type="button" data-remove="${insured.id}">הסר</button>` : ""}
    </div>
  `;
  card.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "grid cols3";
  grid.innerHTML = `
    <div class="field">
      <label>שם פרטי</label>
      <input class="input" data-k="firstName" data-id="${insured.id}" value="${escapeAttr(insured.firstName)}" />
    </div>
    <div class="field">
      <label>שם משפחה</label>
      <input class="input" data-k="lastName" data-id="${insured.id}" value="${escapeAttr(insured.lastName)}" />
    </div>
    <div class="field">
      <label>תעודת זהות</label>
      <input class="input" data-k="idNumber" data-id="${insured.id}" placeholder="9 ספרות" value="${escapeAttr(insured.idNumber)}" />
    </div>

    <div class="field">
      <label>תאריך לידה</label>
      <input class="input" type="date" data-k="dob" data-id="${insured.id}" value="${escapeAttr(insured.dob)}" />
    </div>
    <div class="field">
      <label>טלפון</label>
      <input class="input" data-k="phone" data-id="${insured.id}" placeholder="+972..." value="${escapeAttr(insured.phone)}" />
    </div>
    <div class="field">
      <label>אימייל</label>
      <input class="input" type="email" data-k="email" data-id="${insured.id}" placeholder="name@email.com" value="${escapeAttr(insured.email)}" />
    </div>

    <div class="field" style="grid-column:1/-1">
      <label>כתובת</label>
      <input class="input" data-k="address" data-id="${insured.id}" value="${escapeAttr(insured.address)}" />
    </div>
    <div class="field" style="grid-column:1/-1">
      <label>עיסוק</label>
      <input class="input" data-k="occupation" data-id="${insured.id}" value="${escapeAttr(insured.occupation)}" />
    </div>
  `;
  card.appendChild(grid);

  // bind inputs + remove
  setTimeout(() => {
    card.querySelectorAll("input[data-id]").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const id = e.target.dataset.id;
        const k = e.target.dataset.k;
        const obj = state.client.insured.find(x => x.id === id);
        if (!obj) return;
        obj[k] = e.target.value;
        // ensure medical/newPolicy containers exist
        ensureContainersForInsured(id);
        renderKPIsOnly();
      });
    });

    const rm = card.querySelector(`[data-remove="${insured.id}"]`);
    if (rm){
      rm.addEventListener("click", () => {
        if (!confirm("להסיר מבוטח זה?")) return;
        removeInsured(insured.id);
      });
    }
  });

  return card;
}

function renderDocuments(){
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.style.marginTop = "12px";

  const header = sectionHeader("מסמכים", "העלאת קובץ/קישור (דמו UI)", [
    { text: "הוסף מסמך", onClick: () => addDocumentRow() }
  ]);
  wrap.appendChild(header);

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>שם מסמך</th>
        <th>סוג</th>
        <th>קישור/שם קובץ</th>
        <th>תאריך</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${state.client.documents.map(d => `
        <tr>
          <td><input class="input" data-doc="${d.id}" data-k="name" value="${escapeAttr(d.name)}"/></td>
          <td>
            <select data-doc="${d.id}" data-k="type">
              ${["ת״ז","שאלון/הצהרה","מסמך רפואי","אישור בנק","אחר"].map(x => `<option ${d.type===x?"selected":""}>${x}</option>`).join("")}
            </select>
          </td>
          <td><input class="input" data-doc="${d.id}" data-k="ref" placeholder="URL או שם קובץ" value="${escapeAttr(d.ref)}"/></td>
          <td><input class="input" type="date" data-doc="${d.id}" data-k="date" value="${escapeAttr(d.date)}"/></td>
          <td><button class="btn btnGhost" type="button" data-doc-del="${d.id}">מחיקה</button></td>
        </tr>
      `).join("")}
      ${state.client.documents.length === 0 ? `
        <tr><td colspan="5" class="muted">אין מסמכים עדיין. לחץ “הוסף מסמך”.</td></tr>
      ` : ""}
    </tbody>
  `;
  wrap.appendChild(table);

  setTimeout(() => {
    wrap.querySelectorAll("[data-doc][data-k]").forEach(el => {
      el.addEventListener("input", (e) => {
        const id = e.target.dataset.doc;
        const k = e.target.dataset.k;
        const row = state.client.documents.find(x => x.id === id);
        if (!row) return;
        row[k] = e.target.value;
      });
      el.addEventListener("change", (e) => {
        const id = e.target.dataset.doc;
        const k = e.target.dataset.k;
        const row = state.client.documents.find(x => x.id === id);
        if (!row) return;
        row[k] = e.target.value;
      });
    });

    wrap.querySelectorAll("[data-doc-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.docDel;
        state.client.documents = state.client.documents.filter(x => x.id !== id);
        render();
      });
    });
  });

  return wrap;
}

function renderStepExisting(){
  const wrap = document.createElement("div");
  wrap.className = "grid cols2";

  const left = document.createElement("div");
  left.className = "card";
  left.appendChild(sectionHeader("הוספת ביטוח קיים", "הכנס ביטוחים מהעבר לפי חברות/פוליסות", []));

  left.appendChild(existingForm());

  const right = document.createElement("div");
  right.className = "card";
  right.appendChild(sectionHeader("רשימת ביטוחים קיימים", "אפשר לערוך/למחוק", []));

  right.appendChild(existingTable());
  wrap.appendChild(left);
  wrap.appendChild(right);

  return wrap;
}

function existingForm(){
  const el = document.createElement("div");
  el.className = "grid cols2";

  const draft = {
    company: "",
    policyType: "",
    premiumMonthly: "",
    premiumTotal: "",
    status: "פעיל",
    notes: ""
  };

  el.innerHTML = `
    <div class="field">
      <label>חברת ביטוח</label>
      <input class="input" id="ex_company" placeholder="מגדל / הראל / כלל..." />
    </div>
    <div class="field">
      <label>סוג פוליסה</label>
      <input class="input" id="ex_type" placeholder="בריאות / חיים / פנסיה..." />
    </div>
    <div class="field">
      <label>פרמיה חודשית</label>
      <input class="input" id="ex_pm" type="number" min="0" placeholder="₪" />
    </div>
    <div class="field">
      <label>סה״כ ששולם (אופציונלי)</label>
      <input class="input" id="ex_pt" type="number" min="0" placeholder="₪" />
    </div>
    <div class="field">
      <label>סטטוס</label>
      <select id="ex_status">
        <option>פעיל</option>
        <option>מבוטל</option>
        <option>מוקפא</option>
      </select>
    </div>
    <div class="field">
      <label>הערות</label>
      <input class="input" id="ex_notes" placeholder="למשל: סיום בעוד 3 חודשים..." />
    </div>
    <div class="rowActions" style="grid-column:1/-1; justify-content:flex-start;">
      <button class="btn btnPrimary" id="ex_add" type="button">הוסף ביטוח</button>
      <span class="muted">טיפ: תוסיף את כולם ואז נתקדם לפוליסה החדשה</span>
    </div>
  `;

  setTimeout(() => {
    $("#ex_add").addEventListener("click", () => {
      draft.company = $("#ex_company").value.trim();
      draft.policyType = $("#ex_type").value.trim();
      draft.premiumMonthly = $("#ex_pm").value;
      draft.premiumTotal = $("#ex_pt").value;
      draft.status = $("#ex_status").value;
      draft.notes = $("#ex_notes").value.trim();

      if (!draft.company || !draft.policyType){
        toast("חסר: חברת ביטוח + סוג פוליסה");
        return;
      }

      state.existingPolicies.push({ id: uid("ex"), ...draft });
      $("#ex_company").value = "";
      $("#ex_type").value = "";
      $("#ex_pm").value = "";
      $("#ex_pt").value = "";
      $("#ex_status").value = "פעיל";
      $("#ex_notes").value = "";
      toast("נוסף ביטוח קיים");
      render();
    });
  });

  return el;
}

function existingTable(){
  const box = document.createElement("div");

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>חברה</th>
        <th>סוג</th>
        <th>חודשי</th>
        <th>סה״כ</th>
        <th>סטטוס</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${state.existingPolicies.map(p => `
        <tr>
          <td><input class="input" data-ex="${p.id}" data-k="company" value="${escapeAttr(p.company)}"/></td>
          <td><input class="input" data-ex="${p.id}" data-k="policyType" value="${escapeAttr(p.policyType)}"/></td>
          <td><input class="input" data-ex="${p.id}" data-k="premiumMonthly" type="number" min="0" value="${escapeAttr(p.premiumMonthly)}"/></td>
          <td><input class="input" data-ex="${p.id}" data-k="premiumTotal" type="number" min="0" value="${escapeAttr(p.premiumTotal)}"/></td>
          <td>
            <select data-ex="${p.id}" data-k="status">
              ${["פעיל","מבוטל","מוקפא"].map(x => `<option ${p.status===x?"selected":""}>${x}</option>`).join("")}
            </select>
          </td>
          <td><button class="btn btnGhost" type="button" data-ex-del="${p.id}">מחיקה</button></td>
        </tr>
      `).join("")}
      ${state.existingPolicies.length === 0 ? `
        <tr><td colspan="6" class="muted">אין ביטוחים קיימים עדיין.</td></tr>
      ` : ""}
    </tbody>
  `;
  box.appendChild(table);

  setTimeout(() => {
    box.querySelectorAll("[data-ex][data-k]").forEach(el => {
      const handler = (e) => {
        const id = e.target.dataset.ex;
        const k = e.target.dataset.k;
        const row = state.existingPolicies.find(x => x.id === id);
        if (!row) return;
        row[k] = e.target.value;
        renderKPIsOnly();
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });

    box.querySelectorAll("[data-ex-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.exDel;
        state.existingPolicies = state.existingPolicies.filter(x => x.id !== id);
        render();
      });
    });
  });

  return box;
}

function renderStepNewPolicy(){
  const wrap = document.createElement("div");
  wrap.className = "grid cols2";

  const left = document.createElement("div");
  left.className = "card";
  left.appendChild(sectionHeader("פרטי פוליסה חדשה", "חברה/מוצר ותאריך התחלה", []));

  left.appendChild(newPolicyHeaderForm());

  const right = document.createElement("div");
  right.className = "card";
  right.appendChild(sectionHeader("כיסויים לפי מבוטח", "מוסיף כיסוי + סכום + פרמיה", []));

  right.appendChild(renderCoveragesByInsured());

  wrap.appendChild(left);
  wrap.appendChild(right);
  return wrap;
}

function newPolicyHeaderForm(){
  const el = document.createElement("div");
  el.className = "grid cols2";
  el.innerHTML = `
    <div class="field">
      <label>חברת ביטוח (חדשה)</label>
      <input class="input" id="np_company" placeholder="לדוגמה: הראל" value="${escapeAttr(state.newPolicy.company)}"/>
    </div>
    <div class="field">
      <label>מוצר / מסלול</label>
      <input class="input" id="np_product" placeholder="לדוגמה: בריאות פרימיום" value="${escapeAttr(state.newPolicy.product)}"/>
    </div>
    <div class="field">
      <label>תאריך התחלה</label>
      <input class="input" type="date" id="np_start" value="${escapeAttr(state.newPolicy.startDate)}"/>
    </div>
    <div class="field">
      <label>הערה</label>
      <input class="input" id="np_note" placeholder="אופציונלי (לא נשמר כרגע)" />
    </div>
  `;

  setTimeout(() => {
    $("#np_company").addEventListener("input", e => state.newPolicy.company = e.target.value);
    $("#np_product").addEventListener("input", e => state.newPolicy.product = e.target.value);
    $("#np_start").addEventListener("input", e => state.newPolicy.startDate = e.target.value);
  });

  return el;
}

function renderCoveragesByInsured(){
  const box = document.createElement("div");
  box.className = "grid";
  box.style.gap = "12px";

  state.client.insured.forEach(ins => {
    ensureContainersForInsured(ins.id);

    const card = document.createElement("div");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "sectionTitle";
    header.innerHTML = `
      <div>
        <h3>${escapeHtml(ins.label)} • ${escapeHtml(ins.firstName || "—")} ${escapeHtml(ins.lastName || "")}</h3>
        <div class="hint">כיסויים שנרכשו בפוליסה החדשה</div>
      </div>
      <div class="rowActions">
        <button class="btn btnGhost" type="button" data-addcov="${ins.id}">הוסף כיסוי</button>
      </div>
    `;
    card.appendChild(header);

    const rows = state.newPolicy.coveragesByInsured[ins.id];
    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>כיסוי</th>
          <th>סכום ביטוח</th>
          <th>פרמיה חודשית</th>
          <th>הערות</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>
              <select data-cov="${r.id}" data-k="coverage">
                ${TASK_COVERS.map(x => `<option ${r.coverage===x?"selected":""}>${x}</option>`).join("")}
              </select>
            </td>
            <td><input class="input" data-cov="${r.id}" data-k="sumInsured" type="number" min="0" value="${escapeAttr(r.sumInsured)}"/></td>
            <td><input class="input" data-cov="${r.id}" data-k="premiumMonthly" type="number" min="0" value="${escapeAttr(r.premiumMonthly)}"/></td>
            <td><input class="input" data-cov="${r.id}" data-k="notes" value="${escapeAttr(r.notes)}"/></td>
            <td><button class="btn btnGhost" type="button" data-cov-del="${r.id}" data-owner="${ins.id}">מחיקה</button></td>
          </tr>
        `).join("")}
        ${rows.length === 0 ? `<tr><td colspan="5" class="muted">אין כיסויים עדיין למבוטח זה.</td></tr>` : ""}
      </tbody>
    `;
    card.appendChild(table);

    box.appendChild(card);
  });

  setTimeout(() => {
    // add coverage
    $all("[data-addcov]").forEach(btn => {
      btn.addEventListener("click", () => {
        const insuredId = btn.dataset.addcov;
        const row = { id: uid("cov"), coverage: TASK_COVERS[0], sumInsured:"", premiumMonthly:"", notes:"" };
        state.newPolicy.coveragesByInsured[insuredId].push(row);
        render();
      });
    });

    // edit coverage
    $all("[data-cov][data-k]").forEach(el => {
      const handler = (e) => {
        const id = e.target.dataset.cov;
        const k = e.target.dataset.k;
        const { ownerRow } = findCoverageById(id);
        if (!ownerRow) return;
        ownerRow[k] = e.target.value;
        renderKPIsOnly();
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });

    // delete coverage
    $all("[data-cov-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const covId = btn.dataset.covDel;
        const owner = btn.dataset.owner;
        state.newPolicy.coveragesByInsured[owner] =
          state.newPolicy.coveragesByInsured[owner].filter(x => x.id !== covId);
        render();
      });
    });
  });

  return box;
}

function renderStepMedical(){
  const wrap = document.createElement("div");
  wrap.className = "grid cols2";

  const left = document.createElement("div");
  left.className = "card";
  left.appendChild(sectionHeader("בחר מבוטח לתשאול", "שאלון רפואי לפי מבוטח", []));

  left.appendChild(renderInsuredSelector());

  const right = document.createElement("div");
  right.className = "card";
  right.appendChild(sectionHeader("שאלון רפואי", "מלא תשובות + פירוט", []));

  right.appendChild(renderMedicalForm());

  wrap.appendChild(left);
  wrap.appendChild(right);
  return wrap;
}

let medicalActiveInsuredId = null;

function renderInsuredSelector(){
  const box = document.createElement("div");
  box.className = "grid";
  box.style.gap = "10px";

  if (!medicalActiveInsuredId){
    medicalActiveInsuredId = state.client.insured[0]?.id || null;
  }

  state.client.insured.forEach(ins => {
    const pill = document.createElement("div");
    pill.className = "pill" + (ins.id === medicalActiveInsuredId ? " active" : "");
    pill.innerHTML = `👤 ${escapeHtml(ins.label)} • ${escapeHtml(ins.firstName || "—")} ${escapeHtml(ins.lastName || "")}`;
    pill.addEventListener("click", () => {
      medicalActiveInsuredId = ins.id;
      render();
    });
    box.appendChild(pill);
  });

  box.appendChild(divHr());
  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.fontSize = "12px";
  hint.textContent = "טיפ: עבור כל מבוטח עונים בנפרד. הנתונים נשמרים לתוך ה-state.";
  box.appendChild(hint);

  return box;
}

function renderMedicalForm(){
  const insuredId = medicalActiveInsuredId;
  if (!insuredId){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "אין מבוטחים.";
    return empty;
  }

  ensureContainersForInsured(insuredId);

  const answers = state.medical.answersByInsured[insuredId];
  const box = document.createElement("div");
  box.className = "grid";
  box.style.gap = "12px";

  MED_QUESTIONS.forEach(q => {
    const a = answers[q.id] || { answer:"לא", details:"" };
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="sectionTitle">
        <h3>${escapeHtml(q.text)}</h3>
        <div class="rowActions">
          <span class="badge ${a.answer==="כן" ? "badgeWarn" : "badgeOk"}">${escapeHtml(a.answer)}</span>
        </div>
      </div>
      <div class="grid cols2">
        <div class="field">
          <label>תשובה</label>
          <select data-medq="${q.id}" data-medk="answer">
            <option ${a.answer==="לא"?"selected":""}>לא</option>
            <option ${a.answer==="כן"?"selected":""}>כן</option>
          </select>
        </div>
        <div class="field">
          <label>פירוט (אם כן)</label>
          <input class="input" data-medq="${q.id}" data-medk="details" placeholder="תיאור קצר..." value="${escapeAttr(a.details)}" />
        </div>
      </div>
    `;

    box.appendChild(card);
  });

  setTimeout(() => {
    box.querySelectorAll("[data-medq][data-medk]").forEach(el => {
      const handler = (e) => {
        const qid = e.target.dataset.medq;
        const k = e.target.dataset.medk;
        const answers = state.medical.answersByInsured[insuredId];
        answers[qid] = answers[qid] || { answer:"לא", details:"" };
        answers[qid][k] = e.target.value;
        render();
      };
      el.addEventListener("change", handler);
      el.addEventListener("input", handler);
    });
  });

  return box;
}

function renderStepPayment(){
  const wrap = document.createElement("div");
  wrap.className = "grid cols2";

  const left = document.createElement("div");
  left.className = "card";
  left.appendChild(sectionHeader("אמצעי תשלום", "איסוף תשלום בצורה מסודרת", []));

  const form = document.createElement("div");
  form.className = "grid cols2";
  form.innerHTML = `
    <div class="field">
      <label>שיטת תשלום</label>
      <select id="pay_method">
        <option value="credit" ${state.payment.method==="credit"?"selected":""}>אשראי</option>
        <option value="bank" ${state.payment.method==="bank"?"selected":""}>הוראת קבע</option>
        <option value="transfer" ${state.payment.method==="transfer"?"selected":""}>העברה בנקאית</option>
      </select>
    </div>
    <div class="field">
      <label>מס׳ תשלומים</label>
      <select id="pay_inst">
        ${["1","2","3","6","12"].map(x => `<option ${state.payment.installments===x?"selected":""}>${x}</option>`).join("")}
      </select>
    </div>

    <div class="field">
      <label>שם משלם</label>
      <input class="input" id="pay_name" value="${escapeAttr(state.payment.payerName)}" />
    </div>
    <div class="field">
      <label>ת״ז משלם</label>
      <input class="input" id="pay_id" value="${escapeAttr(state.payment.payerId)}" />
    </div>

    <div class="field">
      <label>אשראי – 4 ספרות אחרונות (דמו)</label>
      <input class="input" id="pay_last4" maxlength="4" value="${escapeAttr(state.payment.cardLast4)}" />
    </div>
    <div class="field">
      <label>תאריך חיוב ראשון</label>
      <input class="input" type="date" id="pay_date" value="${escapeAttr(state.payment.billingDate)}" />
    </div>

    <div class="field" style="grid-column:1/-1">
      <label>אישור</label>
      <div class="card" style="display:flex;gap:10px;align-items:center;">
        <input id="pay_consent" type="checkbox" ${state.payment.consent ? "checked":""} />
        <div>
          <div style="font-weight:900">אני מאשר/ת חיוב בהתאם לפרטים שנמסרו</div>
          <div class="muted" style="font-size:12px">בלי סימון אישור – לא ניתן להתקדם ל־Save & Submit.</div>
        </div>
      </div>
    </div>
  `;

  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "card";
  right.appendChild(sectionHeader("סיכום חיוב מהיר", "מחשב מהנתונים שהוזנו", []));

  const summary = document.createElement("div");
  summary.className = "grid cols2";
  const newMonthly = calcNewMonthly();
  const oldMonthly = state.existingPolicies.reduce((s,p)=> s + Number(p.premiumMonthly||0), 0);
  summary.innerHTML = `
    <div class="kpi">
      <div class="k">פרמיה חודשית חדשה</div>
      <div class="v">${escapeHtml(currency(newMonthly))}</div>
      <div class="s">מבוסס על הכיסויים שהכנסת</div>
    </div>
    <div class="kpi">
      <div class="k">פרמיה חודשית קיימת</div>
      <div class="v">${escapeHtml(currency(oldMonthly))}</div>
      <div class="s">סך ביטוחים קיימים</div>
    </div>
    <div class="kpi" style="grid-column:1/-1">
      <div class="k">פער חודשי</div>
      <div class="v">${escapeHtml(currency(newMonthly - oldMonthly))}</div>
      <div class="s">להשוואה מול מצב קודם</div>
    </div>
  `;
  right.appendChild(summary);

  setTimeout(() => {
    $("#pay_method").addEventListener("change", e => { state.payment.method = e.target.value; render(); });
    $("#pay_inst").addEventListener("change", e => state.payment.installments = e.target.value);
    $("#pay_name").addEventListener("input", e => state.payment.payerName = e.target.value);
    $("#pay_id").addEventListener("input", e => state.payment.payerId = e.target.value);
    $("#pay_last4").addEventListener("input", e => state.payment.cardLast4 = e.target.value);
    $("#pay_date").addEventListener("input", e => state.payment.billingDate = e.target.value);
    $("#pay_consent").addEventListener("change", e => state.payment.consent = e.target.checked);
  });

  wrap.appendChild(left);
  wrap.appendChild(right);
  return wrap;
}

function renderStepSummary(){
  const wrap = document.createElement("div");
  wrap.className = "grid cols2";

  const left = document.createElement("div");
  left.className = "card";
  left.appendChild(sectionHeader("סיכום עסקה", "תצוגה מסודרת לפני שמירה לשרת", []));

  const primary = state.client.insured.find(x => x.role === "primary");
  const title = document.createElement("div");
  title.className = "card";
  title.innerHTML = `
    <div class="sectionTitle">
      <h3>לקוח: ${escapeHtml(primary?.firstName || "—")} ${escapeHtml(primary?.lastName || "")}</h3>
      <div class="rowActions">
        <span class="badge badgeOk">READY</span>
        <span class="badge">${escapeHtml(state.newPolicy.company || "חברה חדשה לא נבחרה")}</span>
      </div>
    </div>
    <div class="muted" style="font-size:12px">
      נציג סוגר: ${escapeHtml(state.client.dealOwner || "—")} • מקור: ${escapeHtml(state.client.leadSource || "—")}
    </div>
  `;
  left.appendChild(title);

  left.appendChild(divHr());
  left.appendChild(summaryInsuredList());
  left.appendChild(divHr());
  left.appendChild(summaryCoverages());

  const right = document.createElement("div");
  right.className = "card";
  right.appendChild(sectionHeader("תצוגת JSON (דמו)", "ככה זה יישלח לשיטס/שרת", []));

  const pre = document.createElement("pre");
  pre.style.margin = "0";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.color = "rgba(234,244,255,.88)";
  pre.textContent = JSON.stringify(state, null, 2);
  right.appendChild(pre);

  wrap.appendChild(left);
  wrap.appendChild(right);
  return wrap;
}

function summaryInsuredList(){
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="sectionTitle"><h3>מבוטחים</h3><div class="hint">פרטי בסיס</div></div>`;

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>סוג</th>
        <th>שם</th>
        <th>ת״ז</th>
        <th>טלפון</th>
        <th>אימייל</th>
      </tr>
    </thead>
    <tbody>
      ${state.client.insured.map(i => `
        <tr>
          <td>${escapeHtml(i.label)}</td>
          <td>${escapeHtml((i.firstName||"") + " " + (i.lastName||""))}</td>
          <td>${escapeHtml(i.idNumber||"")}</td>
          <td>${escapeHtml(i.phone||"")}</td>
          <td>${escapeHtml(i.email||"")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  box.appendChild(table);
  return box;
}

function summaryCoverages(){
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="sectionTitle"><h3>כיסויים שנרכשו</h3><div class="hint">לפי מבוטח</div></div>`;

  const rows = [];
  state.client.insured.forEach(ins => {
    const covs = state.newPolicy.coveragesByInsured[ins.id] || [];
    covs.forEach(c => {
      rows.push({
        insured: `${ins.label} • ${ins.firstName||"—"} ${ins.lastName||""}`,
        coverage: c.coverage,
        sumInsured: c.sumInsured,
        premiumMonthly: c.premiumMonthly
      });
    });
  });

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>מבוטח</th>
        <th>כיסוי</th>
        <th>סכום</th>
        <th>פרמיה חודשית</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(r.insured)}</td>
          <td>${escapeHtml(r.coverage)}</td>
          <td>${escapeHtml(r.sumInsured || "")}</td>
          <td>${escapeHtml(currency(r.premiumMonthly || 0))}</td>
        </tr>
      `).join("")}
      ${rows.length===0 ? `<tr><td colspan="4" class="muted">אין כיסויים עדיין.</td></tr>` : ""}
    </tbody>
  `;
  box.appendChild(table);
  return box;
}

/* ---------- insured add/remove ---------- */

function addSpouse(){
  const exists = state.client.insured.some(x => x.role === "spouse");
  if (exists){ toast("בן/בת זוג כבר קיים"); return; }
  state.client.insured.push(mkInsured("spouse", "בן/בת זוג"));
  toast("נוסף בן/בת זוג");
  render();
}
function addChild(){
  const count = state.client.insured.filter(x => x.role === "child").length + 1;
  state.client.insured.push(mkInsured("child", `ילד/ה ${count}`));
  toast("נוסף ילד/ה");
  render();
}
function removeInsured(id){
  state.client.insured = state.client.insured.filter(x => x.id !== id);
  delete state.newPolicy.coveragesByInsured[id];
  delete state.medical.answersByInsured[id];
  if (medicalActiveInsuredId === id){
    medicalActiveInsuredId = state.client.insured[0]?.id || null;
  }
  toast("הוסר מבוטח");
  render();
}

/* ---------- docs ---------- */

function addDocumentRow(){
  state.client.documents.push({
    id: uid("doc"),
    name: "",
    type: "ת״ז",
    ref: "",
    date: ""
  });
  render();
}

/* ---------- coverage helpers ---------- */

function ensureContainersForInsured(insuredId){
  if (!state.newPolicy.coveragesByInsured[insuredId]) state.newPolicy.coveragesByInsured[insuredId] = [];
  if (!state.medical.answersByInsured[insuredId]) {
    state.medical.answersByInsured[insuredId] = {};
    MED_QUESTIONS.forEach(q => state.medical.answersByInsured[insuredId][q.id] = { answer:"לא", details:"" });
  }
}

function findCoverageById(covId){
  for (const insuredId of Object.keys(state.newPolicy.coveragesByInsured)){
    const arr = state.newPolicy.coveragesByInsured[insuredId];
    const ownerRow = arr.find(x => x.id === covId);
    if (ownerRow) return { insuredId, ownerRow };
  }
  return { insuredId:null, ownerRow:null };
}

function calcNewMonthly(){
  let sum = 0;
  Object.values(state.newPolicy.coveragesByInsured).forEach(arr => {
    arr.forEach(c => sum += Number(c.premiumMonthly || 0));
  });
  return sum;
}

/* ---------- UI small helpers ---------- */

function sectionHeader(title, hint, actions){
  const wrap = document.createElement("div");
  wrap.className = "sectionTitle";
  const actionsHtml = (actions || []).map((a, i) =>
    `<button class="btn btnGhost" type="button" data-act="${i}">${escapeHtml(a.text)}</button>`
  ).join("");

  wrap.innerHTML = `
    <div>
      <h3>${escapeHtml(title)}</h3>
      <div class="hint">${escapeHtml(hint || "")}</div>
    </div>
    <div class="rowActions">${actionsHtml}</div>
  `;

  setTimeout(() => {
    (actions || []).forEach((a, i) => {
      const btn = wrap.querySelector(`[data-act="${i}"]`);
      if (btn) btn.addEventListener("click", a.onClick);
    });
  });

  return wrap;
}

function divHr(){
  const hr = document.createElement("div");
  hr.className = "hr";
  return hr;
}

function renderKPIsOnly(){
  // update KPI blocks quickly by rerendering full view (simple & safe)
  // אם תרצה אופטימיזציה — נפריד לשכבה, אבל כרגע זה “נקי”.
  render();
}

/* ---------- escaping ---------- */

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll("\n"," "); }
