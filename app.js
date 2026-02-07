(() => {
  const $ = (id) => document.getElementById(id);

  const app = $("app");
  const stepper = $("stepper");
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

  const state = {
    case: freshCase(),
    view: "case"
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

  // ----- UI helpers -----
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
      const v = o ?? "";
      const txt = v === "" ? "בחר..." : v;
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
    // panel meta + actions
    const meta = ({
      details: { title:"פרטים אישיים", hint:"מלא פרטים של המבוטח הראשי + אופציונלי משני/ילדים.", actions: renderDetailsActions },
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
    if (state.case.step === "products") renderProducts();
    if (state.case.step === "questionnaires") renderQuestionnaires();
    if (state.case.step === "payment") renderPayment();
    if (state.case.step === "summary") renderSummary();

    updateSide();
  }

  function renderDetailsActions(){
    panelActions.innerHTML = `
      <button class="btn primary" id="btnNextToProducts" type="button">המשך למוצרים</button>
    `;
    panelActions.querySelector("#btnNextToProducts").addEventListener("click", ()=>{
      if (!state.case.client.firstName || !state.case.client.lastName || !state.case.client.idNumber){
        toast("חסר שם מלא/ת״ז במבוטח הראשי.");
        return;
      }
      setStep("products");
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
          state.case.children.splice(idx, 1);
          render();
        });
      });
    }

    bindPaths(app);
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
      premiumAfter:""
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
            <div class="cardMeta">${esc(p.company || "—")} • ${esc(p.productName || "—")} • ID: <span class="mono">${esc(p.id)}</span></div>
          </div>
          <button class="smallBtn" data-remove-product="${idx}" type="button">הסר</button>
        </div>

        <div class="formGrid" style="margin-top:12px">
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
              <div class="cardMeta">${esc(p.company || "—")} • ${esc(p.productName || "—")}</div>
            </div>
            <span class="chip mono">${esc(p.id)}</span>
          </div>
        </div>

        ${qset.map(q => questionnaireCard(p.id, q)).join("")}
      `;
    }).join("");

    wireQuestionnaire();
  }

  function getQuestionnaireFor(product){
    // placeholder mapping: later use `${company}|${productName}`
    return QUESTION_SET_DEFAULT;
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
      <button class="btn" id="btnPrint" type="button">הדפס</button>
      <button class="btn" id="btnCopy" type="button">העתק JSON</button>
      <button class="btn primary" id="btnSaveFinal" type="button">שמור תיק</button>
    `;

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

  // ----- Persistence -----
  function saveDraft(){
    localStorage.setItem("GICRM_DRAFT", JSON.stringify(state.case));
    toast("טיוטה נשמרה ✅");
  }

  function loadDraft(){
    const raw = localStorage.getItem("GICRM_DRAFT");
    if (!raw){
      toast("אין טיוטה שמורה.");
      return;
    }
    try{
      state.case = JSON.parse(raw);
      // back-compat guards
      if (!state.case.client) state.case.client = blankPerson();
      if (!state.case.secondary) state.case.secondary = blankPerson();
      if (!state.case.children) state.case.children = [];
      if (!state.case.products) state.case.products = [];
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
    const key = "GICRM_CASES";
    const list = safeParse(localStorage.getItem(key), []);
    const payload = JSON.parse(JSON.stringify(state.case));
    payload.savedAtISO = new Date().toISOString();
    const idx = list.findIndex(x => x.caseId === payload.caseId);
    if (idx >= 0) list[idx] = payload;
    else list.unshift(payload);
    localStorage.setItem(key, JSON.stringify(list));
  }

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

  // Sidebar nav (demo)
  document.querySelectorAll(".navItem").forEach(item=>{
    item.addEventListener("click", ()=>{
      document.querySelectorAll(".navItem").forEach(x=>x.classList.remove("active"));
      item.classList.add("active");
      toast("כרגע אנחנו עובדים על תיק פעיל. תיקים שמורים נפתח בהמשך.");
    });
  });

  // Init
  // Ensure at least one product? not by default
  updateSide();
  render();
})();
