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
  const shouldShow = ["screenHome","screenGroomers","screenAppointments","screenMyDog","screenProfile","screenGroomerDetails"].includes(screenId);
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
