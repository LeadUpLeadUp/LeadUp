
/* LEAD UP • UI Demo (Light Luxury) */
(function(){
  const $ = (q,root=document)=>root.querySelector(q);
  const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));

  // Active nav highlight
  const here = (location.pathname.split("/").pop() || "login.html").toLowerCase();
  $$('.nav a').forEach(a=>{
    const href = (a.getAttribute('href')||'').toLowerCase();
    if(href === here) a.classList.add('active');
  });

  // Mock data
  const mock = {
    leads: [
      { id:"L-1042", name:"ליאן כהן", phone:"050-1234567", status:"חדש", source:"פייסבוק", score:82, next:"2026-02-01" },
      { id:"L-1041", name:"אור דניאל", phone:"052-7654321", status:"הצעת מחיר", source:"הפניה", score:67, next:"2026-02-03" },
      { id:"L-1039", name:"שי לוי", phone:"054-3322110", status:"מתעניין", source:"גוגל", score:49, next:"2026-02-02" },
      { id:"L-1038", name:"נועה מזרחי", phone:"053-8899776", status:"נוצר קשר", source:"אתר", score:38, next:"2026-02-05" }
    ],
    tasks: [
      { when:"2026-02-01 10:30", prio:"גבוה", who:"ליאן כהן", text:"שיחת המשך – הצעת בריאות", status:"פתוחה" },
      { when:"2026-02-02 16:00", prio:"בינוני", who:"שי לוי", text:"איסוף מסמכים", status:"פתוחה" }
    ]
  };

  // Fill KPIs if present
  const kTotal = $('#kpiTotal'); if(kTotal) kTotal.textContent = String(mock.leads.length);
  const kHot = $('#kpiHot'); if(kHot) kHot.textContent = String(mock.leads.filter(l=>l.score>=75).length);
  const kToday = $('#kpiToday'); if(kToday) kToday.textContent = "1";
  const kTasks = $('#kpiTasks'); if(kTasks) kTasks.textContent = String(mock.tasks.length);

  // Render leads table
  const tbody = $('#leadsTbody');
  if(tbody){
    const badgeClass = (s)=> s>=75 ? "hot" : s>=45 ? "mid" : "cold";
    tbody.innerHTML = mock.leads.map(l=>`
      <tr>
        <td>${l.name}<div style="font-size:12px;color:rgba(20,20,27,.55);font-weight:800;margin-top:2px">${l.id}</div></td>
        <td>${l.phone}</td>
        <td><span class="badge ${badgeClass(l.score)}"><span class="dot"></span>${l.status}</span></td>
        <td>${l.source}</td>
        <td>${l.score}</td>
        <td>${l.next}</td>
        <td>
          <div class="rowActions">
            <button class="iconBtn" data-open="customer.html">📁 תיק</button>
            <button class="iconBtn">✏️ עריכה</button>
            <button class="iconBtn">⏰ משימה</button>
          </div>
        </td>
      </tr>
    `).join('');
    tbody.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-open]');
      if(!b) return;
      location.href = b.dataset.open;
    });
  }

  // Render tasks table (optional)
  const tt = $('#tasksTbody');
  if(tt){
    tt.innerHTML = mock.tasks.map(t=>`
      <tr>
        <td>${t.when}</td>
        <td>${t.prio}</td>
        <td>${t.who}</td>
        <td>${t.text}</td>
        <td>${t.status}</td>
        <td><div class="rowActions"><button class="iconBtn">✅ סגור</button><button class="iconBtn">✏️ ערוך</button></div></td>
      </tr>
    `).join('');
  }

  // Login
  const loginBtn = $('#loginBtn');
  if(loginBtn){
    loginBtn.addEventListener('click', ()=>{
      const pass = ($('#loginPass')?.value||'').trim();
      const err = $('#loginErr');
      if(pass === "3316"){
        sessionStorage.setItem("leadup_auth_ok","1");
        location.href = "leads.html";
      }else{
        if(err) err.textContent = "סיסמה שגויה";
      }
    });
    $('#loginPass')?.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); loginBtn.click(); }
    });
  }

  // Gate: if page requires auth
  const needsAuth = document.documentElement.dataset.needsAuth === "1";
  if(needsAuth){
    try{
      if(sessionStorage.getItem("leadup_auth_ok")!=="1"){
        location.replace("login.html");
      }
    }catch(e){}
  }
})();
