const screens = [...document.querySelectorAll(".screen")];
const toast = document.getElementById("toast");
const installBtn = document.getElementById("installAppBtn");
let deferredPrompt = null;

const state = {
  userName: "",
  dog: { sex: "male" }
};

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function showScreen(id){
  screens.forEach(s => s.classList.toggle("active", s.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-next]").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.next));
});

document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.back));
});

document.getElementById("goRegister").addEventListener("click", () => showScreen("screenRegister"));

document.getElementById("togglePassword").addEventListener("click", () => {
  const input = document.getElementById("loginPassword");
  input.type = input.type === "password" ? "text" : "password";
});

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.userName = document.getElementById("loginEmail").value.split("@")[0] || "משתמש";
  showToast("התחברת בהצלחה");
  showScreen("screenWelcome");
});

document.getElementById("registerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.userName = document.getElementById("regName").value || "משתמש";
  showToast("ההרשמה הושלמה");
  showScreen("screenWelcome");
});

document.getElementById("googleLogin").addEventListener("click", () => {
  state.userName = "משתמש Google";
  showToast("התחברות Google תחובר בשלב הבא");
  showScreen("screenWelcome");
});

document.getElementById("googleRegister").addEventListener("click", () => {
  state.userName = "משתמש Google";
  showToast("הרשמת Google תחובר בשלב הבא");
  showScreen("screenWelcome");
});

document.querySelectorAll(".choice").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".choice").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.dog.sex = btn.dataset.sex;
  });
});

document.getElementById("dogForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.dog.name = document.getElementById("dogName").value || "הכלב שלך";
  state.dog.breed = document.getElementById("dogBreed").value;
  state.dog.age = document.getElementById("dogAge").value;
  state.dog.weight = document.getElementById("dogWeight").value;
  state.dog.notes = document.getElementById("dogNotes").value;
  showToast("פרופיל הכלב נשמר");
  showScreen("screenLocation");
});

document.getElementById("allowLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("המכשיר לא תומך במיקום");
    showScreen("screenInterests");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    () => {
      showToast("המיקום נשמר בהצלחה");
      showScreen("screenInterests");
    },
    () => {
      showToast("לא אושר מיקום, אפשר להמשיך");
      showScreen("screenInterests");
    },
    { enableHighAccuracy: true, timeout: 7000 }
  );
});

document.querySelectorAll(".service").forEach(btn => {
  btn.addEventListener("click", () => btn.classList.toggle("selected"));
});

document.querySelector('[data-next="screenHome"]').addEventListener("click", () => {
  document.getElementById("homeUserName").textContent = state.userName || "ברוך הבא";
  if (state.dog.name) {
    document.getElementById("dogReminderTitle").textContent = `${state.dog.name} מוכן לתור הטיפוח הבא`;
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) {
    showToast("בטלפון אפשר להוסיף למסך הבית דרך תפריט הדפדפן");
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  installBtn.classList.add("hidden");
  showToast("DoggyBot הותקנה בהצלחה");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}


/* ===== DoggyBot Full Merged v2 Navigation ===== */
const appNav = document.querySelector(".app-nav");

function setNavVisible(screenId){
  const shouldShow = ["screenHome","screenGroomers","screenAppointments","screenMyDog","screenDoggyWorld","screenProfile","screenGroomerDetails"].includes(screenId);
  if (appNav) appNav.classList.toggle("hidden", !shouldShow);
}

const originalShowScreen = showScreen;
showScreen = function(id){
  originalShowScreen(id);
  setNavVisible(id);

  document.querySelectorAll(".app-nav button").forEach(btn => {
    const target = btn.dataset.tabTarget;
    let active = target === id;
    if (id === "screenGroomerDetails" && target === "screenGroomers") active = true;
    btn.classList.toggle("active", active);
  });

  if (id === "screenHome" || id === "screenMyDog") {
    refreshDoggyBotHome();
  }
};

function refreshDoggyBotHome(){
  const name = state.dog.name || "הכלב שלי";
  const breed = state.dog.breed || "גזע לא הוגדר";
  const age = state.dog.age ? `גיל ${state.dog.age}` : "גיל לא הוגדר";
  const weight = state.dog.weight ? `${state.dog.weight} ק״ג` : "משקל לא הוגדר";

  const homeDogName = document.getElementById("homeDogName");
  const homeDogMeta = document.getElementById("homeDogMeta");
  const dogPageName = document.getElementById("dogPageName");
  const dogPageMeta = document.getElementById("dogPageMeta");
  const heroTitle = document.getElementById("homeHeroTitle");

  if (homeDogName) homeDogName.textContent = name;
  if (homeDogMeta) homeDogMeta.textContent = `${breed} • ${age}`;
  if (dogPageName) dogPageName.textContent = name;
  if (dogPageMeta) dogPageMeta.textContent = `${breed} • ${age} • ${weight}`;
  if (heroTitle) heroTitle.textContent = `${name} צריך תור טיפוח ✂️`;
}

document.querySelectorAll("[data-tab-target]").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.tabTarget));
});

const profileInstallBtn = document.getElementById("installAppBtnProfile");
if (profileInstallBtn) {
  profileInstallBtn.addEventListener("click", () => {
    const mainInstall = document.getElementById("installAppBtn");
    if (mainInstall) mainInstall.click();
  });
}

const originalHomeNext = document.querySelector('[data-next="screenHome"]');
if (originalHomeNext) {
  originalHomeNext.addEventListener("click", () => {
    setTimeout(() => {
      if (appNav) appNav.classList.remove("hidden");
      refreshDoggyBotHome();
    }, 0);
  });
}


/* ===== Doggy Brain v1 — Hebrew local AI, no external cost ===== */
const doggyBrain = {
  defaultReplies: [
    "וואף 🐶 אני איתך! אפשר לשאול אותי על תספורת, חיסונים, אוכל, טיול או מצב רוח.",
    "אני דוגי ואני מדבר עברית 🐾 ספר לי מה הכלב צריך ואני אנסה לעזור.",
    "וואף וואף! נשמע חשוב. כדאי לבדוק לפי גיל, גזע והרגלים של הכלב."
  ],
  rules: [
    {
      keys: ["תספורת","ספר","מספרה","טיפוח","פרווה","רחצה","מקלחת"],
      reply: () => {
        const name = state?.dog?.name || "הכלב שלך";
        return `וואף ✂️ לדעתי כדאי לקבוע ל${name} תור טיפוח כל 4–8 שבועות, תלוי בגזע ובפרווה. אם הפרווה מסתבכת או יש ריח — זה סימן טוב לקבוע כבר עכשיו.`;
      }
    },
    {
      keys: ["חיסון","חיסונים","וטרינר","כלבת","שנתי"],
      reply: () => {
        const name = state?.dog?.name || "הכלב";
        return `וואף 💉 לגבי ${name}, חיסונים חשוב לנהל לפי תאריך אחרון אצל וטרינר. כשנחבר תזכורות אמיתיות, אזכיר לך בזמן ולא תצטרך לזכור לבד.`;
      }
    },
    {
      keys: ["אוכל","האכלה","רעב","חטיף","תזונה","משקל"],
      reply: () => {
        const weight = state?.dog?.weight;
        return weight ? `יאמי 🍖 לפי מה שהזנת, המשקל הוא ${weight} ק״ג. כדאי להתאים כמות אוכל לפי סוג המזון, גיל ורמת פעילות.` : "יאמי 🍖 כדי לתת המלצה טובה על אוכל, כדאי להזין משקל, גיל וגזע בפרופיל הכלב.";
      }
    },
    {
      keys: ["טיול","הליכה","פארק","לצאת","אנרגיה"],
      reply: () => "וואף 🐕 טיול קצר יכול לשפר מצב רוח ממש מהר. לכלב פעיל כדאי לשלב הליכה, רחרוחים ומשחק קצר — זה גם בריאות וגם שמחה.",
    },
    {
      keys: ["עצוב","עצב","מדוכא","פוחד","חרדה","לחוץ","נובח"],
      reply: () => "אוי וואף 🐶 אם הכלב נראה עצוב או לחוץ, תן לו שקט, מים, ליטוף עדין וטיול רגוע. אם זה נמשך או יש שינוי באכילה/התנהגות — עדיף להתייעץ עם וטרינר.",
    },
    {
      keys: ["שלום","היי","מה קורה","בוקר טוב","ערב טוב"],
      reply: () => "וואף וואף! 🐾 שלום! אני דוגי, העוזר החכם שלך. תשאל אותי משהו על הכלב שלך.",
    }
  ]
};

function doggyFindReply(question){
  const q = String(question || "").trim().toLowerCase();
  if (!q) return "וואף 🐶 כתוב לי שאלה קצרה ואני אענה בעברית.";
  const match = doggyBrain.rules.find(rule => rule.keys.some(k => q.includes(k)));
  if (match) return match.reply();
  return doggyBrain.defaultReplies[Math.floor(Math.random() * doggyBrain.defaultReplies.length)];
}

function doggySpeak(text){
  const bubble = document.getElementById("doggyBubbleText");
  const bubbleBox = document.querySelector(".doggy-ai-bubble");
  const dog = document.getElementById("doggyPetBtn");
  if (!bubble) return;

  if (bubbleBox) bubbleBox.classList.add("is-thinking");
  if (dog) dog.classList.add("is-excited");
  bubble.textContent = "אני חושב";

  setTimeout(() => {
    if (bubbleBox) bubbleBox.classList.remove("is-thinking");
    bubble.textContent = text;
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text.replace(/🐶|🐾|✂️|💉|🍖|🐕/g, ""));
        utter.lang = "he-IL";
        utter.rate = 1.02;
        utter.pitch = 1.15;
        window.speechSynthesis.speak(utter);
      } catch(e) {}
    }
    setTimeout(() => dog && dog.classList.remove("is-excited"), 520);
  }, 650);
}

function initDoggyAiWidget(){
  const form = document.getElementById("doggyChatForm");
  const input = document.getElementById("doggyQuestionInput");
  const dog = document.getElementById("doggyPetBtn");
  const mic = document.getElementById("doggyMicBtn");

  if (form && !form.dataset.ready) {
    form.dataset.ready = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const question = input.value.trim();
      const answer = doggyFindReply(question);
      input.value = "";
      doggySpeak(answer);
    });
  }

  document.querySelectorAll("[data-doggy-question]").forEach(btn => {
    if (btn.dataset.ready) return;
    btn.dataset.ready = "1";
    btn.addEventListener("click", () => {
      const q = btn.dataset.doggyQuestion;
      if (input) input.value = q;
      doggySpeak(doggyFindReply(q));
    });
  });

  if (dog && !dog.dataset.ready) {
    dog.dataset.ready = "1";
    dog.addEventListener("click", () => {
      doggySpeak("וואף! 🐶 איזה כיף שנגעת בי. אני כאן כדי לעזור לך עם הכלב שלך.");
    });

    window.addEventListener("pointermove", (event) => {
      const rect = dog.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-1, Math.min(1, (event.clientX - cx) / 130));
      const dy = Math.max(-1, Math.min(1, (event.clientY - cy) / 130));
      dog.style.setProperty("--eye-x", `${dx * 3}px`);
      dog.style.setProperty("--eye-y", `${dy * 2}px`);
    }, { passive:true });
  }

  if (mic && !mic.dataset.ready) {
    mic.dataset.ready = "1";
    mic.addEventListener("click", () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        doggySpeak("וואף 🎙️ כרגע הדפדפן הזה לא תומך בדיבור למיקרופון, אבל אפשר לכתוב לי בעברית ואני אענה.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "he-IL";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      doggySpeak("אני מקשיב 🎙️ תגיד לי מה לשאול.");
      recognition.start();
      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (input) input.value = text;
        doggySpeak(doggyFindReply(text));
      };
      recognition.onerror = () => doggySpeak("וואף, לא הצלחתי לשמוע טוב. אפשר לכתוב לי את השאלה?");
    });
  }
}

const doggyOriginalShowScreen = showScreen;
showScreen = function(id){
  doggyOriginalShowScreen(id);
  if (id === "screenHome") {
    setTimeout(initDoggyAiWidget, 0);
  }
};

window.addEventListener("DOMContentLoaded", initDoggyAiWidget);

/* ===== Doggy Room v1 — Game Interactions ===== */
const doggyRoomState={xp:0,mood:"שמח",dogX:0};
function updateDoggyRoomHud(){const xp=document.getElementById("doggyXpLabel"),mood=document.getElementById("doggyMoodLabel");if(xp)xp.textContent=`${doggyRoomState.xp} XP`;if(mood)mood.textContent=doggyRoomState.mood}
function roomDogSay(text){const bubble=document.getElementById("doggySpeechBubble");if(bubble)bubble.textContent=text}
function animateFullDog(action){const dog=document.getElementById("fullDog");if(!dog)return;dog.classList.remove("is-jumping","is-running","is-petted");void dog.offsetWidth;dog.classList.add(action);setTimeout(()=>dog.classList.remove(action),action==="is-running"?900:920)}
function setFullDogX(x){const dog=document.getElementById("fullDog");if(!dog)return;doggyRoomState.dogX=Math.max(-92,Math.min(92,x));dog.style.setProperty("--dog-x",`${doggyRoomState.dogX}px`)}
function addDoggyXp(points,mood,message){doggyRoomState.xp+=points;if(mood)doggyRoomState.mood=mood;updateDoggyRoomHud();if(message)roomDogSay(message)}
function initDoggyRoom(){
 const room=document.getElementById("doggyRoom"),dog=document.getElementById("fullDog");
 if(!room||!dog||room.dataset.ready)return;room.dataset.ready="1";updateDoggyRoomHud();
 dog.addEventListener("click",()=>{animateFullDog("is-jumping");addDoggyXp(2,"מתרגש","וואף! 🐶 איזה כיף! תלחץ עליי שוב או תזרוק לי כדור.")});
 document.getElementById("callDogBtn")?.addEventListener("click",()=>{setFullDogX(0);animateFullDog("is-running");addDoggyXp(3,"שמח","אני בא! 🐕 קראת לי ואני כאן.")});
 document.getElementById("jumpDogBtn")?.addEventListener("click",()=>{animateFullDog("is-jumping");addDoggyXp(2,"שמח","הופ! 🐶 ראית איזה קפיצה?")});
 document.getElementById("petDogBtn")?.addEventListener("click",()=>{animateFullDog("is-petted");addDoggyXp(4,"רגוע","מממ וואף... איזה ליטוף נעים 🐾")});
 function makeToyDraggable(toy,type){
  if(!toy)return;let dragging=false,offsetX=0,offsetY=0;
  toy.addEventListener("pointerdown",e=>{dragging=true;toy.setPointerCapture(e.pointerId);const r=toy.getBoundingClientRect(),rr=room.getBoundingClientRect();offsetX=e.clientX-r.left;offsetY=e.clientY-r.top;toy.style.left=`${r.left-rr.left}px`;toy.style.top=`${r.top-rr.top}px`;toy.style.right="auto";toy.style.bottom="auto";toy.style.transform="none";toy.style.zIndex="20"});
  toy.addEventListener("pointermove",e=>{if(!dragging)return;const rr=room.getBoundingClientRect();toy.style.left=`${Math.max(6,Math.min(rr.width-64,e.clientX-rr.left-offsetX))}px`;toy.style.top=`${Math.max(6,Math.min(rr.height-64,e.clientY-rr.top-offsetY))}px`});
  toy.addEventListener("pointerup",()=>{dragging=false;const tr=toy.getBoundingClientRect(),dr=dog.getBoundingClientRect(),tx=tr.left+tr.width/2,ty=tr.top+tr.height/2,dx=dr.left+dr.width/2,dy=dr.top+dr.height/2,dist=Math.hypot(tx-dx,ty-dy);
   if(dist<125){if(type==="ball"){const rr=room.getBoundingClientRect();setFullDogX((tx-(rr.left+rr.width/2))*.55);animateFullDog("is-running");addDoggyXp(8,"מתרגש","וואף וואף! 🥎 רצתי אחרי הכדור! זרוק לי שוב.")} if(type==="food"){animateFullDog("is-petted");addDoggyXp(10,"שבע","יאמי 🍖 תודה! עכשיו אני שבע ושמח.")} if(type==="brush"){animateFullDog("is-petted");addDoggyXp(7,"מטופח","וואף ✨ איזה סירוק נעים! הפרווה שלי נראית מושלם.")}} else roomDogSay("כמעט! גרור את המשחק אליי ואני אגיב 🐾");
   setTimeout(()=>resetToy(toy,type),450)
  })
 }
 function resetToy(toy,type){toy.style.cssText="";toy.className=type==="ball"?"play-toy play-ball":type==="food"?"play-toy food-bowl":"play-toy brush-toy"}
 makeToyDraggable(document.getElementById("playBall"),"ball");makeToyDraggable(document.getElementById("foodBowl"),"food");makeToyDraggable(document.getElementById("brushToy"),"brush");
 room.addEventListener("pointermove",e=>{const r=dog.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=Math.max(-1,Math.min(1,(e.clientX-cx)/160)),dy=Math.max(-1,Math.min(1,(e.clientY-cy)/160));dog.style.setProperty("--room-eye-x",`${dx*4}px`);dog.style.setProperty("--room-eye-y",`${dy*3}px`)},{passive:true});
 const form=document.getElementById("roomDoggyChatForm"),input=document.getElementById("roomDoggyQuestionInput");
 form?.addEventListener("submit",e=>{e.preventDefault();const q=input?.value?.trim()||"";const answer=typeof doggyFindReply==="function"?doggyFindReply(q):"וואף 🐶 אני כאן!";if(input)input.value="";roomDogSay(answer);animateFullDog("is-petted");if("speechSynthesis"in window){try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(answer.replace(/🐶|🐾|✂️|💉|🍖|🐕|🥎|✨/g,""));u.lang="he-IL";u.rate=1.02;u.pitch=1.15;window.speechSynthesis.speak(u)}catch(err){}}});
 document.getElementById("roomDoggyMicBtn")?.addEventListener("click",()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){roomDogSay("כרגע הדפדפן הזה לא תומך במיקרופון בעברית, אבל אפשר לכתוב לי שאלה 🐶");return}const rec=new SR();rec.lang="he-IL";rec.interimResults=false;rec.maxAlternatives=1;roomDogSay("אני מקשיב 🎙️ תגיד לי מה לשאול.");rec.start();rec.onresult=e=>{const text=e.results[0][0].transcript;if(input)input.value=text;roomDogSay(typeof doggyFindReply==="function"?doggyFindReply(text):"וואף 🐶")};rec.onerror=()=>roomDogSay("לא שמעתי טוב, נסה שוב או כתוב לי 🐾")})
}
const doggyRoomOriginalShowScreen=showScreen;showScreen=function(id){doggyRoomOriginalShowScreen(id);if(id==="screenDoggyWorld")setTimeout(initDoggyRoom,0)};
window.addEventListener("DOMContentLoaded",initDoggyRoom);
