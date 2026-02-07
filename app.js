(() => {
  const $ = (id) => document.getElementById(id);

  const app = $("app");
  const stepper = $("stepper");
  const caseHeader = $("caseHeader");
  const stageBadge = $("stageBadge");
  const panelTitle = $("panelTitle");
  const panelHint  = $("panelHint");
  const panelActions = $("panelActions");

  const caseTitle = $("caseTitle");
  const caseIdChip = $("caseIdChip");
  const caseStatusChip = $("caseStatusChip");

  const badgeStage = $("badgeStage");
  const badgeProducts = $("badgeProducts");
  const badgeTotal = $("badgeTotal");
  const badgeSecondary = $("badgeSecondary");
  const badgeChildren = $("badgeChildren");
  const missingList = $("missingList");

  const btnSaveDraft = $("btnSaveDraft");
  const btnLoadDraft = $("btnLoadDraft");
  const btnGoFinish  = $("btnGoFinish");

  const COMPANIES = ["מנורה","כלל","הפניקס","מגדל","הראל","הכשרה","מדיקר"];
  const PAYMENT_METHODS = ["","אשראי","הוראת קבע","העברה בנקאית","אחר"];

  // Default questionnaires (placeholder - ready to map per company|product)
  const QUESTION_SET_DEFAULT = [
    { id:"q_bg",   title:"מחלות רקע", desc:"האם קיימות מחלות רקע?", follow:"פרט מחלות רקע / תאריך אבחנה / טיפול" },
    { id:"q_hosp", title:"אשפוזים", desc:"האם בוצעו אשפוזים בשנים האחרונות?", follow:"פרט אשפוזים / תאריכים / סיבה" },
    { id:"q_meds", title:"תרופות קבועות", desc:"האם נוטל תרופות קבועות?", follow:"פרט שמות תרופות + מינון" },
    { id:"q_fam",  title:"היסטוריה משפחתית", desc:"האם קיימת היסטוריה רפואית משפחתית?", follow:"פרט היסטוריה רפואית משפחתית" },
  ];

  const blankPerson = () => ({
    firstName:"", lastName:"", idNumber:"", birthDate:"",
    age:"", gender:"", smoker:"",
    phone:"", email:"",
    address:"", city:"",
    heightCm:"", weightKg:""
  });

  const blankPayment = () => ({
    method:"",
    payerName:"",
    payerId:"",
    cardLast4:"",
    notes:""
  });

    const STORAGE_MODE_KEY = "GICRM_STORAGE_MODE"; // "local" | "server"
  const SERVER_URL_KEY   = "GICRM_SERVER_URL";   // future Apps Script Web App URL

  function getStorageMode(){
    const v = localStorage.getItem(STORAGE_MODE_KEY);
    return (v === "server") ? "server" : "local";
  }
  function getServerUrl(){
    return String(localStorage.getItem(SERVER_URL_KEY) || "").trim();
  }
const state = {
    case: freshCase(),
    view: "case",
    settings: {
      storageMode: getStorageMode(),
      serverUrl: getServerUrl()
    },
    savedQuery: ""
  };

  function freshCase(){
    return {
      caseId: `CASE-${Date.now()}`,
      createdAtISO: new Date().toISOString(),
      step: "details",

      client: blankPerson(),
      hasSecondary: false,
      secondary: blankPerson(),
      children: [], // {id, ...person}

      cancellations: {
        primary: [],
        secondary: [],
        children: {} // childId -> []
      },

      products: [], // {id, company, productName, premiumBefore, premiumAfter}
      medical: {},  // medical[productId][questionId] = "כן"/"לא"/text

      payment: blankPayment(),
      status: "טיוטה"
    };
  }

  function toast(msg){
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function num(v){
    const n = Number(String(v ?? "").replace(/[^\d.]/g,""));
    return Number.isFinite(n) ? n : 0;
  }

  function premiumTotal(){
    return state.case.products.reduce((acc,p)=>acc + num(p.premiumAfter), 0);
  }

  function missingCritical(){
    const miss = [];
    const c = state.case.client;

    if (!c.firstName || !c.lastName) miss.push("חסר שם מלא (מבוטח ראשי)");
    if (!c.idNumber) miss.push("חסרה ת״ז (מבוטח ראשי)");
    if (!c.phone) miss.push("חסר טלפון (מבוטח ראשי)");

    if (state.case.products.length === 0) miss.push("לא נוספו מוצרים");
    state.case.products.forEach((p,i)=>{
      const label = `מוצר ${i+1}`;
      if (!p.company) miss.push(`${label}: חסרה חברה`);
      if (!p.productName) miss.push(`${label}: חסר שם מוצר`);
      if (!p.insuredFor) miss.push(`${label}: חסר מי המבוטח`);
      if (p.insuredFor === "secondary" && !state.case.hasSecondary) miss.push(`${label}: הוגדר מבוטח משני אבל אין מבוטח משני בתיק`);
      if (!p.premiumBefore) miss.push(`${label}: חסרה פרמיה לפני`);
      if (!p.premiumAfter) miss.push(`${label}: חסרה פרמיה אחרי`);
    });

    if (state.case.step === "summary" || state.case.step === "payment"){
      const pay = state.case.payment;
      if (!pay.method) miss.push("חסר אמצעי תשלום");
      if (!pay.payerName) miss.push("חסר שם משלם");
      if (!pay.payerId) miss.push("חסרה ת״ז משלם");
    }

    return miss;
  }

  function updateSide(){
    const stepName = stepLabel(state.case.step);
    stageBadge.textContent = stepName;
    badgeStage.textContent = stepName;

    badgeProducts.textContent = String(state.case.products.length);
    badgeTotal.textContent = String(premiumTotal());
    badgeSecondary.textContent = state.case.hasSecondary ? "כן" : "לא";
    badgeChildren.textContent = String(state.case.children.length);

    caseIdChip.textContent = state.case.caseId;
    caseTitle.textContent = buildCaseTitle();
    caseStatusChip.textContent = state.case.status;

    missingList.innerHTML = "";
    const miss = missingCritical();
    if (miss.length === 0){
      missingList.innerHTML = `<div class="chip">הכל תקין ✅</div>`;
      state.case.status = "טיוטה (תקין)";
    } else {
      state.case.status = "טיוטה (חסרים)";
      miss.slice(0,6).forEach(m=>{
        const d = document.createElement("div");
        d.className = "missing";
        d.textContent = m;
        missingList.appendChild(d);
      });
      if (miss.length > 6){
        const more = document.createElement("div");
        more.className = "chip";
        more.textContent = `ועוד ${miss.length - 6}...`;
        missingList.appendChild(more);
      }
    }
    caseStatusChip.textContent = state.case.status;
  }

  function buildCaseTitle(){
    const c = state.case.client;
    const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
    return name ? `תיק: ${name}` : "תיק חדש";
  }

  function stepLabel(step){
    return ({
      details:"פרטים",
      cancellations:"ביטול פוליסות",
      products:"מוצרים",
      questionnaires:"שאלונים",
      payment:"תשלום",
      summary:"סיום"
    })[step] || "פרטים";
  }

  function setStep(step){
    state.case.step = step;
    stepper.querySelectorAll(".step").forEach(b=>{
      b.classList.toggle("active", b.dataset.step === step);
    });
    render();
  }

  function setView(view){
    state.view = view;
    // nav active styles
    document.querySelectorAll(".navItem").forEach(x=>x.classList.toggle("active", x.dataset.nav === view));
    // show/hide case header stepper
    if (view === "case"){
      caseHeader?.classList.remove("hidden");
      stepper?.classList.remove("hidden");
      // keep title driven by case
    } else {
      // keep header visible but hide stepper for non-case pages
      caseHeader?.classList.remove("hidden");
      stepper?.classList.add("hidden");
    }
    render();
  }


  function getInsuredOptions(){
    const opts = [ {value:"", label:"בחר..."} , {value:"primary", label:"מבוטח ראשי"} ];
    if (state.case.hasSecondary) opts.push({value:"secondary", label:"מבוטח משני"});
    (state.case.children||[]).forEach((ch, i)=>{
      const name = `${(ch.firstName||"") } ${(ch.lastName||"")}`.trim();
      const label = name ? `ילד ${i+1}: ${name}` : `ילד ${i+1}`;
      opts.push({ value:`child:${ch.id}`, label });
    });
    return opts;
  }

  function insuredLabelFromCode(code){
    if (code === "secondary") return "מבוטח משני";
    if (String(code||"").startsWith("child:")){
      const id = String(code).split(":")[1];
      const idx = (state.case.children||[]).findIndex(c=>c.id===id);
      const ch = (state.case.children||[]).find(c=>c.id===id);
      const name = ch ? `${(ch.firstName||"") } ${(ch.lastName||"")}`.trim() : "";
      if (idx >= 0) return name ? `ילד ${idx+1}: ${name}` : `ילד ${idx+1}`;
      return name ? `ילד: ${name}` : "ילד";
    }
    return "מבוטח ראשי";
  }



  function getInsuredEntities(){
    const entities = [];
    entities.push({ key:"primary", label:"מבוטח ראשי" });
    if (state.case.hasSecondary) entities.push({ key:"secondary", label:"מבוטח משני" });
    (state.case.children||[]).forEach((ch, i)=>{
      const name = `${(ch.firstName||"") } ${(ch.lastName||"")}`.trim();
      const label = name ? `ילד ${i+1}: ${name}` : `ילד ${i+1}`;
      entities.push({ key:`child:${ch.id}`, label });
    });
    return entities;
  }

  function getCancellationsForKey(key){
    const c = state.case.cancellations || {primary:[],secondary:[],children:{}};
    if (key === "primary") return c.primary || [];
    if (key === "secondary") return c.secondary || [];
    if (String(key).startsWith("child:")){
      const id = String(key).split(":")[1];
      return (c.children && c.children[id]) ? c.children[id] : [];
    }
    return [];
  }

  function getProductsForKey(key){
    return (state.case.products||[]).filter(p => (p.insuredFor||"primary") === key);
  }

  function sumCancelPremium(list){
    return (list||[]).reduce((acc, x)=> acc + num(x.premiumPaid), 0);
  }

  function sumProductAfter(list){
    return (list||[]).reduce((acc, x)=> acc + num(x.premiumAfter), 0);
  }

  function renderInsuredComparisonSummary(){
    const entities = getInsuredEntities();
    const cards = entities.map(ent=>{
      const cancels = getCancellationsForKey(ent.key);
      const prods = getProductsForKey(ent.key);

      const cancelTotal = sumCancelPremium(cancels);
      const prodTotal = sumProductAfter(prods);
      const delta = cancelTotal - prodTotal; // positive = savings
      const deltaLabel = delta >= 0 ? `חיסכון` : `פער`;
      const deltaAbs = Math.abs(delta);

      const cancelList = (cancels && cancels.length) ? cancels.map((p)=>`
        <div class="chip">${esc(p.company||"—")} • ${esc(p.product||"—")} • <span class="mono">${esc(String(num(p.premiumPaid)))}</span> ₪ • ${esc(p.cancelType||"מלא")}</div>
      `).join("") : `<div class="chip">אין ביטולים</div>`;

      const prodList = (prods && prods.length) ? prods.map((p)=>`
        <div class="chip">${esc(p.company||"—")} • ${esc(p.productName||"—")} • אחרי: <span class="mono">${esc(String(num(p.premiumAfter)))}</span> ₪</div>
      `).join("") : `<div class="chip">אין מוצרים חדשים</div>`;

      return `
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">${esc(ent.label)}</div>
              <div class="cardMeta">חיבור ביטולים ↔ מוצרים לפי מבוטח</div>
            </div>
            <span class="pill">${esc(deltaLabel)} חודשי: <span class="mono">${esc(String(deltaAbs))}</span> ₪</span>
          </div>

          <div class="formGrid" style="margin-top:12px">
            <div class="field">
              <div class="label">ביטולים (חברות נגדיות)</div>
              <div class="chips" style="margin-top:6px">${cancelList}</div>
              <div class="inlineNote">סה״כ ביטולים (פרמיה ששולמה): <span class="mono">${esc(String(cancelTotal))}</span> ₪</div>
            </div>

            <div class="field">
              <div class="label">מוצרים חדשים (אצלנו)</div>
              <div class="chips" style="margin-top:6px">${prodList}</div>
              <div class="inlineNote">סה״כ מוצרים חדשים (אחרי): <span class="mono">${esc(String(prodTotal))}</span> ₪</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return cards || `<div class="card"><div class="cardTitle">אין נתונים להצגה</div></div>`;
  }
  // ----- UI helpers -----
  // (duplicate insuredLabelFromCode removed)
  function field(label, path, value, type="text", placeholder=""){
    return `
      <div class="field">
        <div class="label">${esc(label)}</div>
        <input class="input" type="${esc(type)}" data-path="${esc(path)}" value="${esc(value)}" placeholder="${esc(placeholder)}"/>
      </div>
    `;
  }

  function textarea(label, path, value, placeholder=""){
    return `
      <div class="field">
        <div class="label">${esc(label)}</div>
        <textarea class="textarea" data-path="${esc(path)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
      </div>
    `;
  }

  function select(label, path, value, options){
    const opts = options.map(o=>{
      const obj = (o && typeof o === "object") ? o : { value: (o ?? ""), label: (o ?? "") };
      const v = obj.value ?? "";
      const txt = v === "" ? "בחר..." : (obj.label ?? v);
      const sel = (v === value) ? "selected" : "";
      return `<option value="${esc(v)}" ${sel}>${esc(txt)}</option>`;
    }).join("");
    return `
      <div class="field">
        <div class="label">${esc(label)}</div>
        <select class="select" data-path="${esc(path)}">${opts}</select>
      </div>
    `;
  }

  function bindPaths(root){
    root.querySelectorAll("[data-path]").forEach(node=>{
      const tag = node.tagName.toLowerCase();
      const ev = (tag === "select") ? "change" : "input";
      node.addEventListener(ev, ()=>{
        setByPath(node.dataset.path, node.value);
        updateSide();
      });
    });
  }

  function setByPath(path, value){
    const parts = path.split(".");
    let cur = state.case;
    for (let i=0;i<parts.length-1;i++){
      const key = parts[i];

      if (key === "children"){
        const idx = Number(parts[++i]);
        cur = cur.children[idx];
        continue;
      }
      if (key === "products"){
        const idx = Number(parts[++i]);
        cur = cur.products[idx];
        continue;
      }
      cur = cur[key];
    }
    cur[parts[parts.length-1]] = value;
  }

  // ----- Render steps -----
  function render(){
    // Router: Case vs Saved vs Settings
    if (state.view === "saved") { renderSaved(); return; }
    if (state.view === "settings") { renderSettings(); return; }

    // ensure case UI
    stepper.classList.remove("hidden");

    // panel meta + actions
    const meta = ({
      details: { title:"פרטים אישיים", hint:"מלא פרטים של המבוטח הראשי + אופציונלי משני/ילדים.", actions: renderDetailsActions },
      cancellations: { title:"ביטול פוליסות בחברות נגדיות", hint:"מלא פוליסות קיימות שתרצה לבטל/להקטין (מלא/חלקי) לכל מבוטח.", actions: renderCancellationsActions },
      products: { title:"מוצרים", hint:"הוסף מוצרים וחברות + פרמיה לפני/אחרי הנחה.", actions: renderProductsActions },
      questionnaires: { title:"שאלונים", hint:"שאלון רפואי לפי מוצר. כן/לא + פתיחת פירוט כשכן.", actions: renderQuestionnaireActions },
      payment: { title:"תשלום", hint:"אמצעי תשלום (לא שומרים פרטי כרטיס מלא).", actions: renderPaymentActions },
      summary: { title:"סיום", hint:"סיכום תיק + שמירה/הדפסה/ייצוא.", actions: renderSummaryActions },
    })[state.case.step];

    panelTitle.textContent = meta.title;
    panelHint.textContent = meta.hint;

    panelActions.innerHTML = "";
    meta.actions();

    // view
    if (state.case.step === "details") renderDetails();
    if (state.case.step === "cancellations") renderCancellations();
    if (state.case.step === "products") renderProducts();
    if (state.case.step === "questionnaires") renderQuestionnaires();
    if (state.case.step === "payment") renderPayment();
    if (state.case.step === "summary") renderSummary();

    updateSide();
  }

  function renderDetailsActions(){
    panelActions.innerHTML = `
      <button class="btn primary" id="btnNextToCancellations" type="button">המשך לביטול פוליסות</button>
    `;
    panelActions.querySelector("#btnNextToCancellations").addEventListener("click", ()=>{
      if (!state.case.client.firstName || !state.case.client.lastName || !state.case.client.idNumber){
        toast("חסר שם מלא/ת״ז במבוטח הראשי.");
        return;
      }
      setStep("cancellations");
    });
  }

  function renderDetails(){
    const c = state.case.client;

    app.innerHTML = `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">מבוטח ראשי</div>
            <div class="cardMeta">פרטים אישיים מלאים לתיק רפואי.</div>
          </div>
          <span class="chip mono">${esc(state.case.caseId)}</span>
        </div>

        <div class="formGrid" style="margin-top:12px">
          ${field("שם פרטי","client.firstName",c.firstName)}
          ${field("שם משפחה","client.lastName",c.lastName)}
          ${field("ת״ז","client.idNumber",c.idNumber)}
          ${field("תאריך לידה","client.birthDate",c.birthDate,"date")}
        </div>

        <div class="formGrid3" style="margin-top:12px">
          ${field("גיל","client.age",c.age,"number")}
          ${select("מין","client.gender",c.gender,["","זכר","נקבה"])}
          ${select("מעשן","client.smoker",c.smoker,["","כן","לא"])}
        </div>

        <div class="formGrid" style="margin-top:12px">
          ${field("טלפון","client.phone",c.phone,"text","05X-XXXXXXX")}
          ${field("מייל","client.email",c.email,"email")}
        </div>

        <div class="formGrid" style="margin-top:12px">
          ${field("כתובת","client.address",c.address)}
          ${field("עיר","client.city",c.city)}
        </div>

        <div class="formGrid3" style="margin-top:12px">
          ${field("גובה (ס״מ)","client.heightCm",c.heightCm,"number")}
          ${field("משקל (ק״ג)","client.weightKg",c.weightKg,"number")}
          <div class="field"><div class="label">סטטוס</div><div class="pill">טיוטה</div></div>
        </div>
      </div>

      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">מבוטח משני</div>
            <div class="cardMeta">אופציונלי. לחץ כדי להוסיף/להסתיר.</div>
          </div>
          <button class="smallBtn" id="toggleSecondary" type="button">${state.case.hasSecondary ? "הסר" : "הוסף"}</button>
        </div>
        <div id="secondaryBlock" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">ילדים</div>
            <div class="cardMeta">הוספה דינמית של ילדים לתיק.</div>
          </div>
          <button class="smallBtn" id="addChild" type="button">הוסף ילד</button>
        </div>

        <div id="childrenBlock" style="margin-top:12px"></div>
      </div>
    `;

    // Secondary
    const secBtn = app.querySelector("#toggleSecondary");
    secBtn.addEventListener("click", ()=>{
      state.case.hasSecondary = !state.case.hasSecondary;
      if (!state.case.hasSecondary){
        state.case.secondary = blankPerson();
        if (state.case.cancellations) state.case.cancellations.secondary = [];
        // אם מסירים מבוטח משני — מעבירים מוצרים שלו למבוטח הראשי
        (state.case.products||[]).forEach(p=>{
          if (p.insuredFor === "secondary") p.insuredFor = "primary";
        });
      }
      render();
    });

    const secBlock = app.querySelector("#secondaryBlock");
    if (!state.case.hasSecondary){
      secBlock.innerHTML = `<div class="chip">לא קיים מבוטח משני כרגע.</div>`;
    } else {
      const s = state.case.secondary;
      secBlock.innerHTML = `
        <div class="formGrid">
          ${field("שם פרטי","secondary.firstName",s.firstName)}
          ${field("שם משפחה","secondary.lastName",s.lastName)}
          ${field("ת״ז","secondary.idNumber",s.idNumber)}
          ${field("תאריך לידה","secondary.birthDate",s.birthDate,"date")}
        </div>
        <div class="formGrid3" style="margin-top:12px">
          ${field("גיל","secondary.age",s.age,"number")}
          ${select("מין","secondary.gender",s.gender,["","זכר","נקבה"])}
          ${select("מעשן","secondary.smoker",s.smoker,["","כן","לא"])}
        </div>
        <div class="formGrid" style="margin-top:12px">
          ${field("טלפון","secondary.phone",s.phone)}
          ${field("מייל","secondary.email",s.email,"email")}
        </div>
        <div class="formGrid" style="margin-top:12px">
          ${field("כתובת","secondary.address",s.address)}
          ${field("עיר","secondary.city",s.city)}
        </div>
        <div class="formGrid3" style="margin-top:12px">
          ${field("גובה (ס״מ)","secondary.heightCm",s.heightCm,"number")}
          ${field("משקל (ק״ג)","secondary.weightKg",s.weightKg,"number")}
          <div class="field"><div class="label">הערה</div><div class="chip">אופציונלי</div></div>
        </div>
      `;
    }

    // Children
    const childrenBlock = app.querySelector("#childrenBlock");
    const addChildBtn = app.querySelector("#addChild");
    addChildBtn.addEventListener("click", ()=>{
      state.case.children.push({ id: `CH-${Date.now()}-${Math.floor(Math.random()*1e6)}`, ...blankPerson() });
      toast("נוסף ילד ✅");
      render();
    });

    if (state.case.children.length === 0){
      childrenBlock.innerHTML = `<div class="chip">אין ילדים כרגע.</div>`;
    } else {
      childrenBlock.innerHTML = state.case.children.map((ch, idx)=>`
        <div class="card" style="margin-top:10px">
          <div class="cardTop">
            <div>
              <div class="cardTitle">ילד ${idx+1}</div>
              <div class="cardMeta">ID: <span class="mono">${esc(ch.id)}</span></div>
            </div>
            <button class="smallBtn" data-remove-child="${idx}" type="button">הסר</button>
          </div>
          <div class="formGrid" style="margin-top:12px">
            ${field("שם פרטי",`children.${idx}.firstName`,ch.firstName)}
            ${field("שם משפחה",`children.${idx}.lastName`,ch.lastName)}
            ${field("ת״ז",`children.${idx}.idNumber`,ch.idNumber)}
            ${field("תאריך לידה",`children.${idx}.birthDate`,ch.birthDate,"date")}
          </div>
          <div class="formGrid3" style="margin-top:12px">
            ${field("גיל",`children.${idx}.age`,ch.age,"number")}
            ${select("מין",`children.${idx}.gender`,ch.gender,["","זכר","נקבה"])}
            ${select("מעשן",`children.${idx}.smoker`,ch.smoker,["","כן","לא"])}
          </div>
          <div class="formGrid" style="margin-top:12px">
            ${field("טלפון",`children.${idx}.phone`,ch.phone)}
            ${field("מייל",`children.${idx}.email`,ch.email,"email")}
          </div>
          <div class="formGrid" style="margin-top:12px">
            ${field("כתובת",`children.${idx}.address`,ch.address)}
            ${field("עיר",`children.${idx}.city`,ch.city)}
          </div>
          <div class="formGrid3" style="margin-top:12px">
            ${field("גובה (ס״מ)",`children.${idx}.heightCm`,ch.heightCm,"number")}
            ${field("משקל (ק״ג)",`children.${idx}.weightKg`,ch.weightKg,"number")}
            <div class="field"><div class="label">סטטוס</div><div class="chip">ילד</div></div>
          </div>
        </div>
      `).join("");

      childrenBlock.querySelectorAll("[data-remove-child]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const idx = Number(btn.dataset.removeChild);
          if (!confirm("להסיר את הילד מהתיק?")) return;
          const removed = state.case.children[idx];
          state.case.children.splice(idx, 1);
          if (removed && removed.id && state.case.cancellations && state.case.cancellations.children) delete state.case.cancellations.children[removed.id];
          // reassign products that were linked to this child
          (state.case.products||[]).forEach(p=>{ if ((p.insuredFor||"") === `child:${removed.id}`) p.insuredFor = "primary"; });
          render();
        });
      });
    }

    bindPaths(app);
  }

  

  // =========================
  // Cancellations (Competitor Policies)
  // =========================
  function ensureCancellationState(){
    if (!state.case.cancellations){
      state.case.cancellations = { primary: [], secondary: [], children: {} };
    }
    if (!state.case.cancellations.primary) state.case.cancellations.primary = [];
    if (!state.case.cancellations.secondary) state.case.cancellations.secondary = [];
    if (!state.case.cancellations.children) state.case.cancellations.children = {};
  }

  function newCancelPolicy(){
    return { company:"", product:"", premiumPaid:"", cancelType:"מלא" };
  }

  function renderCancellationsActions(){
    panelActions.innerHTML = `
      <button class="btn ghost" id="btnBackToDetails" type="button">חזרה לפרטים</button>
      <button class="btn primary" id="btnNextToProductsFromCancel" type="button">המשך למוצרים</button>
    `;

    panelActions.querySelector("#btnBackToDetails").addEventListener("click", ()=> setStep("details"));

    panelActions.querySelector("#btnNextToProductsFromCancel").addEventListener("click", ()=>{
      const issues = validateCancellationRows();
      if (issues.length){
        toast(issues[0]);
        return;
      }
      setStep("products");
    });
  }

  function validateCancellationRows(){
    ensureCancellationState();
    const issues = [];
    const checkList = (arr, labelPrefix)=>{
      (arr||[]).forEach((p, i)=>{
        const hasAny = (p.company || p.product || p.premiumPaid);
        if (!hasAny) return;
        if (!p.company) issues.push(`${labelPrefix} פוליסה ${i+1}: חסרה חברה`);
        if (!p.product) issues.push(`${labelPrefix} פוליסה ${i+1}: חסר מוצר ביטוח`);
        if (!p.premiumPaid) issues.push(`${labelPrefix} פוליסה ${i+1}: חסרה פרמיה ששולמה`);
        if (!p.cancelType) issues.push(`${labelPrefix} פוליסה ${i+1}: חסר סוג ביטול`);
      });
    };

    checkList(state.case.cancellations.primary, "מבוטח ראשי");
    if (state.case.hasSecondary) checkList(state.case.cancellations.secondary, "מבוטח משני");
    (state.case.children||[]).forEach((ch)=>{
      const arr = state.case.cancellations.children[ch.id] || [];
      checkList(arr, `ילד (${(ch.firstName||"") || "ללא שם"})`);
    });

    return issues;
  }

  function renderCancelSection({ title, subtitle, getList, sectionKey }){
    const list = getList();

    const rows = (list.length ? list : []).map((p, idx)=>`
      <div class="cancelRow" data-cancel-section="${esc(sectionKey)}" data-cancel-idx="${idx}">
        <div class="formGrid4">
          ${select("חברה", `__cancel.${sectionKey}.${idx}.company`, p.company, ["", ...COMPANIES, "אחר"])}
          ${field("מוצר ביטוח", `__cancel.${sectionKey}.${idx}.product`, p.product)}
          ${field("פרמיה ששילם", `__cancel.${sectionKey}.${idx}.premiumPaid`, p.premiumPaid, "number")}
          ${select("ביטול", `__cancel.${sectionKey}.${idx}.cancelType`, p.cancelType, ["מלא","חלקי"])}
        </div>
        <div class="rowActions">
          <button class="smallBtn danger" type="button" data-cancel-remove="${esc(sectionKey)}:${idx}">הסר</button>
        </div>
      </div>
    `).join("");

    return `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">${esc(title)}</div>
            <div class="cardMeta">${esc(subtitle || "")}</div>
          </div>
          <button class="smallBtn" type="button" data-cancel-add="${esc(sectionKey)}">הוסף פוליסה</button>
        </div>

        <div class="cancelList" style="margin-top:12px">
          ${rows || `<div class="chip">אין פוליסות לביטול עדיין.</div>`}
        </div>
      </div>
    `;
  }

  function renderCancellations(){
    ensureCancellationState();

    (state.case.children||[]).forEach(ch=>{
      if (!state.case.cancellations.children[ch.id]) state.case.cancellations.children[ch.id] = [];
    });

    app.innerHTML = `
      <div class="notice">
        <div class="noticeTitle">ביטול פוליסות בחברות נגדיות</div>
        <div class="noticeText">כאן ממלאים פוליסות קיימות שתרצה לבטל או להקטין. לכל פוליסה בחר חברה, מוצר, פרמיה ששולמה וסוג ביטול (מלא/חלקי).</div>
      </div>

      ${renderCancelSection({
        title: "מבוטח ראשי",
        subtitle: "פוליסות קיימות של המבוטח הראשי בחברה אחרת",
        sectionKey: "primary",
        getList: ()=> state.case.cancellations.primary
      })}

      ${state.case.hasSecondary ? renderCancelSection({
        title: "מבוטח משני",
        subtitle: "פוליסות קיימות של המבוטח המשני בחברה אחרת",
        sectionKey: "secondary",
        getList: ()=> state.case.cancellations.secondary
      }) : `<div class="chip">אין מבוטח משני בתיק — אין פוליסות לביטול למבוטח משני.</div>`}

      ${(state.case.children||[]).length ? (state.case.children||[]).map((ch, idx)=>{
        const display = `${(ch.firstName||"") ? ch.firstName : "ילד"} ${(ch.lastName||"")}`.trim();
        const title = display ? `ילד ${idx+1}: ${display}` : `ילד ${idx+1}`;
        const key = `child:${ch.id}`;
        return renderCancelSection({
          title,
          subtitle: "פוליסות קיימות של הילד בחברה אחרת",
          sectionKey: key,
          getList: ()=> state.case.cancellations.children[ch.id] || []
        });
      }).join("") : `<div class="chip">אין ילדים בתיק — אין פוליסות לביטול לילדים.</div>`}
    `;

    app.querySelectorAll("[data-cancel-add]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const key = btn.dataset.cancelAdd;
        addCancelPolicy(key);
        render();
      });
    });

    app.querySelectorAll("[data-cancel-remove]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const [key, idxStr] = btn.dataset.cancelRemove.split(":");
        const idx = Number(idxStr);
        removeCancelPolicy(key, idx);
        render();
      });
    });

    app.querySelectorAll("[data-path]").forEach(node=>{
      const p = node.dataset.path || "";
      if (!p.startsWith("__cancel.")) return;
      const tag = node.tagName.toLowerCase();
      const ev = (tag === "select") ? "change" : "input";
      node.addEventListener(ev, ()=>{
        applyCancelPath(p, node.value);
        updateSide();
      });
    });
  }

  function addCancelPolicy(sectionKey){
    ensureCancellationState();
    if (sectionKey === "primary"){
      state.case.cancellations.primary.push(newCancelPolicy());
      return;
    }
    if (sectionKey === "secondary"){
      state.case.cancellations.secondary.push(newCancelPolicy());
      return;
    }
    if (sectionKey.startsWith("child:")){
      const childId = sectionKey.split(":")[1];
      state.case.cancellations.children[childId] = state.case.cancellations.children[childId] || [];
      state.case.cancellations.children[childId].push(newCancelPolicy());
    }
  }

  function removeCancelPolicy(sectionKey, idx){
    ensureCancellationState();
    if (sectionKey === "primary"){
      state.case.cancellations.primary.splice(idx,1);
      return;
    }
    if (sectionKey === "secondary"){
      state.case.cancellations.secondary.splice(idx,1);
      return;
    }
    if (sectionKey.startsWith("child:")){
      const childId = sectionKey.split(":")[1];
      const arr = state.case.cancellations.children[childId] || [];
      arr.splice(idx,1);
      state.case.cancellations.children[childId] = arr;
    }
  }

  function applyCancelPath(path, value){
    ensureCancellationState();
    const parts = path.split(".");
    if (parts.length < 4) return;
    const sectionKey = parts[1];
    const idx = Number(parts[2]);
    const field = parts[3];

    if (sectionKey === "primary"){
      const row = state.case.cancellations.primary[idx];
      if (!row) return;
      row[field] = value;
      return;
    }
    if (sectionKey === "secondary"){
      const row = state.case.cancellations.secondary[idx];
      if (!row) return;
      row[field] = value;
      return;
    }
    if (sectionKey.startsWith("child:")){
      const childId = sectionKey.split(":")[1];
      const arr = state.case.cancellations.children[childId] || [];
      const row = arr[idx];
      if (!row) return;
      row[field] = value;
      return;
    }
  }

function renderProductsActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnAddProduct" type="button">הוסף מוצר</button>
      <button class="btn primary" id="btnNextToQ" type="button">המשך לשאלונים</button>
    `;
    panelActions.querySelector("#btnAddProduct").addEventListener("click", ()=>{
      addProduct();
      toast("מוצר נוסף ✅");
      render();
    });
    panelActions.querySelector("#btnNextToQ").addEventListener("click", ()=>{
      if (state.case.products.length === 0){
        toast("צריך להוסיף לפחות מוצר אחד.");
        return;
      }
      // validate required product fields
      for (let i=0;i<state.case.products.length;i++){
        const p = state.case.products[i];
        if (!p.company || !p.productName || !p.premiumBefore || !p.premiumAfter){
          toast(`יש חוסרים במוצר ${i+1}.`);
          return;
        }
      }
      setStep("questionnaires");
    });
  }

  function addProduct(){
    const p = {
      id: `PRD-${Date.now()}-${Math.floor(Math.random()*1e6)}`,
      company:"",
      productName:"",
      premiumBefore:"",
      premiumAfter:"",
      insuredFor:"primary"
    };
    state.case.products.push(p);
    if (!state.case.medical[p.id]) state.case.medical[p.id] = {};
  }

  function renderProducts(){
    if (state.case.products.length === 0){
      app.innerHTML = `
        <div class="card">
          <div class="cardTitle">אין מוצרים בתיק</div>
          <div class="cardMeta">לחץ "הוסף מוצר" כדי להתחיל.</div>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">מוצרים</div>
            <div class="cardMeta">לכל מוצר: חברה + שם מוצר + פרמיה לפני/אחרי הנחה.</div>
          </div>
          <span class="pill">סה״כ אחרי: <span class="mono">${esc(String(premiumTotal()))}</span></span>
        </div>
      </div>

      ${state.case.products.map((p,idx)=>productCard(p,idx)).join("")}
    `;

    app.querySelectorAll("[data-remove-product]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const idx = Number(btn.dataset.removeProduct);
        if (!confirm("להסיר את המוצר מהתיק?")) return;
        const p = state.case.products[idx];
        state.case.products.splice(idx, 1);
        if (p) delete state.case.medical[p.id];
        render();
      });
    });

    bindPaths(app);
  }

  function productCard(p, idx){
    const before = num(p.premiumBefore);
    const after = num(p.premiumAfter);
    const disc = Math.max(0, before - after);

    return `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">מוצר ${idx+1}</div>
            <div class="cardMeta">${esc(insuredLabelFromCode(p.insuredFor))} • ${esc(p.company || "—")} • ${esc(p.productName || "—")} • ID: <span class="mono">${esc(p.id)}</span></div>
          </div>
          <button class="smallBtn" data-remove-product="${idx}" type="button">הסר</button>
        </div>

        <div class="formGrid3" style="margin-top:12px">
          ${select("מי המבוטח",`products.${idx}.insuredFor`,p.insuredFor, getInsuredOptions())}
          ${select("חברה",`products.${idx}.company`,p.company,["", ...COMPANIES])}
          ${field("שם מוצר ביטוח",`products.${idx}.productName`,p.productName,"text","לדוגמה: בריאות / חיים / אכ״ע ...")}
        </div>

        <div class="formGrid3" style="margin-top:12px">
          ${field("פרמיה לפני הנחה",`products.${idx}.premiumBefore`,p.premiumBefore,"number")}
          ${field("פרמיה אחרי הנחה",`products.${idx}.premiumAfter`,p.premiumAfter,"number")}
          <div class="field">
            <div class="label">הנחה (חודשי)</div>
            <div class="pill"><span class="mono">${esc(String(disc))}</span></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderQuestionnaireActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnBackProducts" type="button">חזרה למוצרים</button>
      <button class="btn primary" id="btnNextPayment" type="button">המשך לתשלום</button>
    `;
    panelActions.querySelector("#btnBackProducts").addEventListener("click", ()=> setStep("products"));
    panelActions.querySelector("#btnNextPayment").addEventListener("click", ()=> setStep("payment"));
  }

  function renderQuestionnaires(){
    if (state.case.products.length === 0){
      app.innerHTML = `
        <div class="card">
          <div class="cardTitle">אין מוצרים — אין שאלונים</div>
          <div class="cardMeta">קודם הוסף מוצרים ואז נפתח שאלונים לכל מוצר.</div>
        </div>
      `;
      return;
    }

    app.innerHTML = state.case.products.map((p, idx)=>{
      const qset = getQuestionnaireFor(p);
      return `
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">שאלון למוצר ${idx+1}</div>
              <div class="cardMeta">${esc(insuredLabelFromCode(p.insuredFor))} • ${esc(p.company || "—")} • ${esc(p.productName || "—")}</div>
            </div>
            <span class="chip mono">${esc(p.id)}</span>
          </div>
        </div>

        ${qset.map(q => questionnaireCard(p.id, q)).join("")}
      `;
    }).join("");

    wireQuestionnaire();
  }

  
  // Questionnaire mapping (placeholder bank). Later you can expand per company + product.
  // Key priority:
  // 1) "חברה|שם מוצר" (exact)
  // 2) "חברה|*" (company default)
  // 3) "*|*" (system default)
  const QUESTION_BANK = {
    "*|*": QUESTION_SET_DEFAULT,

    // דוגמאות התחלה (אפשר להרחיב)
    "הפניקס|בריאות": [
      { id:"ph1", title:"סוכרת", desc:"האם קיימת סוכרת/טרום סוכרת?", follow:"פרט סוג/תאריך אבחנה/טיפול/בדיקות" },
      { id:"ph2", title:"לחץ דם", desc:"האם יש לחץ דם גבוה?", follow:"פרט תרופות/מדידות/ביקורות" },
      { id:"ph3", title:"כולסטרול", desc:"האם יש כולסטרול גבוה?", follow:"פרט תרופות/בדיקות" },
      ...QUESTION_SET_DEFAULT,
    ],
    "הראל|חיים": [
      { id:"hr1", title:"עישון", desc:"האם המבוטח מעשן כיום?", follow:"כמות/משך/הפסקות" },
      { id:"hr2", title:"ניתוחים", desc:"האם בוצעו ניתוחים בעבר?", follow:"פרט ניתוח/תאריך/סיבה" },
      ...QUESTION_SET_DEFAULT,
    ],
    "מנורה|אכ״ע": [
      { id:"mn1", title:"פגיעה/תאונה", desc:"האם הייתה תאונה/פגיעה משמעותית?", follow:"פרט תאונה/תאריך/השלכות" },
      { id:"mn2", title:"מגבלות עבודה", desc:"האם קיימת מגבלה תפקודית/רפואית?", follow:"פרט מגבלה/מסמכים" },
      ...QUESTION_SET_DEFAULT,
    ],

    // company defaults:
    "מנורה|*": QUESTION_SET_DEFAULT,
    "כלל|*": QUESTION_SET_DEFAULT,
    "הפניקס|*": QUESTION_SET_DEFAULT,
    "מגדל|*": QUESTION_SET_DEFAULT,
    "הראל|*": QUESTION_SET_DEFAULT,
    "הכשרה|*": QUESTION_SET_DEFAULT,
    "מדיקר|*": QUESTION_SET_DEFAULT,
  };

  function normKey(s){
    return String(s || "").trim();
  }

  function getQuestionnaireFor(product){
    const company = normKey(product.company);
    const pname   = normKey(product.productName);

    // allow quick matching by "contains" for common names (optional)
    // Example: if user typed "בריאות פרימיום" -> match "בריאות"
    const baseName = (() => {
      const known = ["בריאות","חיים","אכ״ע","אכע","סיעוד","משכנתא","תאונות","נסיעות","שיניים"];
      const hit = known.find(k => pname.includes(k));
      return hit || pname;
    })();

    const exact = `${company}|${baseName}`;
    const companyDefault = `${company}|*`;

    return QUESTION_BANK[exact]
      || QUESTION_BANK[`${company}|${pname}`]
      || QUESTION_BANK[companyDefault]
      || QUESTION_BANK["*|*"]
      || QUESTION_SET_DEFAULT;
  }

  function questionnaireCard(productId, q){
    const ans = (state.case.medical[productId] || {})[q.id] || "";
    const yesActive = ans === "כן" ? "active" : "";
    const noActive = ans === "לא" ? "active" : "";

    const followVal = (state.case.medical[productId] || {})[`${q.id}__details`] || "";

    const follow = (ans === "כן")
      ? `<div class="followUp">
          <div class="cardTitle">פירוט</div>
          <div class="cardMeta" style="margin-bottom:8px">${esc(q.follow)}</div>
          <textarea class="textarea" data-follow="${esc(productId)}" data-q="${esc(q.id)}" placeholder="הקלד פירוט...">${esc(followVal)}</textarea>
        </div>`
      : "";

    return `
      <div class="card" data-qcard="1" data-prod="${esc(productId)}" data-qid="${esc(q.id)}">
        <div class="cardTop">
          <div>
            <div class="cardTitle">${esc(q.title)}</div>
            <div class="cardMeta">${esc(q.desc)}</div>
          </div>
          <div class="segment" role="group" aria-label="כן/לא">
            <button class="segBtn ${yesActive}" data-ans="כן" type="button">כן</button>
            <button class="segBtn ${noActive}" data-ans="לא" type="button">לא</button>
          </div>
        </div>
        ${follow}
      </div>
    `;
  }

  function wireQuestionnaire(){
    app.querySelectorAll("[data-qcard='1'] .segBtn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const card = btn.closest("[data-qcard='1']");
        const prodId = card.dataset.prod;
        const qid = card.dataset.qid;
        const val = btn.dataset.ans;

        if (!state.case.medical[prodId]) state.case.medical[prodId] = {};
        state.case.medical[prodId][qid] = val;

        // If switched to "לא" -> clear details
        if (val !== "כן"){
          delete state.case.medical[prodId][`${qid}__details`];
        }
        render();
      });
    });

    app.querySelectorAll("textarea[data-follow]").forEach(t=>{
      t.addEventListener("input", ()=>{
        const prodId = t.dataset.follow;
        const qid = t.dataset.q;
        if (!state.case.medical[prodId]) state.case.medical[prodId] = {};
        state.case.medical[prodId][`${qid}__details`] = t.value;
        updateSide();
      });
    });
  }

  function renderPaymentActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnBackQ" type="button">חזרה לשאלונים</button>
      <button class="btn primary" id="btnNextSummary" type="button">המשך לסיום</button>
    `;
    panelActions.querySelector("#btnBackQ").addEventListener("click", ()=> setStep("questionnaires"));
    panelActions.querySelector("#btnNextSummary").addEventListener("click", ()=>{
      const pay = state.case.payment;
      if (!pay.method || !pay.payerName || !pay.payerId){
        toast("חסר אמצעי תשלום / שם משלם / ת״ז משלם.");
        return;
      }
      setStep("summary");
    });
  }

  function renderPayment(){
    const pay = state.case.payment;

    app.innerHTML = `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">אמצעי תשלום</div>
            <div class="cardMeta">לא שומרים מספר כרטיס מלא. רק פרטים בסיסיים.</div>
          </div>
          <span class="chip">אבטחה</span>
        </div>

        <div class="formGrid" style="margin-top:12px">
          ${select("שיטת תשלום","payment.method",pay.method,PAYMENT_METHODS)}
          ${field("שם משלם","payment.payerName",pay.payerName)}
        </div>

        <div class="formGrid3" style="margin-top:12px">
          ${field("ת״ז משלם","payment.payerId",pay.payerId)}
          ${field("4 ספרות אחרונות","payment.cardLast4",pay.cardLast4,"text","למשל: 1234")}
          <div class="field">
            <div class="label">סה״כ חודשי (אחרי)</div>
            <div class="pill"><span class="mono">${esc(String(premiumTotal()))}</span></div>
          </div>
        </div>

        <div class="formGrid" style="margin-top:12px">
          ${textarea("הערות לתשלום","payment.notes",pay.notes,"הערות פנימיות...")}
          <div class="field">
            <div class="label">תזכורת</div>
            <div class="chip">אפשר לשדרג למסך גבייה מתקדם</div>
          </div>
        </div>
      </div>
    `;

    bindPaths(app);
  }

  function renderSummaryActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnExportPdf" type="button">ייצוא PDF</button>
      <button class="btn" id="btnPrint" type="button">הדפס</button>
      <button class="btn" id="btnCopy" type="button">העתק JSON</button>
      <button class="btn" id="btnSaveFinal" type="button">שמור תיק</button>
      <button class="btn primary" id="btnSaveAndGoSaved" type="button">שמור + תיקים</button>
    `;

    panelActions.querySelector("#btnExportPdf").addEventListener("click", ()=> exportCasePDF(state.case));

    panelActions.querySelector("#btnPrint").addEventListener("click", ()=> window.print());
    panelActions.querySelector("#btnCopy").addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(JSON.stringify(state.case, null, 2));
        toast("העתקתי JSON ✅");
      }catch{
        toast("לא הצלחתי להעתיק (חסימת דפדפן).");
      }
    });

    panelActions.querySelector("#btnSaveFinal").addEventListener("click", ()=>{
      // basic validation
      const miss = missingCritical();
      if (miss.length){
        toast("יש חסרים — בדוק פאנל בקרה.");
        return;
      }
      saveFinal();
      toast("התיק נשמר ✅");
    });

    panelActions.querySelector("#btnSaveAndGoSaved").addEventListener("click", ()=>{
      const miss = missingCritical();
      if (miss.length){ toast("יש חסרים — בדוק פאנל בקרה."); return; }
      saveFinal();
      toast("התיק נשמר ✅");
      setView("saved");
    });
  }

  function renderSummary(){
    const c = state.case.client;
    const pay = state.case.payment;

    const productsHtml = state.case.products.map((p,i)=>{
      const before = num(p.premiumBefore);
      const after = num(p.premiumAfter);
      const disc = Math.max(0, before-after);
      return `
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">מוצר ${i+1}: ${esc(p.productName || "—")}</div>
              <div class="cardMeta">${esc(p.company || "—")} • ID: <span class="mono">${esc(p.id)}</span></div>
            </div>
            <span class="pill">אחרי: <span class="mono">${esc(String(after))}</span></span>
          </div>
          <div class="chips" style="margin-top:10px">
            <span class="chip mono">לפני: ${esc(String(before))}</span>
            <span class="chip mono">אחרי: ${esc(String(after))}</span>
            <span class="chip mono">הנחה: ${esc(String(disc))}</span>
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">סיכום תיק</div>
            <div class="cardMeta">נוצר: ${esc(new Date(state.case.createdAtISO).toLocaleString("he-IL"))}</div>
          </div>
          <span class="chip mono">${esc(state.case.caseId)}</span>
        </div>

        <div class="chips" style="margin-top:10px">
          <span class="chip">מוצרים: <span class="mono">${esc(String(state.case.products.length))}</span></span>
          <span class="chip">ילדים: <span class="mono">${esc(String(state.case.children.length))}</span></span>
          <span class="chip">סה״כ אחרי: <span class="mono">${esc(String(premiumTotal()))}</span></span>
        </div>
      </div>

      <div class="card">
        <div class="cardTitle">מבוטח ראשי</div>
        <div class="cardMeta">${esc((c.firstName + " " + c.lastName).trim() || "—")} • ת״ז: ${esc(c.idNumber || "—")}</div>
        <div class="chips" style="margin-top:10px">
          <span class="chip">טלפון: ${esc(c.phone || "—")}</span>
          <span class="chip">מייל: ${esc(c.email || "—")}</span>
          <span class="chip">עיר: ${esc(c.city || "—")}</span>
        </div>
      </div>

      <div class="card">
        <div class="cardTitle">תשלום</div>
        <div class="cardMeta">${esc(pay.method || "—")} • משלם: ${esc(pay.payerName || "—")} • ת״ז: ${esc(pay.payerId || "—")}</div>
        <div class="chips" style="margin-top:10px">
          <span class="chip">4 ספרות: <span class="mono">${esc(pay.cardLast4 || "—")}</span></span>
          <span class="chip">הערות: ${esc(pay.notes || "—")}</span>
        </div>
      </div>

      <div class="card">
        <div class="cardTitle">ביטולים מול מוצרים לפי מבוטח</div>
        <div class="cardMeta">השוואה לפי מבוטח (ראשי/משני/ילדים): מה מבטלים בחברה נגדית מול מה רוכשים אצלנו.</div>
      </div>

      ${renderInsuredComparisonSummary()}

      <div class="card">
        <div class="cardTitle">מוצרים</div>
        <div class="cardMeta">רשימת מוצרים עם פרמיות.</div>
      </div>

      ${productsHtml}

      <div class="card">
        <div class="cardTitle">שאלונים</div>
        <div class="cardMeta">כרגע שאלון בסיסי (כן/לא). בהמשך נחבר לשאלונים אמיתיים לפי חברה+מוצר.</div>
      </div>

      ${renderQuestionnaireSummary()}
    `;
  }

  function renderQuestionnaireSummary(){
    return state.case.products.map((p,i)=>{
      const qset = getQuestionnaireFor(p);
      const ans = state.case.medical[p.id] || {};
      const yesCount = qset.filter(q => ans[q.id] === "כן").length;
      const noCount = qset.filter(q => ans[q.id] === "לא").length;

      return `
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">שאלון מוצר ${i+1}: ${esc(p.productName || "—")}</div>
              <div class="cardMeta">${esc(p.company || "—")}</div>
            </div>
            <div class="chips">
              <span class="chip">כן: <span class="mono">${esc(String(yesCount))}</span></span>
              <span class="chip">לא: <span class="mono">${esc(String(noCount))}</span></span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }



  function exportCasePDF(c){
    // Printable HTML - user can "Save as PDF" in print dialog.
    const name = `${c?.client?.firstName||""} ${c?.client?.lastName||""}`.trim() || "—";
    const created = c.createdAtISO ? new Date(c.createdAtISO).toLocaleString("he-IL") : "—";
    const updated = (c.savedAtISO || c.createdAtISO) ? new Date(c.savedAtISO || c.createdAtISO).toLocaleString("he-IL") : "—";
    const total = (c.products||[]).reduce((a,p)=>a + num(p.premiumAfter), 0);

    const sec = c.hasSecondary ? c.secondary : null;

    const childrenHtml = (c.children||[]).map((ch, i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${esc(`${ch.firstName||""} ${ch.lastName||""}`.trim() || "—")}</td>
        <td class="mono">${esc(ch.idNumber||"—")}</td>
        <td class="mono">${esc(ch.birthDate||"—")}</td>
        <td class="mono">${esc(ch.age||"—")}</td>
        <td>${esc(ch.gender||"—")}</td>
      </tr>
    `).join("");

    const productsHtml = (c.products||[]).map((p,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${esc(insuredLabelFromCode(p.insuredFor))}</td>
        <td>${esc(p.company||"—")}</td>
        <td>${esc(p.productName||"—")}</td>
        <td class="mono">${esc(p.premiumBefore||"—")}</td>
        <td class="mono">${esc(p.premiumAfter||"—")}</td>
      </tr>
    `).join("");

    const qHtml = (c.products||[]).map((p, i)=>{
      const qset = getQuestionnaireFor(p);
      const ans = c.medical?.[p.id] || {};
      const rows = qset.map(q=>{
        const a = ans[q.id] || "—";
        const det = ans[`${q.id}__details`] || "";
        return `
          <tr>
            <td>${esc(q.title)}</td>
            <td>${esc(a)}</td>
            <td>${esc(det || "")}</td>
          </tr>
        `;
      }).join("");
      return `
        <div class="blk">
          <div class="blkTitle">שאלון • ${esc(insuredLabelFromCode(p.insuredFor))} • ${esc(p.company||"—")} • ${esc(p.productName||"—")} <span class="mono">(${esc(p.id)})</span></div>
          <table class="t">
            <thead><tr><th>שאלה</th><th>כן/לא</th><th>פירוט (אם כן)</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join("");

    const pay = c.payment || {};
    const payLine = `${pay.method||"—"} • משלם: ${pay.payerName||"—"} • ת״ז: ${pay.payerId||"—"} • 4 ספרות: ${pay.cardLast4||"—"}`;

    const html = `
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <title>GEMEL INVEST CRM • PDF</title>
  <style>
    :root{ --p:#6d28d9; --t:#111; --m:#555; }
    *{ box-sizing:border-box; }
    body{ margin:0; font-family: Arial, system-ui; color:var(--t); background:#fff; }
    .page{ padding: 28px 28px 36px; }
    .head{
      display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
      border-bottom: 2px solid #eee; padding-bottom: 14px; margin-bottom: 14px;
    }
    .logo{
      font-weight:900; letter-spacing:.6px; color:var(--p);
      border:1px solid #eee; border-radius: 14px; padding:10px 12px;
      display:inline-flex; align-items:center; gap:10px;
    }
    .logoMark{
      width:34px; height:34px; border-radius: 12px;
      background: rgba(109,40,217,.10);
      display:grid; place-items:center;
      font-weight:900;
    }
    .h1{ font-size: 18px; font-weight: 900; margin:0; }
    .sub{ margin-top:6px; color:var(--m); font-size: 12px; }
    .meta{ text-align:left; color:var(--m); font-size: 12px; line-height: 1.6; }
    .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .blk{ margin: 12px 0 16px; }
    .blkTitle{ font-weight: 900; font-size: 13px; margin: 8px 0; color:#1f1f1f; }
    .box{
      border: 1px solid #eee; border-radius: 14px; padding: 10px 12px;
    }
    .kv{ display:grid; grid-template-columns: 160px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #eee; font-size: 12px; }
    .kv:last-child{ border-bottom:none; }
    .k{ color:var(--m); font-weight: 700; }
    .v{ font-weight: 700; }
    .t{ width:100%; border-collapse: collapse; font-size: 12px; }
    .t th,.t td{ border:1px solid #eee; padding: 8px 8px; text-align:right; vertical-align: top; }
    .t th{ background: rgba(109,40,217,.06); color:#333; font-weight: 900; }
    .mono{ font-family: "Courier New", ui-monospace, Menlo, Consolas, monospace; }
    .sign{
      display:grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px;
    }
    .line{ border-top: 1px solid #bbb; padding-top: 8px; color:#333; font-size: 12px; }
    @media print{
      .page{ padding: 0.7cm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div>
        <div class="logo">
          <div class="logoMark">GI</div>
          <div>
            <div class="h1">GEMEL INVEST CRM</div>
            <div class="sub">טופס סיכום תיק רפואי • לשימוש פנימי בסוכנות</div>
          </div>
        </div>
      </div>
      <div class="meta">
        <div><b>מזהה תיק:</b> <span class="mono">${esc(c.caseId||"—")}</span></div>
        <div><b>נוצר:</b> ${esc(created)}</div>
        <div><b>עודכן:</b> ${esc(updated)}</div>
        <div><b>סה״כ פרמיה (אחרי):</b> <span class="mono">${esc(String(total))}</span></div>
      </div>
    </div>

    <div class="blk">
      <div class="blkTitle">פרטי מבוטח ראשי</div>
      <div class="box">
        <div class="kv"><div class="k">שם</div><div class="v">${esc(name)}</div></div>
        <div class="kv"><div class="k">ת״ז</div><div class="v mono">${esc(c.client?.idNumber||"—")}</div></div>
        <div class="kv"><div class="k">טלפון</div><div class="v mono">${esc(c.client?.phone||"—")}</div></div>
        <div class="kv"><div class="k">מייל</div><div class="v">${esc(c.client?.email||"—")}</div></div>
        <div class="kv"><div class="k">כתובת</div><div class="v">${esc(c.client?.address||"—")} ${esc(c.client?.city||"")}</div></div>
        <div class="kv"><div class="k">גיל / מין / מעשן</div><div class="v">${esc(c.client?.age||"—")} / ${esc(c.client?.gender||"—")} / ${esc(c.client?.smoker||"—")}</div></div>
        <div class="kv"><div class="k">גובה / משקל</div><div class="v">${esc(c.client?.heightCm||"—")} ס״מ / ${esc(c.client?.weightKg||"—")} ק״ג</div></div>
      </div>
    </div>

    <div class="blk">
      <div class="blkTitle">מבוטח משני</div>
      <div class="box">
        ${sec ? `
          <div class="kv"><div class="k">שם</div><div class="v">${esc(`${sec.firstName||""} ${sec.lastName||""}`.trim()||"—")}</div></div>
          <div class="kv"><div class="k">ת״ז</div><div class="v mono">${esc(sec.idNumber||"—")}</div></div>
          <div class="kv"><div class="k">טלפון</div><div class="v mono">${esc(sec.phone||"—")}</div></div>
          <div class="kv"><div class="k">מייל</div><div class="v">${esc(sec.email||"—")}</div></div>
        ` : `<div class="kv"><div class="k">סטטוס</div><div class="v">לא קיים</div></div>`}
      </div>
    </div>

    <div class="blk">
      <div class="blkTitle">ילדים</div>
      <table class="t">
        <thead><tr><th>#</th><th>שם</th><th>ת״ז</th><th>תאריך לידה</th><th>גיל</th><th>מין</th></tr></thead>
        <tbody>
          ${(c.children||[]).length ? childrenHtml : `<tr><td colspan="6">אין ילדים</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="blk">
      <div class="blkTitle">מוצרים</div>
      <table class="t">
        <thead><tr><th>#</th><th>מבוטח</th><th>חברה</th><th>מוצר</th><th>פרמיה לפני</th><th>פרמיה אחרי</th></tr></thead>
        <tbody>
          ${(c.products||[]).length ? productsHtml : `<tr><td colspan="6">אין מוצרים</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="blk">
      <div class="blkTitle">אמצעי תשלום</div>
      <div class="box">
        <div class="kv"><div class="k">סיכום</div><div class="v">${esc(payLine)}</div></div>
        <div class="kv"><div class="k">הערות</div><div class="v">${esc(pay.notes||"—")}</div></div>
      </div>
    </div>

    <div class="blk">
      <div class="blkTitle">שאלונים</div>
      ${qHtml || `<div class="box">אין שאלונים</div>`}
    </div>

    <div class="sign">
      <div class="line">חתימת סוכן / נציג: ____________________</div>
      <div class="line">חתימת לקוח: __________________________</div>
    </div>
  </div>
  <script>
    // auto-open print dialog
    setTimeout(()=>{ window.print(); }, 250);
  </script>
</body>
</html>
    `;

    const w = window.open("", "_blank");
    if (!w){ toast("הדפדפן חסם חלון חדש (Pop-up)."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }


  function renderSavedActions(){
    panelActions.innerHTML = `
      <div class="searchBox">
        <input class="searchInput" id="savedSearch" type="text" placeholder="חיפוש לפי שם / ת״ז / טלפון / חברה / מוצר / מזהה תיק..." />
        <button class="btn" id="btnNewCase" type="button">תיק חדש</button>
      </div>
    `;

    const input = panelActions.querySelector("#savedSearch");
    input.value = state.savedQuery || "";
    input.addEventListener("input", ()=>{
      state.savedQuery = input.value;
      renderSaved(); // lightweight re-render
    });

    panelActions.querySelector("#btnNewCase").addEventListener("click", ()=>{
      if (confirm("לפתוח תיק חדש? זה לא מוחק תיקים שמורים.")){
        state.case = freshCase();
        setView("case");
        setStep("details");
        toast("נפתח תיק חדש ✅");
      }
    });
  }

  function readSavedCases(){
    return Storage.listCases() || [];
  }

  function caseSearchBlob(c){
    const name = `${c?.client?.firstName||""} ${c?.client?.lastName||""}`.trim();
    const products = (c.products||[]).map(p=>`${p.company||""} ${p.productName||""}`).join(" | ");
    return [
      c.caseId, c.status, name, c?.client?.idNumber, c?.client?.phone, c?.client?.email, c?.client?.city,
      products
    ].join(" ").toLowerCase();
  }

  function renderSaved(){
    // Header
    caseTitle.textContent = "תיקים שמורים";
    caseIdChip.textContent = "GICRM_CASES";
    caseStatusChip.textContent = "מאגר מקומי";
    stageBadge.textContent = "תיקים";
    badgeStage.textContent = "תיקים";

    // hide stepper and keep header
    stepper.classList.add("hidden");

    panelTitle.textContent = "תיקים שמורים";
    panelHint.textContent = "חיפוש, פתיחה, מחיקה וייצוא PDF לתיק קיים.";
    renderSavedActions();

    const list = readSavedCases()
      .sort((a,b)=> (b.savedAtISO||b.createdAtISO||"").localeCompare(a.savedAtISO||a.createdAtISO||""));

    const q = String(state.savedQuery||"").trim().toLowerCase();
    const filtered = q ? list.filter(c => caseSearchBlob(c).includes(q)) : list;

    // Side panel summary
    badgeProducts.textContent = String(filtered.length);
    badgeTotal.textContent = "—";
    badgeSecondary.textContent = "—";
    badgeChildren.textContent = "—";
    missingList.innerHTML = `<div class="chip">תוצאות: <span class="mono">${filtered.length}</span> מתוך <span class="mono">${list.length}</span></div>`;

    if (list.length === 0){
      app.innerHTML = `
        <div class="card">
          <div class="cardTitle">אין תיקים שמורים</div>
          <div class="cardMeta">גש ל"סיום" ואז לחץ "שמור תיק".</div>
        </div>
      `;
      return;
    }

    if (filtered.length === 0){
      app.innerHTML = `
        <div class="card">
          <div class="cardTitle">אין תוצאות לחיפוש</div>
          <div class="cardMeta">נסה מילה אחרת (שם/ת״ז/טלפון/חברה/מוצר).</div>
        </div>
      `;
      return;
    }

    const rows = filtered.map(c=>{
      const name = `${c?.client?.firstName||""} ${c?.client?.lastName||""}`.trim() || "—";
      const idn = c?.client?.idNumber || "—";
      const phone = c?.client?.phone || "—";
      const savedAt = c.savedAtISO || c.createdAtISO || "";
      const savedTxt = savedAt ? new Date(savedAt).toLocaleString("he-IL") : "—";
      const prodCount = (c.products||[]).length;
      const total = (c.products||[]).reduce((a,p)=>a + num(p.premiumAfter), 0);

      return `
        <tr>
          <td class="mono">${esc(c.caseId||"—")}</td>
          <td>${esc(name)}</td>
          <td class="mono">${esc(idn)}</td>
          <td class="mono">${esc(phone)}</td>
          <td><span class="badgeMini">${esc(c.status||"—")}</span></td>
          <td class="mono">${esc(String(prodCount))}</td>
          <td class="mono">${esc(String(total))}</td>
          <td class="mono">${esc(savedTxt)}</td>
          <td>
            <div class="rowActions">
              <button class="smallBtn" data-open="${esc(c.caseId)}" type="button">פתח</button>
              <button class="smallBtn" data-pdf="${esc(c.caseId)}" type="button">PDF</button>
              <button class="smallBtn" data-dup="${esc(c.caseId)}" type="button">שכפל</button>
              <button class="smallBtn" data-del="${esc(c.caseId)}" type="button">מחק</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">מאגר תיקים</div>
            <div class="cardMeta">לחץ "פתח" כדי להמשיך לערוך. "PDF" כדי לייצא טופס.</div>
          </div>
          <span class="pill">סה״כ תיקים: <span class="mono">${esc(String(list.length))}</span></span>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>מזהה תיק</th>
            <th>שם</th>
            <th>ת״ז</th>
            <th>טלפון</th>
            <th>סטטוס</th>
            <th>מוצרים</th>
            <th>סה״כ אחרי</th>
            <th>עודכן</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    app.querySelectorAll("[data-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.open;
        const all = readSavedCases();
        const found = all.find(x => x.caseId === id);
        if (!found){ toast("לא נמצא תיק."); return; }
        state.case = found;
        // guards
        if (!state.case.client) state.case.client = blankPerson();
        if (!state.case.secondary) state.case.secondary = blankPerson();
        if (state.case.cancellations) state.case.cancellations.secondary = [];
        if (!state.case.children) state.case.children = [];
        if (!state.case.products) state.case.products = [];
      // back-compat: insuredFor
      (state.case.products||[]).forEach(p=>{ if (!p.insuredFor) p.insuredFor = "primary"; });
      // back-compat: insuredFor
      (state.case.products||[]).forEach(p=>{ if (!p.insuredFor) p.insuredFor = "primary"; });
        if (!state.case.medical) state.case.medical = {};
        if (!state.case.payment) state.case.payment = blankPayment();
        if (!state.case.step) state.case.step = "details";
        toast("התיק נטען ✅");
        setView("case");
        setStep("details");
      });
    });

    app.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.del;
        if (!confirm("למחוק את התיק לצמיתות מהמאגר המקומי?")) return;
        const all = readSavedCases().filter(x => x.caseId !== id);
        localStorage.setItem("GICRM_CASES", JSON.stringify(all));
        toast("התיק נמחק ✅");
        renderSaved();
      });
    });

    app.querySelectorAll("[data-dup]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.dup;
        const all = readSavedCases();
        const found = all.find(x => x.caseId === id);
        if (!found){ toast("לא נמצא תיק."); return; }
        const clone = JSON.parse(JSON.stringify(found));
        clone.caseId = `CASE-${Date.now()}`;
        clone.createdAtISO = new Date().toISOString();
        clone.savedAtISO = new Date().toISOString();
        clone.status = "טיוטה (שוכפל)";
        all.unshift(clone);
        localStorage.setItem("GICRM_CASES", JSON.stringify(all));
        toast("שוכפל ✅");
        renderSaved();
      });
    });

    app.querySelectorAll("[data-pdf]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.pdf;
        const all = readSavedCases();
        const found = all.find(x => x.caseId === id);
        if (!found){ toast("לא נמצא תיק."); return; }
        exportCasePDF(found);
      });
    });
  }

  function renderSettings(){
    caseTitle.textContent = "הגדרות";
    caseIdChip.textContent = "—";
    caseStatusChip.textContent = "בקרוב";
    stageBadge.textContent = "הגדרות";
    badgeStage.textContent = "הגדרות";

    stepper.classList.add("hidden");

    panelTitle.textContent = "הגדרות";
    panelHint.textContent = "פה נשים בהמשך: משתמשים/הרשאות, חיבור DB, תבניות PDF, ועוד.";
    panelActions.innerHTML = `
      <button class="btn" id="btnBackCase" type="button">חזרה לתיק</button>
    `;
    panelActions.querySelector("#btnBackCase").addEventListener("click", ()=> setView("case"));

    
    app.innerHTML = `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">שמירה וסנכרון</div>
            <div class="cardMeta">כרגע עובדים במצב מקומי. בהמשך נחבר ל־Google Sheets באמצעות Apps Script Web App.</div>
          </div>
          <span class="pill">מצב: <span class="mono">${esc(state.settings.storageMode.toUpperCase())}</span></span>
        </div>

        <div class="divider"></div>

        <div class="radioGroup" id="storageModeGroup">
          <label class="radioCard">
            <input type="radio" name="storageMode" value="local" ${state.settings.storageMode==="local" ? "checked" : ""}/>
            <div>
              <div class="radioTitle">LOCAL</div>
              <div class="radioDesc">שמירה בדפדפן בלבד (מהיר). מתאים כרגע.</div>
            </div>
          </label>

          <label class="radioCard">
            <input type="radio" name="storageMode" value="server" ${state.settings.storageMode==="server" ? "checked" : ""}/>
            <div>
              <div class="radioTitle">SERVER (בהמשך)</div>
              <div class="radioDesc">שמירה ב־Google Sheets/DB. דורש Web App URL.</div>
            </div>
          </label>
        </div>

        <div style="margin-top:12px" class="field">
          <div class="label">Server URL (Apps Script Web App)</div>
          <input class="input" id="serverUrlInput" placeholder="https://script.google.com/macros/s/....../exec" value="${esc(state.settings.serverUrl||"")}"/>
          <div class="inlineNote">אפשר להשאיר ריק כרגע — אנחנו נכניס URL רק כשנפרסם Web App.</div>
        </div>

        <div class="divider"></div>

        <div class="panelActions" style="justify-content:flex-start">
          <button class="btn primary" id="btnSaveSettings" type="button">שמור הגדרות</button>
          <button class="btn" id="btnClearLocal" type="button">נקה מאגר מקומי</button>
        </div>
      </div>
    `;

    const urlInput = app.querySelector("#serverUrlInput");
    const group = app.querySelector("#storageModeGroup");

    group?.addEventListener("change", (e)=>{
      const v = app.querySelector('input[name="storageMode"]:checked')?.value || "local";
      state.settings.storageMode = (v === "server") ? "server" : "local";
      updateSide();
    });

    app.querySelector("#btnSaveSettings")?.addEventListener("click", ()=>{
      const mode = app.querySelector('input[name="storageMode"]:checked')?.value || "local";
      const url = String(urlInput?.value || "").trim();

      state.settings.storageMode = (mode === "server") ? "server" : "local";
      state.settings.serverUrl = url;

      localStorage.setItem(STORAGE_MODE_KEY, state.settings.storageMode);
      localStorage.setItem(SERVER_URL_KEY, state.settings.serverUrl);

      if (state.settings.storageMode === "server" && !state.settings.serverUrl){
        toast("נבחר SERVER אבל אין URL — נשאיר בינתיים LOCAL.");
        state.settings.storageMode = "local";
        localStorage.setItem(STORAGE_MODE_KEY, "local");
        // update radios
        const r = app.querySelector('input[name="storageMode"][value="local"]');
        if (r) r.checked = true;
      } else {
        toast("הגדרות נשמרו ✅");
      }
      renderSettings();
    });

    app.querySelector("#btnClearLocal")?.addEventListener("click", ()=>{
      if (!confirm("לנקות את כל התיקים השמורים והטיוטה במחשב הזה?")) return;
      localStorage.removeItem("GICRM_CASES");
      localStorage.removeItem("GICRM_DRAFT");
      toast("נוקה מאגר מקומי ✅");
      renderSettings();
    });

  }
  // ----- Persistence -----
  function saveDraft(){
    Storage.saveDraft(state.case);
    toast("טיוטה נשמרה ✅");
  }

  function loadDraft(){
    const rawObj = Storage.loadDraft();
    const raw = rawObj ? JSON.stringify(rawObj) : null;
    if (!raw){
      toast("אין טיוטה שמורה.");
      return;
    }
    try{
      state.case = JSON.parse(raw);
      // back-compat guards
      if (!state.case.client) state.case.client = blankPerson();
      if (!state.case.secondary) state.case.secondary = blankPerson();
        if (state.case.cancellations) state.case.cancellations.secondary = [];
      if (!state.case.children) state.case.children = [];
      if (!state.case.products) state.case.products = [];
      // back-compat: insuredFor
      (state.case.products||[]).forEach(p=>{ if (!p.insuredFor) p.insuredFor = "primary"; });
      if (!state.case.medical) state.case.medical = {};
      if (!state.case.payment) state.case.payment = blankPayment();
      if (!state.case.step) state.case.step = "details";
      toast("טיוטה נטענה ✅");
      render();
    }catch{
      toast("שגיאה בטעינת טיוטה.");
    }
  }

  function saveFinal(){
    const payload = JSON.parse(JSON.stringify(state.case));
    Storage.saveCase(payload);
  }

  
  // =========================
  // Storage Adapter (LOCAL now, SERVER later)
  // =========================
  const Storage = {
    mode(){ return state.settings?.storageMode === "server" ? "server" : "local"; },
    serverUrl(){ return String(state.settings?.serverUrl || "").trim(); },

    // Saved cases (archive)
    listCases(){
      if (this.mode() === "server") return this._server_not_ready();
      return safeParse(localStorage.getItem("GICRM_CASES"), []);
    },
    saveCase(payload){
      if (this.mode() === "server") return this._server_not_ready();
      const list = safeParse(localStorage.getItem("GICRM_CASES"), []);
      const copy = JSON.parse(JSON.stringify(payload));
      copy.savedAtISO = new Date().toISOString();
      const idx = list.findIndex(x => x.caseId === copy.caseId);
      if (idx >= 0) list[idx] = copy;
      else list.unshift(copy);
      localStorage.setItem("GICRM_CASES", JSON.stringify(list));
      return copy.caseId;
    },
    deleteCase(caseId){
      if (this.mode() === "server") return this._server_not_ready();
      const list = safeParse(localStorage.getItem("GICRM_CASES"), []);
      const next = list.filter(x => x.caseId !== caseId);
      Storage.deleteCase(id);
      return true;
    },

    // Draft
    saveDraft(payload){
      if (this.mode() === "server") return this._server_not_ready();
      localStorage.setItem("GICRM_DRAFT", JSON.stringify(payload));
      return true;
    },
    loadDraft(){
      if (this.mode() === "server") return this._server_not_ready();
      const rawObj = Storage.loadDraft();
    const raw = rawObj ? JSON.stringify(rawObj) : null;
      if (!raw) return null;
      try{ return JSON.parse(raw); }catch{ return null; }
    },

    _server_not_ready(){
      toast("מצב SERVER עדיין לא פעיל — כרגע עובדים מקומי. נכניס Apps Script בהמשך ✅");
      return null;
    }
  };

function safeParse(raw, fallback){
    if (!raw) return fallback;
    try{ return JSON.parse(raw); }catch{ return fallback; }
  }

  // ----- Events -----
  stepper.addEventListener("click", (e)=>{
    const btn = e.target.closest(".step");
    if (!btn) return;
    const step = btn.dataset.step;

    // soft guard: prevent jumping to payment/summary if missing essentials
    if (step === "cancellations"){
      if (!state.case.client.firstName || !state.case.client.lastName || !state.case.client.idNumber){
        toast("קודם השלם פרטים בסיסיים (שם/ת״ז).");
        return;
      }
    }
    if (step === "products"){
      if (!state.case.client.firstName || !state.case.client.lastName || !state.case.client.idNumber){
        toast("קודם השלם פרטים בסיסיים (שם/ת״ז).");
        return;
      }
    }
    if (step === "questionnaires"){
      if (state.case.products.length === 0){
        toast("קודם הוסף מוצרים.");
        return;
      }
    }
    if (step === "payment"){
      if (state.case.products.length === 0){
        toast("קודם הוסף מוצרים.");
        return;
      }
    }
    setStep(step);
  });

  btnSaveDraft.addEventListener("click", saveDraft);
  btnLoadDraft.addEventListener("click", loadDraft);
  btnGoFinish.addEventListener("click", ()=> setStep("summary"));

  // Sidebar nav
  document.querySelectorAll(".navItem").forEach(item=>{
    item.addEventListener("click", ()=>{
      const nav = item.dataset.nav;
      if (!nav) return;
      setView(nav);
    });
  });

  // Init
  // Ensure at least one product? not by default
  setView("case");
  updateSide();
  render();
})();
