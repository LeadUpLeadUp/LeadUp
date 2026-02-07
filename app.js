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
  const btnToggleFocus = $("btnToggleFocus");

  const COMPANIES = [
    "הפניקס","מגדל","הראל","כלל","מנורה","הכשרה","מדיקר","איילון","ישיר","אחר"
  ];

  // Default questionnaires (placeholder - ready to map per company|product)
  const QUESTION_SET_DEFAULT = [
    { id:"q_bg",   title:"מחלות רקע", desc:"האם קיימות מחלות רקע?", follow:"פרט מחלות רקע / תאריך אבחנה / טיפול" },
    { id:"q_hosp", title:"אשפוזים", desc:"האם בוצעו אשפוזים בשנים האחרונות?", follow:"פרט אשפוזים / תאריכים / סיבה" },
    { id:"q_meds", title:"תרופות קבועות", desc:"האם נוטל תרופות קבועות?", follow:"פרט שמות תרופות + מינון" },
    { id:"q_fam",  title:"היסטוריה משפחתית", desc:"האם קיימת היסטוריה רפואית משפחתית?",
      follow:"פרט היסטוריה רפואית משפחתית" },
  ];

  // Extended questionnaire blocks (added automatically for higher premiums / "heavy" products)
  const QUESTION_SET_LONG_EXTRA = [
    { id:"q_cancer", title:"סרטן/גידולים", desc:"האם הייתה אבחנה של סרטן/גידולים?", follow:"פרט סוג/תאריך/טיפול/מצב נוכחי" },
    { id:"q_heart",  title:"לב וכלי דם", desc:"האם קיימת מחלת לב/אירוע לבבי/צנתור?", follow:"פרט תאריך/הליך/תרופות/מעקב" },
    { id:"q_resp",   title:"מערכת נשימה", desc:"האם יש אסטמה/מחלת ריאות/קוצר נשימה כרוני?", follow:"פרט מצב/טיפול/אשפוזים" },
    { id:"q_mental", title:"בריאות הנפש", desc:"האם קיימת אבחנה/טיפול בתחום בריאות הנפש?", follow:"פרט אבחנה/טיפול/תרופות/משך" },
    { id:"q_back",   title:"גב/אורתופדיה", desc:"האם קיימות בעיות גב/פריצות דיסק/כאבים כרוניים?", follow:"פרט אבחנה/טיפול/מגבלות" },
    { id:"q_preg",   title:"הריון/לידה", desc:"לנשים: האם קיימים סיבוכי הריון/לידה בעבר?", follow:"פרט תאריכים/סיבוכים/טיפולים" },
    { id:"q_bmi",    title:"גובה/משקל", desc:"האם קיימת השמנה משמעותית/ירידה חריגה במשקל?", follow:"פרט משקל/גובה/מועד/בירור" },
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

  const FOCUS_MODE_KEY = "GICRM_FOCUS_MODE"; // "1" | "0"

  function getFocusMode(){
    const v = localStorage.getItem(FOCUS_MODE_KEY);
    // default: focus ON (full-width CRM filling)
    return v === null ? true : (v === "1");
  }
  function setFocusMode(on){
    state.ui.focusMode = !!on;
    localStorage.setItem(FOCUS_MODE_KEY, state.ui.focusMode ? "1" : "0");
    applyLayout();
  }

  const state = {
    case: freshCase(),
    view: "case",
    settings: {
      storageMode: getStorageMode(),
      serverUrl: getServerUrl()
    },
    ui: {
      focusMode: getFocusMode()
    },
    savedQuery: ""
  };

  function freshCase(){
    return {
      id: `CASE-${Date.now()}`,
      status: "טיוטה",
      step: "details",

      primary: blankPerson(),
      hasSecondary: false,
      secondary: blankPerson(),
      children: [],

      // cancellations per insured
      cancellations: {
        primary: [],
        secondary: [],
        children: [] // array per child index
      },

      products: [], // {id, company, productName, premiumBefore, premiumAfter, insuredFor}
      medical: {},  // productId -> { qid: "yes|no|", followText }
      payment: blankPayment(),

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Helpers
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function num(v){
    const n = Number(String(v ?? "").replace(/[^\d.]/g,""));
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(v){
    const n = num(v);
    return n.toLocaleString("he-IL");
  }

  function toast(msg){
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> t.classList.remove("show"), 2600);
  }

  function insuredLabelFromCode(code){
    if (code === "primary") return "מבוטח ראשי";
    if (code === "secondary") return "מבוטח משני";
    if (String(code||"").startsWith("child:")){
      const idx = Number(String(code).split(":")[1] || "0");
      return `ילד ${idx+1}`;
    }
    return "—";
  }

  // View + Step
  function setView(view){
    state.view = view;
    document.querySelectorAll(".navItem").forEach(x=>x.classList.toggle("active", x.dataset.nav === view));
    if (view === "case"){
      caseHeader?.classList.remove("hidden");
      stepper?.classList.remove("hidden");
    } else {
      caseHeader?.classList.remove("hidden");
      stepper?.classList.add("hidden");
    }
    applyLayout();
    render();
  }

  function applyLayout(){
    const grid = document.querySelector(".grid");
    if (!grid) return;
    const inCase = (state.view === "case");
    const focus = inCase && !!state.ui.focusMode;
    grid.classList.toggle("focus", focus);

    if (btnToggleFocus){
      btnToggleFocus.textContent = focus ? "הצג בקרה" : "מסך מלא";
      btnToggleFocus.setAttribute("aria-pressed", focus ? "true" : "false");
    }
  }

  function setStep(step){
    state.case.step = step;
    state.case.updatedAt = new Date().toISOString();
    render();
  }

  // Router render
  function render(){
    applyLayout();

    if (state.view === "saved") { renderSaved(); return; }
    if (state.view === "settings") { renderSettings(); return; }

    stepper.classList.remove("hidden");

    // header chips
    caseTitle.textContent = (state.case.id ? "תיק פעיל" : "תיק חדש");
    caseIdChip.textContent = state.case.id || "—";
    caseStatusChip.textContent = state.case.status || "טיוטה";

    // stepper active
    document.querySelectorAll(".step").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.step === state.case.step);
    });

    // stage badges
    const stepLabel = {
      details:"פרטים",
      cancellations:"ביטול פוליסות",
      products:"מוצרים",
      questionnaires:"שאלונים",
      payment:"תשלום",
      summary:"סיום"
    }[state.case.step] || "פרטים";

    stageBadge.textContent = stepLabel;
    badgeStage.textContent = stepLabel;

    badgeProducts.textContent = String(state.case.products.length || 0);

    const totalAfter = (state.case.products||[]).reduce((a,p)=> a + num(p.premiumAfter), 0);
    badgeTotal.textContent = fmtMoney(totalAfter);

    badgeSecondary.textContent = state.case.hasSecondary ? "כן" : "לא";
    badgeChildren.textContent = String((state.case.children||[]).length);

    // missing list
    renderMissing();

    // step body
    switch (state.case.step){
      case "details":
        panelTitle.textContent = "פרטים אישיים";
        panelHint.textContent = "מלא פרטים של המבוטח הראשי + אופציונלי משני/ילדים.";
        renderDetailsActions();
        renderDetails();
        break;
      case "cancellations":
        panelTitle.textContent = "ביטול פוליסות קיימות";
        panelHint.textContent = "תיעוד פוליסות קיימות + פרמיות קודמות לפי מבוטח.";
        renderCancellationsActions();
        renderCancellations();
        break;
      case "products":
        panelTitle.textContent = "מוצרים בפוליסה החדשה";
        panelHint.textContent = "הוסף מוצרים חדשים ושייך לכל מבוטח (ראשי/משני/ילדים).";
        renderProductsActions();
        renderProducts();
        break;
      case "questionnaires":
        panelTitle.textContent = "שאלון רפואי לפי מוצר";
        panelHint.textContent = "ככל שהפרמיה גבוהה/מוצר כבד – השאלון מתרחב אוטומטית.";
        renderQuestionnairesActions();
        renderQuestionnaires();
        break;
      case "payment":
        panelTitle.textContent = "אמצעי תשלום";
        panelHint.textContent = "שמור רק פרטים מינימליים (למשל 4 ספרות אחרונות) + הערות.";
        renderPaymentActions();
        renderPayment();
        break;
      case "summary":
        panelTitle.textContent = "סיכום תיק";
        panelHint.textContent = "בדיקה אחרונה + ייצוא/שמירה.";
        renderSummaryActions();
        renderSummary();
        break;
      default:
        setStep("details");
    }
  }

  /* ========= Missing ========= */
  function renderMissing(){
    const missing = [];
    const p = state.case.primary || {};
    if (!p.firstName || !p.lastName) missing.push("מבוטח ראשי: שם מלא חסר");
    if (!p.idNumber) missing.push("מבוטח ראשי: ת״ז חסרה");

    if (state.case.products.length === 0) missing.push("לא הוספת מוצרים לפוליסה החדשה");

    // questionnaires: require yes/no answered for all questions shown
    if (state.case.step === "summary" || state.case.step === "payment" || state.case.step === "questionnaires"){
      state.case.products.forEach(prod=>{
        const qset = getQuestionnaireFor(prod);
        const ansObj = state.case.medical[prod.id] || {};
        qset.forEach(q=>{
          const ans = ansObj[q.id] || "";
          if (!ans) missing.push(`שאלון: חסרה תשובה (${prod.company || "—"} / ${prod.productName || "—"} / ${insuredLabelFromCode(prod.insuredFor)})`);
          if (ans === "yes" && !String(ansObj[`${q.id}__follow`] || "").trim()){
            missing.push(`שאלון: חסר פירוט ב-"${q.title}" (${prod.productName || "—"})`);
          }
        });
      });
    }

    missingList.innerHTML = missing.length
      ? missing.map(x => `<div class="notice">${esc(x)}</div>`).join("")
      : `<div class="notice">הכל נראה תקין ✅</div>`;
  }

  /* ========= Details ========= */
  function renderDetailsActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnAddChild" type="button">הוסף ילד</button>
      <button class="btn" id="btnToggleSecondary" type="button">${state.case.hasSecondary ? "הסר משני" : "הוסף משני"}</button>
      <button class="btn primary" id="btnNextToC" type="button">המשך לביטולים</button>
    `;
    panelActions.querySelector("#btnAddChild").addEventListener("click", ()=>{
      state.case.children.push(blankPerson());
      toast("ילד נוסף ✅");
      render();
    });
    panelActions.querySelector("#btnToggleSecondary").addEventListener("click", ()=>{
      state.case.hasSecondary = !state.case.hasSecondary;
      toast(state.case.hasSecondary ? "מבוטח משני נוסף ✅" : "מבוטח משני הוסר");
      render();
    });
    panelActions.querySelector("#btnNextToC").addEventListener("click", ()=> setStep("cancellations"));
  }

  function personForm(prefix, person){
    const f = (k) => `${prefix}.${k}`;
    return `
      <div class="card">
        <div class="cardTitle">${esc(prefix)}</div>
        <div class="formGrid3">
          ${fieldText("שם פרטי", f("firstName"), person.firstName)}
          ${fieldText("שם משפחה", f("lastName"), person.lastName)}
          ${fieldText("ת״ז", f("idNumber"), person.idNumber)}
          ${fieldText("תאריך לידה", f("birthDate"), person.birthDate, "date")}
          ${fieldText("גיל", f("age"), person.age, "number")}
          ${fieldSelect("מגדר", f("gender"), person.gender, ["","זכר","נקבה","אחר"])}
          ${fieldSelect("מעשן", f("smoker"), person.smoker, ["","לא","כן","לשעבר"])}
          ${fieldText("טלפון", f("phone"), person.phone)}
          ${fieldText("אימייל", f("email"), person.email, "email")}
          ${fieldText("עיר", f("city"), person.city)}
          ${fieldText("כתובת", f("address"), person.address)}
          ${fieldText("גובה (ס״מ)", f("heightCm"), person.heightCm, "number")}
          ${fieldText("משקל (ק״ג)", f("weightKg"), person.weightKg, "number")}
        </div>
      </div>
    `;
  }

  function renderDetails(){
    const out = [];
    out.push(personForm("מבוטח ראשי", state.case.primary));

    if (state.case.hasSecondary){
      out.push(personForm("מבוטח משני", state.case.secondary));
    }

    (state.case.children||[]).forEach((ch, i)=>{
      out.push(`
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">ילד ${i+1}</div>
              <div class="cardMeta">פרטי הילד</div>
            </div>
            <button class="smallBtn" data-del-child="${i}" type="button">מחק</button>
          </div>
          <div class="formGrid3">
            ${fieldText("שם פרטי", `child.${i}.firstName`, ch.firstName)}
            ${fieldText("שם משפחה", `child.${i}.lastName`, ch.lastName)}
            ${fieldText("ת״ז", `child.${i}.idNumber`, ch.idNumber)}
            ${fieldText("תאריך לידה", `child.${i}.birthDate`, ch.birthDate, "date")}
            ${fieldText("גיל", `child.${i}.age`, ch.age, "number")}
            ${fieldSelect("מגדר", `child.${i}.gender`, ch.gender, ["","זכר","נקבה","אחר"])}
          </div>
        </div>
      `);
    });

    app.innerHTML = out.join("");

    document.querySelectorAll("[data-del-child]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.dataset.delChild);
        state.case.children.splice(i,1);
        toast("ילד הוסר");
        render();
      });
    });

    wireDetailsInputs();
  }

  function wireDetailsInputs(){
    app.querySelectorAll("input,select,textarea").forEach(el=>{
      el.addEventListener("input", ()=>{
        const key = el.dataset.key;
        if (!key) return;
        const v = el.value;

        if (key.startsWith("מבוטח ראשי.")){
          setPersonField(state.case.primary, key.split(".")[1], v);
        } else if (key.startsWith("מבוטח משני.")){
          setPersonField(state.case.secondary, key.split(".")[1], v);
        } else if (key.startsWith("child.")){
          const parts = key.split(".");
          const idx = Number(parts[1]);
          const field = parts[2];
          if (state.case.children[idx]) setPersonField(state.case.children[idx], field, v);
        }
        state.case.updatedAt = new Date().toISOString();
      });
    });
  }

  function setPersonField(obj, field, value){
    obj[field] = value;
  }

  /* ========= Cancellations ========= */
  function renderCancellationsActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnAddCancel" type="button">הוסף פוליסה לביטול</button>
      <button class="btn primary" id="btnNextToP" type="button">המשך למוצרים</button>
    `;
    panelActions.querySelector("#btnAddCancel").addEventListener("click", ()=>{
      addCancellation();
      toast("פוליסה נוספה ✅");
      render();
    });
    panelActions.querySelector("#btnNextToP").addEventListener("click", ()=> setStep("products"));
  }

  function addCancellation(){
    const target = "primary";
    if (!state.case.cancellations[target]) state.case.cancellations[target] = [];
    state.case.cancellations[target].push({
      company:"",
      product:"",
      premium:"",
      cancelType:"מלא",
      notes:""
    });
  }

  function getInsuredOptions(){
    const opts = [ {value:"", label:"בחר..."} , {value:"primary", label:"מבוטח ראשי"} ];
    if (state.case.hasSecondary) opts.push({value:"secondary", label:"מבוטח משני"});
    (state.case.children||[]).forEach((ch, i)=>{
      opts.push({value:`child:${i}`, label:`ילד ${i+1}`});
    });
    return opts;
  }

  function renderCancellations(){
    app.innerHTML = `
      <div class="notice">טיפ: הוסף כאן פוליסות קיימות + פרמיות ששולמו לפני העסקה.</div>
      ${renderInsuredComparisonSummary()}
      ${renderCancellationsLists()}
    `;
    wireCancellations();
  }

  function renderInsuredComparisonSummary(){
    return `
      <div class="card">
        <div class="cardTitle">מבוטחים בתיק</div>
        <div class="cardMeta">ראשי/משני/ילדים + מצב הפוליסות לביטול</div>
      </div>
    `;
  }

  function renderCancellationsLists(){
    const sections = [];

    const buildList = (label, list, insuredCode) => {
      const items = (list||[]).map((c, idx)=>`
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">${esc(label)} • פוליסה ${idx+1}</div>
              <div class="cardMeta">ביטול/העברה • פרמיות לפני העסקה</div>
            </div>
            <button class="smallBtn" data-del-cancel="${insuredCode}:${idx}" type="button">מחק</button>
          </div>

          <div class="formGrid4">
            ${fieldSelect("חברה", `cancel.${insuredCode}.${idx}.company`, c.company, ["",...COMPANIES])}
            ${fieldText("מוצר", `cancel.${insuredCode}.${idx}.product`, c.product)}
            ${fieldText("פרמיה", `cancel.${insuredCode}.${idx}.premium`, c.premium, "number")}
            ${fieldSelect("סוג ביטול", `cancel.${insuredCode}.${idx}.cancelType`, c.cancelType, ["מלא","חלקי","הקפאה","אחר"])}
          </div>
          ${fieldText("הערות", `cancel.${insuredCode}.${idx}.notes`, c.notes)}
        </div>
      `).join("");

      return `
        <div class="card">
          <div class="cardTitle">${esc(label)}</div>
          <div class="cardMeta">${items ? "רשימת פוליסות לביטול" : "אין פוליסות עדיין"}</div>
        </div>
        ${items || `<div class="notice">אין עדיין פוליסות לביטול עבור ${esc(label)}.</div>`}
      `;
    };

    sections.push(buildList("מבוטח ראשי", state.case.cancellations.primary || [], "primary"));

    if (state.case.hasSecondary){
      sections.push(buildList("מבוטח משני", state.case.cancellations.secondary || [], "secondary"));
    }

    (state.case.children||[]).forEach((ch, i)=>{
      if (!state.case.cancellations.children[i]) state.case.cancellations.children[i] = [];
      sections.push(buildList(`ילד ${i+1}`, state.case.cancellations.children[i], `child:${i}`));
    });

    return sections.join("");
  }

  function wireCancellations(){
    app.querySelectorAll("input,select,textarea").forEach(el=>{
      el.addEventListener("input", ()=>{
        const key = el.dataset.key;
        if (!key) return;
        const v = el.value;

        if (key.startsWith("cancel.")){
          const parts = key.split(".");
          const insuredCode = parts[1];
          const idx = Number(parts[2]);
          const field = parts[3];

          const target = insuredCode === "primary" ? state.case.cancellations.primary
                      : insuredCode === "secondary" ? (state.case.cancellations.secondary || (state.case.cancellations.secondary = []))
                      : insuredCode.startsWith("child:") ? (state.case.cancellations.children[Number(insuredCode.split(":")[1])] || (state.case.cancellations.children[Number(insuredCode.split(":")[1])] = []))
                      : null;

          if (target && target[idx]) target[idx][field] = v;
        }

        state.case.updatedAt = new Date().toISOString();
      });
    });

    document.querySelectorAll("[data-del-cancel]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const [code, idxStr] = String(btn.dataset.delCancel).split(":");
        const idx = Number(idxStr);

        if (code === "primary"){
          state.case.cancellations.primary.splice(idx,1);
        } else if (code === "secondary"){
          (state.case.cancellations.secondary||[]).splice(idx,1);
        } else if (code === "child"){
          // handled below
        } else if (String(btn.dataset.delCancel).startsWith("child:")){
          const childIdx = Number(String(btn.dataset.delCancel).split(":")[1]);
          const itemIdx = Number(String(btn.dataset.delCancel).split(":")[2]);
          (state.case.cancellations.children[childIdx]||[]).splice(itemIdx,1);
        }
        toast("נמחק ✅");
        render();
      });
    });
  }

  /* ========= Products ========= */
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
    app.innerHTML = state.case.products.map((p, idx)=>`
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">מוצר ${idx+1}</div>
            <div class="cardMeta">${esc(insuredLabelFromCode(p.insuredFor))}</div>
          </div>
          <button class="smallBtn" data-del-prod="${idx}" type="button">מחק</button>
        </div>

        <div class="formGrid3">
          ${fieldSelect("חברה", `prod.${idx}.company`, p.company, ["",...COMPANIES])}
          ${fieldText("שם מוצר", `prod.${idx}.productName`, p.productName)}
          ${fieldSelect("למי שייך", `prod.${idx}.insuredFor`, p.insuredFor, getInsuredOptions().map(x=>x.value))}
        </div>

        <div class="formGrid3">
          ${fieldText("פרמיה לפני", `prod.${idx}.premiumBefore`, p.premiumBefore, "number")}
          ${fieldText("פרמיה אחרי", `prod.${idx}.premiumAfter`, p.premiumAfter, "number")}
          <div class="field">
            <div class="label">רמז שאלון</div>
            <div class="notice">${getQuestionnaireHint(p)}</div>
          </div>
        </div>
      </div>
    `).join("");

    app.querySelectorAll("[data-del-prod]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const idx = Number(btn.dataset.delProd);
        const pid = state.case.products[idx]?.id;
        state.case.products.splice(idx,1);
        if (pid) delete state.case.medical[pid];
        toast("מוצר נמחק");
        render();
      });
    });

    app.querySelectorAll("input,select").forEach(el=>{
      el.addEventListener("input", ()=>{
        const key = el.dataset.key;
        if (!key) return;
        const v = el.value;

        if (key.startsWith("prod.")){
          const parts = key.split(".");
          const idx = Number(parts[1]);
          const field = parts[2];
          if (state.case.products[idx]) state.case.products[idx][field] = v;
          // ensure medical bucket exists
          const pid = state.case.products[idx]?.id;
          if (pid && !state.case.medical[pid]) state.case.medical[pid] = {};
        }
        state.case.updatedAt = new Date().toISOString();
        renderMissing();
      });
    });
  }

  function getQuestionnaireHint(product){
    const premAfter  = num(product.premiumAfter);
    const premBefore = num(product.premiumBefore);
    const pname = String(product.productName||"");
    const heavyKw = ["בריאות","חיים","אכ״ע","אכע","סיעוד","משכנתא","מנהלים"];
    const isHeavy = heavyKw.some(k => pname.includes(k));
    const wantsLong = isHeavy || premAfter >= 250 || (premAfter - premBefore) >= 150;
    return wantsLong ? "שאלון מורחב (פרמיה/מוצר כבד)" : "שאלון קצר";
  }

  /* ========= Questionnaires ========= */
  function renderQuestionnairesActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnBackToP" type="button">חזרה למוצרים</button>
      <button class="btn primary" id="btnNextToPay" type="button">המשך לתשלום</button>
    `;
    panelActions.querySelector("#btnBackToP").addEventListener("click", ()=> setStep("products"));
    panelActions.querySelector("#btnNextToPay").addEventListener("click", ()=>{
      // validate questionnaire: all answered + follow text when yes
      for (const p of state.case.products){
        const qset = getQuestionnaireFor(p);
        const ansObj = state.case.medical[p.id] || {};
        for (const q of qset){
          const ans = ansObj[q.id] || "";
          if (!ans){
            toast(`חסרה תשובה בשאלון (${p.productName || "מוצר"}).`);
            return;
          }
          if (ans === "yes" && !String(ansObj[`${q.id}__follow`] || "").trim()){
            toast(`חסר פירוט ב-"${q.title}" (${p.productName || "מוצר"}).`);
            return;
          }
        }
      }
      setStep("payment");
    });
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
          <div class="notice">${esc(getQuestionnaireHint(p))} • ${qset.length} שאלות</div>
        </div>

        ${qset.map(q => questionnaireCard(p.id, q)).join("")}
      `;
    }).join("");

    wireQuestionnaire();
  }

  // Questionnaire mapping bank
  const QUESTION_BANK = {
    "*|*": QUESTION_SET_DEFAULT,

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

    const baseName = (() => {
      const known = ["בריאות","חיים","אכ״ע","אכע","סיעוד","משכנתא","תאונות","נסיעות","שיניים","ריסק","מנהלים","גמל","פנסיה"];
      const hit = known.find(k => pname.includes(k));
      return hit || pname;
    })();

    const exact = `${company}|${baseName}`;
    const companyDefault = `${company}|*`;

    const bank =
      QUESTION_BANK[exact]
      || QUESTION_BANK[`${company}|${pname}`]
      || QUESTION_BANK[companyDefault]
      || QUESTION_BANK["*|*"]
      || QUESTION_SET_DEFAULT;

    const premAfter  = num(product.premiumAfter);
    const premBefore = num(product.premiumBefore);
    const heavyKw = ["בריאות","חיים","אכ״ע","אכע","סיעוד","משכנתא","מנהלים"];
    const isHeavy = heavyKw.some(k => (baseName||"").includes(k) || (pname||"").includes(k));

    const wantsLong = isHeavy || premAfter >= 250 || (premAfter - premBefore) >= 150;

    if (!wantsLong) return bank;

    const seen = new Set();
    const merged = [];
    [...bank, ...QUESTION_SET_LONG_EXTRA].forEach(q=>{
      if (!q || !q.id) return;
      if (seen.has(q.id)) return;
      seen.add(q.id);
      merged.push(q);
    });
    return merged;
  }

  function questionnaireCard(productId, q){
    const ans = (state.case.medical[productId] || {})[q.id] || "";
    const yesActive = ans === "yes";
    const noActive  = ans === "no";
    const followVal = (state.case.medical[productId] || {})[`${q.id}__follow`] || "";

    return `
      <div class="card">
        <div class="cardTitle">${esc(q.title)}</div>
        <div class="cardMeta">${esc(q.desc || "")}</div>

        <div class="formGrid">
          <div class="field">
            <div class="label">תשובה</div>
            <select class="select" data-q="${esc(q.id)}" data-p="${esc(productId)}">
              <option value="">בחר...</option>
              <option value="yes" ${yesActive ? "selected":""}>כן</option>
              <option value="no"  ${noActive ? "selected":""}>לא</option>
            </select>
          </div>
          <div class="field">
            <div class="label">פירוט (נדרש אם כן)</div>
            <input class="input" data-follow="${esc(q.id)}" data-p="${esc(productId)}" value="${esc(followVal)}" placeholder="${esc(q.follow || "פרט...")}" />
          </div>
        </div>
      </div>
    `;
  }

  function wireQuestionnaire(){
    app.querySelectorAll("[data-q]").forEach(sel=>{
      sel.addEventListener("change", ()=>{
        const qid = sel.dataset.q;
        const pid = sel.dataset.p;
        if (!qid || !pid) return;
        if (!state.case.medical[pid]) state.case.medical[pid] = {};
        state.case.medical[pid][qid] = sel.value;
        state.case.updatedAt = new Date().toISOString();
        renderMissing();
      });
    });

    app.querySelectorAll("[data-follow]").forEach(inp=>{
      inp.addEventListener("input", ()=>{
        const qid = inp.dataset.follow;
        const pid = inp.dataset.p;
        if (!qid || !pid) return;
        if (!state.case.medical[pid]) state.case.medical[pid] = {};
        state.case.medical[pid][`${qid}__follow`] = inp.value;
        state.case.updatedAt = new Date().toISOString();
        renderMissing();
      });
    });
  }

  /* ========= Payment ========= */
  function renderPaymentActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnBackToQ" type="button">חזרה לשאלונים</button>
      <button class="btn primary" id="btnNextToS" type="button">המשך לסיכום</button>
    `;
    panelActions.querySelector("#btnBackToQ").addEventListener("click", ()=> setStep("questionnaires"));
    panelActions.querySelector("#btnNextToS").addEventListener("click", ()=> setStep("summary"));
  }

  function renderPayment(){
    const p = state.case.payment || blankPayment();
    state.case.payment = p;

    app.innerHTML = `
      <div class="card">
        <div class="cardTitle">פרטי תשלום</div>
        <div class="cardMeta">לא שומרים פרטי כרטיס מלאים. רק מינימום נדרש.</div>

        <div class="formGrid3">
          ${fieldSelect("שיטה", "pay.method", p.method, ["","אשראי","הוראת קבע","העברה","צ׳ק","אחר"])}
          ${fieldText("שם משלם", "pay.payerName", p.payerName)}
          ${fieldText("ת״ז משלם", "pay.payerId", p.payerId)}
        </div>

        <div class="formGrid3">
          ${fieldText("4 ספרות אחרונות", "pay.cardLast4", p.cardLast4, "text")}
          ${fieldText("הערות", "pay.notes", p.notes)}
          <div class="field"><div class="label"> </div><div class="notice">אפשר להמשיך לסיכום גם אם חסר חלק — אבל מומלץ להשלים.</div></div>
        </div>
      </div>
    `;

    app.querySelectorAll("input,select,textarea").forEach(el=>{
      el.addEventListener("input", ()=>{
        const key = el.dataset.key;
        if (!key) return;
        const v = el.value;
        if (key.startsWith("pay.")){
          const field = key.split(".")[1];
          state.case.payment[field] = v;
        }
        state.case.updatedAt = new Date().toISOString();
      });
    });
  }

  /* ========= Summary ========= */
  function renderSummaryActions(){
    panelActions.innerHTML = `
      <button class="btn" id="btnBackToPay" type="button">חזרה לתשלום</button>
      <button class="btn primary" id="btnSaveCase" type="button">שמור תיק</button>
    `;
    panelActions.querySelector("#btnBackToPay").addEventListener("click", ()=> setStep("payment"));
    panelActions.querySelector("#btnSaveCase").addEventListener("click", saveDraft);
  }

  function renderSummary(){
    const totalAfter = (state.case.products||[]).reduce((a,p)=> a + num(p.premiumAfter), 0);

    app.innerHTML = `
      <div class="card">
        <div class="cardTitle">סיכום</div>
        <div class="cardMeta">בדיקה אחרונה לפני שמירה / ייצוא.</div>
      </div>

      <div class="card">
        <div class="cardTitle">סה״כ פרמיה אחרי</div>
        <div class="notice">${fmtMoney(totalAfter)} ₪</div>
      </div>

      ${renderSummaryProducts()}
      ${renderSummaryQuestionnaires()}
    `;
  }

  function renderSummaryProducts(){
    if (!state.case.products.length){
      return `<div class="notice">אין מוצרים.</div>`;
    }
    return state.case.products.map((p, idx)=>`
      <div class="card">
        <div class="cardTitle">מוצר ${idx+1}: ${esc(p.company || "—")} • ${esc(p.productName || "—")}</div>
        <div class="cardMeta">${esc(insuredLabelFromCode(p.insuredFor))}</div>
        <div class="formGrid3">
          <div class="notice">לפני: ${fmtMoney(p.premiumBefore)} ₪</div>
          <div class="notice">אחרי: ${fmtMoney(p.premiumAfter)} ₪</div>
          <div class="notice">${esc(getQuestionnaireHint(p))}</div>
        </div>
      </div>
    `).join("");
  }

  function renderSummaryQuestionnaires(){
    const blocks = [];
    for (const p of state.case.products){
      const qset = getQuestionnaireFor(p);
      const ans = state.case.medical[p.id] || {};
      blocks.push(`
        <div class="card">
          <div class="cardTitle">שאלון: ${esc(p.productName || "—")} (${esc(insuredLabelFromCode(p.insuredFor))})</div>
          <div class="cardMeta">${esc(p.company || "—")} • ${qset.length} שאלות</div>
          ${qset.map(q=>{
            const a = ans[q.id] || "—";
            const follow = ans[`${q.id}__follow`] || "";
            return `<div class="notice"><b>${esc(q.title)}:</b> ${esc(a)} ${a==="yes" ? `— <span class="mono">${esc(follow || "חסר פירוט")}</span>`:""}</div>`;
          }).join("")}
        </div>
      `);
    }
    return blocks.join("");
  }

  /* ========= Saved / Settings ========= */
  function loadAllSaved(){
    try{
      const raw = localStorage.getItem("GICRM_SAVED_CASES") || "[]";
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }
  function saveAllSaved(arr){
    localStorage.setItem("GICRM_SAVED_CASES", JSON.stringify(arr || []));
  }

  function saveDraft(){
    const all = loadAllSaved();
    const copy = JSON.parse(JSON.stringify(state.case));
    copy.updatedAt = new Date().toISOString();
    const idx = all.findIndex(x=>x.id === copy.id);
    if (idx >= 0) all[idx] = copy; else all.unshift(copy);
    saveAllSaved(all);
    toast("נשמר ✅");
  }

  function loadDraft(){
    const all = loadAllSaved();
    if (!all.length){
      toast("אין תיקים שמורים.");
      return;
    }
    state.case = all[0];
    toast("טעינה ✅");
    setView("case");
    setStep(state.case.step || "details");
  }

  function renderSaved(){
    const all = loadAllSaved();
    app.innerHTML = `
      <div class="card">
        <div class="cardTitle">תיקים שמורים</div>
        <div class="cardMeta">ניהול תיקים שנשמרו בדפדפן</div>
      </div>
      ${all.length ? all.map((c)=>`
        <div class="card">
          <div class="cardTop">
            <div>
              <div class="cardTitle">${esc(c.id)}</div>
              <div class="cardMeta">${esc(c.status || "טיוטה")} • עודכן: ${esc(String(c.updatedAt||"").slice(0,19).replace("T"," "))}</div>
            </div>
            <button class="smallBtn" data-open="${esc(c.id)}" type="button">פתח</button>
          </div>
        </div>
      `).join("") : `<div class="notice">אין תיקים.</div>`}
    `;

    app.querySelectorAll("[data-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.open;
        const all = loadAllSaved();
        const found = all.find(x=>x.id === id);
        if (!found){ toast("לא נמצא"); return; }
        state.case = found;
        toast("נפתח ✅");
        setView("case");
        setStep(state.case.step || "details");
      });
    });

    panelActions.innerHTML = "";
    panelTitle.textContent = "תיקים שמורים";
    panelHint.textContent = "פתח תיק קיים או חזור לתיק הפעיל.";
  }

  function renderSettings(){
    const s = state.settings;
    app.innerHTML = `
      <div class="card">
        <div class="cardTitle">הגדרות</div>
        <div class="cardMeta">מצב שמירה מקומי / שרת (בהמשך Apps Script)</div>
      </div>

      <div class="card">
        <div class="formGrid3">
          ${fieldSelect("Storage", "set.storageMode", s.storageMode, ["local","server"])}
          ${fieldText("Server URL", "set.serverUrl", s.serverUrl)}
          <div class="field"><div class="label"> </div><div class="notice">כרגע נשמר מקומית. שרת יופעל כשנחבר Web App.</div></div>
        </div>
      </div>
    `;

    app.querySelectorAll("input,select").forEach(el=>{
      el.addEventListener("input", ()=>{
        const key = el.dataset.key;
        const v = el.value;
        if (key === "set.storageMode"){
          state.settings.storageMode = v === "server" ? "server" : "local";
          localStorage.setItem(STORAGE_MODE_KEY, state.settings.storageMode);
        }
        if (key === "set.serverUrl"){
          state.settings.serverUrl = v;
          localStorage.setItem(SERVER_URL_KEY, state.settings.serverUrl);
        }
        toast("עודכן ✅");
      });
    });

    panelActions.innerHTML = "";
    panelTitle.textContent = "הגדרות";
    panelHint.textContent = "כאן נקשור בהמשך שרת (Sheets/DB).";
  }

  /* ========= Small UI Helpers ========= */
  function fieldText(label, key, val, type="text"){
    return `
      <div class="field">
        <div class="label">${esc(label)}</div>
        <input class="input" type="${esc(type)}" data-key="${esc(key)}" value="${esc(val||"")}" />
      </div>
    `;
  }
  function fieldSelect(label, key, val, options){
    const opts = (options||[]).map(o=>{
      const ov = typeof o === "string" ? o : (o.value ?? "");
      const ol = typeof o === "string" ? o : (o.label ?? o.value ?? "");
      return `<option value="${esc(ov)}" ${(String(val||"")===String(ov))?"selected":""}>${esc(ol||ov||"")}</option>`;
    }).join("");
    return `
      <div class="field">
        <div class="label">${esc(label)}</div>
        <select class="select" data-key="${esc(key)}">${opts}</select>
      </div>
    `;
  }

  /* ========= Init ========= */
  document.querySelectorAll(".step").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const s = btn.dataset.step;
      if (s) setStep(s);
    });
  });

  btnSaveDraft.addEventListener("click", saveDraft);
  btnLoadDraft.addEventListener("click", loadDraft);
  btnGoFinish.addEventListener("click", ()=> setStep("summary"));

  if (btnToggleFocus){
    btnToggleFocus.addEventListener("click", ()=>{
      setFocusMode(!state.ui.focusMode);
    });
  }

  // Sidebar nav
  document.querySelectorAll(".navItem").forEach(item=>{
    item.addEventListener("click", ()=>{
      const nav = item.dataset.nav;
      if (!nav) return;
      setView(nav);
    });
  });

  render();
})();
