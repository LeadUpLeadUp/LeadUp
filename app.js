/**
 * אריה לווין — דף נחיתה
 * קליטת לידים ל-CRM (campaign_leads) — קמפיין אריה לווין
 */

const CONFIG = {
  phone: "077-237-6146",
  phoneTel: "tel:+972772376146",
  leadIngest: {
    mode: "rpc",
    endpoint: "https://vhvlkerectggovfihjgm.supabase.co/rest/v1/rpc/ingest_landing_lead",
    supabaseAnonKey: "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb",
    secret: "aria1990",
    campaignId: "cmp_arie_levin_landing",
    campaignLabel: "אריה לווין",
    edgeUrl: "https://vhvlkerectggovfihjgm.supabase.co/functions/v1/landing-lead"
  }
};

const LANDING_PAYLOAD_MARKER = "---LANDING_PAYLOAD---";

function safeTrim(v) {
  return String(v ?? "").trim();
}

function normalizePhoneDigits(v) {
  return safeTrim(v).replace(/\D+/g, "").slice(0, 10);
}

function isValidIsraeliPhone(v) {
  const phone = normalizePhoneDigits(v);
  if (!/^0\d{8,9}$/.test(phone)) return false;
  return /^05\d{8}$/.test(phone) || /^07\d{8}$/.test(phone) || /^0[2-49]\d{7,8}$/.test(phone);
}

function buildLandingPayloadBlock(leadData) {
  return (
    LANDING_PAYLOAD_MARKER +
    "\n" +
    JSON.stringify({
      fullName: leadData.fullName,
      phone: leadData.phone,
      notes: leadData.notes,
      page: "arie-levin-landing",
      submittedAt: leadData.submittedAt
    })
  );
}

async function sendLeadToCRM(leadData) {
  const ingest = CONFIG.leadIngest || {};
  const mode = safeTrim(ingest.mode) || "rpc";
  const secret = safeTrim(ingest.secret);

  if (!secret) {
    throw new Error("not_configured");
  }

  const notesParts = [];
  if (safeTrim(leadData.notes)) notesParts.push("הערות: " + safeTrim(leadData.notes));
  notesParts.push(buildLandingPayloadBlock(leadData));

  const payload = {
    phone: normalizePhoneDigits(leadData.phone),
    customer_name: safeTrim(leadData.fullName),
    notes: notesParts.join("\n\n"),
    campaign_id: ingest.campaignId,
    campaign_label: ingest.campaignLabel,
    page: "arie-levin-landing"
  };

  let endpoint;
  let headers;
  let body;

  if (mode === "edge") {
    endpoint = safeTrim(ingest.edgeUrl);
    headers = {
      "Content-Type": "application/json",
      "x-landing-secret": secret
    };
    body = JSON.stringify({ ...payload, secret });
  } else {
    endpoint = safeTrim(ingest.endpoint);
    const anonKey = safeTrim(ingest.supabaseAnonKey);
    if (!endpoint || !anonKey) throw new Error("not_configured");
    headers = {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    };
    body = JSON.stringify({ payload: { ...payload, secret } });
  }

  const res = await fetch(endpoint, { method: "POST", headers, body });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || "http_" + res.status);
  }
  if (data && data.ok === false) {
    throw new Error(data.error || data.detail || "lead_submit_failed");
  }
  if (data && (data.ok === true || safeTrim(data.id).startsWith("cl_"))) {
    return data;
  }
  throw new Error("unexpected_response");
}

function initPhoneLinks() {
  document.querySelectorAll("[data-phone]").forEach((el) => {
    el.href = CONFIG.phoneTel;
  });
  document.querySelectorAll("[data-phone-display]").forEach((el) => {
    el.textContent = CONFIG.phone;
  });
}

function initLeadForm() {
  const form = document.getElementById("leadForm");
  if (!form) return;

  const fullNameEl = document.getElementById("fullName");
  const phoneEl = document.getElementById("phone");
  const notesEl = document.getElementById("notes");
  const statusEl = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const btnLabel = submitBtn?.querySelector(".btn__label");
  const btnSpinner = submitBtn?.querySelector(".btn__spinner");

  function showFieldError(id, msg) {
    const err = document.getElementById("error-" + id);
    const input = id === "fullName" ? fullNameEl : phoneEl;
    if (err) err.textContent = msg;
    input?.closest(".field")?.classList.toggle("has-error", Boolean(msg));
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function validate() {
    let ok = true;
    const name = safeTrim(fullNameEl?.value);
    const phone = safeTrim(phoneEl?.value);

    if (name.length < 2) {
      showFieldError("fullName", "נא להזין שם מלא (לפחות 2 תווים)");
      ok = false;
    } else {
      showFieldError("fullName", "");
    }

    if (!isValidIsraeliPhone(phone)) {
      showFieldError("phone", "נא להזין מספר טלפון ישראלי תקין");
      ok = false;
    } else {
      showFieldError("phone", "");
    }
    return ok;
  }

  function setBusy(busy) {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    if (btnLabel) btnLabel.hidden = busy;
    if (btnSpinner) btnSpinner.hidden = !busy;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    if (statusEl) {
      statusEl.textContent = "שולחים…";
      statusEl.className = "form-status";
    }

    const leadData = {
      fullName: safeTrim(fullNameEl?.value),
      phone: safeTrim(phoneEl?.value),
      notes: safeTrim(notesEl?.value),
      submittedAt: new Date().toISOString()
    };

    try {
      await sendLeadToCRM(leadData);
      form.reset();
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.className = "form-status";
      }
      showThankYou();
    } catch (err) {
      console.error("[leadForm]", err);
      if (statusEl) {
        statusEl.textContent =
          "לא הצלחנו לשלוח כרגע. אפשר לחייג: " + CONFIG.phone;
        statusEl.className = "form-status is-error";
      }
    } finally {
      setBusy(false);
    }
  });
}

function showThankYou() {
  const overlay = document.getElementById("thankOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  document.getElementById("thankClose")?.focus();
}

function hideThankYou() {
  const overlay = document.getElementById("thankOverlay");
  if (overlay) overlay.hidden = true;
}

function initThankYou() {
  document.getElementById("thankClose")?.addEventListener("click", hideThankYou);
  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", hideThankYou);
  });
}

function initNavHighlight() {
  const navLinks = document.querySelectorAll(".site-nav a");
  const sections = ["hero", "services", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!navLinks.length || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === "#" + id;
          link.classList.toggle("is-active", active);
        });
      });
    },
    { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((sec) => observer.observe(sec));
}

function initHeroImageFallback() {
  const heroImg = document.getElementById("heroPhoto");
  if (!heroImg) return;

  const candidates = [
    "./assets/arie-team.jpg",
    "./assets/arie-team.jpeg",
    "./assets/arie-team.png",
    "./assets/arie-hero.jpg",
    "./assets/arie-hero.jpeg",
    "./assets/arie-hero.png"
  ];

  let current = 0;
  heroImg.src = candidates[current];
  heroImg.addEventListener("error", () => {
    current += 1;
    if (current < candidates.length) {
      heroImg.src = candidates[current];
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initHeroImageFallback();
  initPhoneLinks();
  initLeadForm();
  initThankYou();
  initNavHighlight();
});
