globalThis.API_BASE_URL =
  (globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : "https://singbox-backend.onrender.com";

globalThis.QR_CHECK_BASE_URL = globalThis.API_BASE_URL + "/api/check";

const STRIPE_PUBLISHABLE_KEY = "pk_test_51SYUBK44gpoNdGNgYqQMcppFvT0kViCVEFyDzOQMDz0DR0L71Ob9Kvlh3MO4BFxeRR2bM9VUID7pvrxBoC5GbGSC00Dt8htb3X";
const PRICE_FALLBACK = 10;
const CHECKOUT_INFO_KEY = "singbox_checkout_info_v1";
const SUPABASE_URL = "https://sfckofydfqbllkxhxwnt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY2tvZnlkZnFibGxreGh4d250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTA4ODQsImV4cCI6MjA3OTc2Njg4NH0.2kg7GxQBU8nArCCbJPm0JSn208izXCeiDX266FUC1lw";

const API_BASE_URL = globalThis.API_BASE_URL;
const QR_CHECK_BASE_URL = globalThis.QR_CHECK_BASE_URL;

let stripe = null;
let cardElement = null;
let currentPromo = null;
let loyaltyUsed = false;
let cartValid = true;
let lastPayWithSaved = false;
let isPrefilling = false;

let savedCardState = {
  enabled: false,
  defaultPaymentMethodId: null,
  card: null,
  methods: []
};

let currentTotals = {
  totalTTCNoDiscount: 0,
  discount: 0,
  finalTotalTTC: 0
};

function getEl(id) {
  return document.getElementById(id);
}

function getToken() {
  const token = localStorage.getItem("token");
  return (!token || token === "null" || token === "undefined") ? null : token;
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: "Bearer " + token } : extra;
}

async function handleAuthResponse(res, ctx = "") {
  if (res.status !== 401 && res.status !== 403) {
    return true;
  }

  localStorage.removeItem("token");
  console.warn(`[AUTH] Token supprimé suite à ${res.status} sur ${ctx || "API"}`);
  return false;
}

async function parseResponseData(res) {
  try {
    return await res.json();
  } catch {
    try {
      const cloned = res.clone();
      const txt = await cloned.text();
      return { raw: txt };
    } catch {
      return null;
    }
  }
}

async function apiFetch(path, options = {}, config = {}) {
  const { auth = false, json = true, ctx = "" } = config;
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = options.headers || {};
  const finalHeaders = auth ? authHeaders(headers) : headers;

  const res = await fetch(url, { ...options, headers: finalHeaders });

  if (auth) {
    const okAuth = await handleAuthResponse(res, ctx || path);
    if (!okAuth) {
      return { ok: false, status: res.status, data: null, res };
    }
  }

  if (!json) {
    return { ok: res.ok, status: res.status, data: null, res };
  }

  const data = await parseResponseData(res);

  if (!res.ok) {
    console.warn(`[API] ${ctx || path} failed:`, res.status, data);
  }

  return { ok: res.ok, status: res.status, data, res };
}

function getPanier() {
  try {
    const panier = JSON.parse(localStorage.getItem("panier"));
    return Array.isArray(panier) ? panier : [];
  } catch {
    return [];
  }
}

function savePanier(panier) {
  localStorage.setItem("panier", JSON.stringify(Array.isArray(panier) ? panier : []));
}

function updateCartIcon() {
  const el = getEl("cart-count");
  if (!el) {
    return;
  }

  const panier = getPanier();
  el.textContent = panier.length ? String(panier.length) : "";
}

function computeTotal(panier) {
  let total = 0;

  for (const item of panier) {
    const hasNumericPrice = item && typeof item.price === "number" && Number.isFinite(item.price);
    const price = hasNumericPrice ? item.price : PRICE_FALLBACK;

    if (!Number.isFinite(price) || price < 0) {
      return null;
    }

    total += price;
  }

  return total;
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")}€`;
}

function formatDateFr(iso) {
  if (!iso) {
    return "";
  }

  try {
    const [y, m, d] = iso.split("-");
    const date = new Date(Number.parseInt(y, 10), Number.parseInt(m, 10) - 1, Number.parseInt(d, 10));
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isPromoCurrentlyValid(promo) {
  if (!promo || !promo.is_active) {
    return false;
  }

  const today = getTodayISO();

  if (promo.valid_from && promo.valid_from > today) {
    return false;
  }

  if (promo.valid_to && promo.valid_to < today) {
    return false;
  }

  const maxUses = promo.max_uses;
  const used = promo.used_count || 0;
  const hasMaxUses = maxUses !== null && maxUses !== undefined && typeof maxUses === "number";

  return !(hasMaxUses && used >= maxUses);
}

function computeDiscountFromPromo(promo, totalTTC) {
  if (!promo || totalTTC <= 0) {
    return 0;
  }

  const value = promo.value || 0;

  switch (promo.type) {
    case "percent":
      return Math.min(totalTTC, totalTTC * (value / 100));
    case "fixed":
      return Math.min(totalTTC, value);
    case "free":
      return totalTTC;
    default:
      return 0;
  }
}

function calculateAgeFromBirthdate(isoDate) {
  if (!isoDate) {
    return null;
  }

  const parts = isoDate.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10) - 1;
  const day = Number.parseInt(parts[2], 10);
  const birth = new Date(year, month, day);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function formatTimeFrFromIso(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getCheckoutEls() {
  return {
    nameEl: getEl("order-product-name"),
    metaEl: getEl("order-meta"),
    subEl: getEl("order-subtotal"),
    tvaEl: getEl("order-tva"),
    totalEl: getEl("order-total"),
    discountRow: getEl("order-discount-row"),
    discountEl: getEl("order-discount"),
    emptyState: getEl("empty-cart-state"),
    checkoutLayout: document.querySelector(".checkout-layout"),
    paymentCard: document.querySelector(".payment-card"),
    submitBtn: getEl("checkout-submit-btn")
  };
}

function toggleEmptyCartUI(isEmpty, els) {
  const { emptyState, checkoutLayout, paymentCard, submitBtn } = els;

  if (emptyState) {
    emptyState.style.display = isEmpty ? "block" : "none";
  }

  if (checkoutLayout) {
    checkoutLayout.style.display = isEmpty ? "none" : "grid";
  }

  if (paymentCard) {
    paymentCard.style.display = isEmpty ? "none" : "";
  }

  if (submitBtn) {
    submitBtn.disabled = isEmpty;
  }
}

function renderEmptyOrderSummary(els) {
  const { nameEl, metaEl, subEl, tvaEl, totalEl, discountRow } = els;

  if (nameEl) nameEl.textContent = "Aucune réservation";
  if (metaEl) metaEl.textContent = "Votre panier est vide. Ajoutez des créneaux depuis la page Réservation.";
  if (subEl) subEl.textContent = "0€";
  if (tvaEl) tvaEl.textContent = "0€";
  if (totalEl) totalEl.textContent = "0€";

  if (discountRow) {
    discountRow.style.display = "none";
  }

  currentTotals = { totalTTCNoDiscount: 0, discount: 0, finalTotalTTC: 0 };
  cartValid = false;
}

function renderInvalidCartSummary(els) {
  const { nameEl, metaEl, subEl, tvaEl, totalEl, discountRow, submitBtn } = els;

  if (nameEl) nameEl.textContent = "Erreur sur votre panier";
  if (metaEl) metaEl.textContent = "Une erreur s’est produite sur un des créneaux. Merci de revenir au panier et de recommencer votre sélection.";
  if (subEl) subEl.textContent = "—";
  if (tvaEl) tvaEl.textContent = "—";
  if (totalEl) totalEl.textContent = "—";

  if (discountRow) {
    discountRow.style.display = "none";
  }

  if (submitBtn) {
    submitBtn.disabled = true;
  }

  currentTotals = { totalTTCNoDiscount: 0, discount: 0, finalTotalTTC: 0 };
  cartValid = false;
}

function buildOrderMeta(first) {
  const dateLabel = first && first.date ? formatDateFr(first.date) : "";
  let hourText = "";

  if (first && first.start_time && first.end_time) {
    const startTime = formatTimeFrFromIso(first.start_time);
    const endTime = formatTimeFrFromIso(first.end_time);
    if (startTime && endTime) {
      hourText = `${startTime} – ${endTime}`;
    }
  } else if (first && typeof first.hour === "number") {
    const start = first.hour;
    const startH = Math.floor(start);
    const startM = Math.round((start - startH) * 60);
    const endMinutes = startH * 60 + startM + 90;
    const endH = Math.floor((endMinutes % 1440) / 60);
    const endM = endMinutes % 60;
    const startStr = String(startH).padStart(2, "0") + "h" + String(startM).padStart(2, "0");
    const endStr = String(endH).padStart(2, "0") + "h" + String(endM).padStart(2, "0");
    hourText = `${startStr} – ${endStr}`;
  }

  return { dateLabel, hourText };
}

function getDisplayBoxName(first) {
  if (!first) {
    return "Box privée";
  }
  return first.boxName || first.box || first.boxId || "Box privée";
}

function updateOrderSummaryFromPanier() {
  const els = getCheckoutEls();
  const { nameEl, metaEl, subEl, tvaEl, totalEl, discountRow, discountEl, submitBtn } = els;

  if (!nameEl || !metaEl || !subEl || !tvaEl || !totalEl) {
    return;
  }

  const panier = getPanier();

  if (panier.length === 0) {
    renderEmptyOrderSummary(els);
    toggleEmptyCartUI(true, els);
    return;
  }

  const totalTTCNoDiscount = computeTotal(panier);

  if (totalTTCNoDiscount === null) {
    renderInvalidCartSummary(els);
    toggleEmptyCartUI(false, els);
    return;
  }

  cartValid = true;
  if (submitBtn) {
    submitBtn.disabled = false;
  }

  toggleEmptyCartUI(false, els);

  const totalHTNoDiscount = totalTTCNoDiscount / 1.2;
  const tvaNoDiscount = totalTTCNoDiscount - totalHTNoDiscount;

  let discount = 0;
  if (currentPromo && isPromoCurrentlyValid(currentPromo)) {
    discount = computeDiscountFromPromo(currentPromo, totalTTCNoDiscount);
  } else {
    currentPromo = null;
  }

  discount = Math.max(0, Math.min(discount, totalTTCNoDiscount));

  const discountHT = discount / 1.2;
  const discountTVA = discount - discountHT;
  const totalHT = Math.max(0, totalHTNoDiscount - discountHT);
  const tva = Math.max(0, tvaNoDiscount - discountTVA);
  const finalTotalTTC = Math.max(0, totalTTCNoDiscount - discount);

  const first = panier[0];
  const boxName = getDisplayBoxName(first);
  const extraCount = panier.length - 1;
  const { dateLabel, hourText } = buildOrderMeta(first);

  nameEl.textContent = extraCount > 0
    ? `Box ${boxName} + ${extraCount} autre(s) créneau(x)`
    : `Box ${boxName}`;

  metaEl.innerHTML =
    (dateLabel ? `Date : ${dateLabel}<br>` : "") +
    (hourText ? `Créneau : ${hourText}<br>` : "") +
    `Nombre de créneaux : ${panier.length}`;

  subEl.textContent = formatMoney(totalHT);
  tvaEl.textContent = formatMoney(tva);
  totalEl.textContent = formatMoney(finalTotalTTC);

  if (discountRow && discountEl) {
    if (discount > 0) {
      discountRow.style.display = "flex";
      discountEl.textContent = "-" + formatMoney(discount);
    } else {
      discountRow.style.display = "none";
    }
  }

  currentTotals = { totalTTCNoDiscount, discount, finalTotalTTC };
}

function setCardElementHidden(hidden) {
  const wrap = document.querySelector(".card-element-wrapper");
  if (!wrap) {
    return;
  }
  wrap.classList.toggle("is-hidden", Boolean(hidden));
}

function syncSavedCardToggleState() {
  const payToggle = getEl("pay-with-saved-card");
  if (!payToggle) {
    return;
  }

  const hasCard = Boolean(savedCardState.card && savedCardState.card.last4);
  const wantsSavedCard = Boolean(payToggle.checked);

  if (!hasCard) {
    payToggle.checked = false;
    setCardElementHidden(false);
    return;
  }

  setCardElementHidden(wantsSavedCard);
}

function initSavedCardToggleBehavior() {
  const payToggle = getEl("pay-with-saved-card");
  if (!payToggle) {
    return;
  }

  if (payToggle.dataset.bound === "true") {
    syncSavedCardToggleState();
    return;
  }

  payToggle.addEventListener("change", syncSavedCardToggleState);
  payToggle.dataset.bound = "true";
  syncSavedCardToggleState();
}

function renderSavedCardUI() {
  const block = getEl("saved-card-block");
  if (!block) {
    return;
  }

  const summary = getEl("saved-card-summary");
  const payToggle = getEl("pay-with-saved-card");
  const saveBtn = getEl("save-card-btn");
  const msg = getEl("save-card-msg");
  const logged = Boolean(getToken());

  if (!logged) {
    block.style.display = "none";
    setCardElementHidden(false);
    return;
  }

  block.style.display = "block";

  const card = savedCardState.card;

  if (summary) {
    summary.textContent = (card && card.last4)
      ? `Carte enregistrée : ${card.brand || "carte"} •••• ${card.last4} (exp. ${card.exp_month}/${card.exp_year})`
      : "Aucune carte enregistrée pour le moment.";
  }

  if (payToggle) {
    payToggle.disabled = !(card && card.last4);
    if (payToggle.disabled) {
      payToggle.checked = false;
    }
  }

  if (msg) {
    msg.textContent = "";
  }

  if (saveBtn) {
    saveBtn.disabled = false;
  }

  initSavedCardToggleBehavior();
}

async function loadSavedCardStateFromMe() {
  if (!getToken()) {
    return;
  }

  const r = await apiFetch("/api/me", { method: "GET" }, { auth: true, ctx: "GET /api/me (payment)" });
  if (!r.ok || !r.data) {
    return;
  }

  const payment = r.data.payment || {};
  savedCardState.card = payment.card || null;
  savedCardState.defaultPaymentMethodId = payment.default_payment_method_id || null;
}

async function refreshPaymentMethods() {
  if (!getToken()) {
    return;
  }

  const r = await apiFetch("/api/payment-methods", { method: "GET" }, { auth: true, ctx: "GET /api/payment-methods" });
  if (!r.ok || !r.data) {
    return;
  }

  savedCardState.methods = Array.isArray(r.data.methods) ? r.data.methods : [];
  savedCardState.defaultPaymentMethodId = r.data.defaultPaymentMethodId || savedCardState.defaultPaymentMethodId;

  if (!savedCardState.card && savedCardState.defaultPaymentMethodId) {
    const found = savedCardState.methods.find((method) => method.id === savedCardState.defaultPaymentMethodId);
    if (found) {
      savedCardState.card = found;
    }
  }
}

function buildBillingDetails() {
  const firstName = (getEl("prenom")?.value || "").trim();
  const lastName = (getEl("nom")?.value || "").trim();
  const email = (getEl("email")?.value || "").trim();

  return {
    name: `${firstName} ${lastName}`.trim(),
    email
  };
}

async function handleSaveCard() {
  const msg = getEl("save-card-msg");
  const btn = getEl("save-card-btn");
  const payToggle = getEl("pay-with-saved-card");

  if (!getToken()) {
    if (msg) {
      msg.textContent = "Connectez-vous pour enregistrer une carte.";
    }
    return;
  }

  if (!stripe || !cardElement) {
    if (msg) {
      msg.textContent = "Stripe n’est pas initialisé.";
    }
    return;
  }

  if (payToggle) {
    payToggle.checked = false;
  }
  setCardElementHidden(false);

  try {
    if (btn) btn.disabled = true;
    if (msg) msg.textContent = "Préparation de l’enregistrement…";

    const si = await apiFetch(
      "/api/create-setup-intent",
      { method: "POST" },
      { auth: true, ctx: "POST /api/create-setup-intent" }
    );

    if (!si.ok || !si.data || !si.data.clientSecret) {
      if (msg) msg.textContent = "Impossible de préparer l’enregistrement de la carte.";
      return;
    }

    const setupRes = await stripe.confirmCardSetup(si.data.clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: buildBillingDetails()
      }
    });

    if (setupRes.error) {
      if (msg) msg.textContent = setupRes.error.message || "Erreur lors de l’enregistrement de la carte.";
      return;
    }

    const paymentMethodId = setupRes.setupIntent && setupRes.setupIntent.payment_method;
    if (!paymentMethodId) {
      if (msg) msg.textContent = "Enregistrement incomplet (payment_method manquant).";
      return;
    }

    if (msg) msg.textContent = "Finalisation…";

    const sd = await apiFetch(
      "/api/set-default-payment-method",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId })
      },
      { auth: true, ctx: "POST /api/set-default-payment-method" }
    );

    if (!sd.ok) {
      if (msg) msg.textContent = "Carte enregistrée, mais impossible de la définir par défaut.";
      return;
    }

    savedCardState.card = null;
    await loadSavedCardStateFromMe();
    await refreshPaymentMethods();
    renderSavedCardUI();

    if (msg) msg.textContent = "Carte enregistrée ✔️";

    if (payToggle && !payToggle.disabled) {
      payToggle.checked = true;
      syncSavedCardToggleState();
    }
  } catch (e) {
    if (msg) {
      msg.textContent = "Erreur : " + (e?.message || "inconnue");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function getCheckoutInfoFromForm() {
  const get = (id) => (getEl(id)?.value || "").trim();

  return {
    prenom: get("prenom"),
    nom: get("nom"),
    pays: getEl("pays")?.value || "FR",
    adresse: get("adresse"),
    complement: get("complement"),
    cp: get("cp"),
    ville: get("ville"),
    telephone: get("telephone"),
    email: get("email"),
    naissance: getEl("naissance")?.value || ""
  };
}

function fillCheckoutForm(info) {
  if (!info) {
    return;
  }

  const set = (id, val) => {
    const el = getEl(id);
    if (!el || val === undefined || val === null) {
      return;
    }
    el.value = val;
  };

  set("prenom", info.prenom);
  set("nom", info.nom);
  set("adresse", info.adresse);
  set("complement", info.complement);
  set("cp", info.cp);
  set("ville", info.ville);
  set("telephone", info.telephone);
  set("email", info.email);
  set("naissance", info.naissance);

  const paysEl = getEl("pays");
  if (paysEl && info.pays) {
    paysEl.value = info.pays;
  }
}

function loadCheckoutInfoLocal() {
  try {
    const raw = localStorage.getItem(CHECKOUT_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCheckoutInfoLocal(info) {
  try {
    localStorage.setItem(CHECKOUT_INFO_KEY, JSON.stringify(info));
  } catch {
    // no-op
  }
}

async function prefillFromBackendIfLogged() {
  if (!getToken()) {
    return;
  }

  const r = await apiFetch("/api/me", { method: "GET" }, { auth: true, ctx: "GET /api/me (prefill)" });
  if (!r.ok || !r.data) {
    return;
  }

  const data = r.data;
  const profile = data.profile || {};

  isPrefilling = true;

  fillCheckoutForm({
    prenom: profile.prenom || "",
    nom: profile.nom || "",
    telephone: profile.telephone || "",
    pays: profile.pays || "FR",
    adresse: profile.adresse || "",
    complement: profile.complement || "",
    cp: profile.cp || "",
    ville: profile.ville || "",
    naissance: profile.naissance || "",
    email: data.email || ""
  });

  isPrefilling = false;
  saveCheckoutInfoLocal(getCheckoutInfoFromForm());
}

function bindAutosave() {
  let saveTimer = null;
  let saveDbTimer = null;
  let lastDbPayload = "";

  function scheduleLocalSave() {
    if (isPrefilling) {
      return;
    }

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveCheckoutInfoLocal(getCheckoutInfoFromForm());
    }, 400);
  }

  async function saveProfileToBackendNow() {
    const token = getToken();
    if (!token) {
      return;
    }

    const payload = getCheckoutInfoFromForm();
    const payloadStr = JSON.stringify(payload);

    if (payloadStr === lastDbPayload) {
      return;
    }

    const r = await apiFetch(
      "/api/me",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr
      },
      { auth: true, ctx: "POST /api/me (autosave)" }
    );

    if (r.ok) {
      lastDbPayload = payloadStr;
    } else {
      console.warn("Autosave profil échoué:", r.status, r.data);
    }
  }

  function saveProfileToBackendDebounced() {
    if (isPrefilling || !getToken()) {
      return;
    }

    clearTimeout(saveDbTimer);
    saveDbTimer = setTimeout(saveProfileToBackendNow, 900);
  }

  [
    "prenom", "nom", "pays", "adresse", "complement", "cp", "ville", "telephone", "email", "naissance"
  ].forEach((id) => {
    const el = getEl(id);
    if (!el) {
      return;
    }

    el.addEventListener("input", scheduleLocalSave);
    el.addEventListener("change", scheduleLocalSave);
    el.addEventListener("input", saveProfileToBackendDebounced);
    el.addEventListener("change", saveProfileToBackendDebounced);
    el.addEventListener("blur", saveProfileToBackendDebounced);
  });
}

async function fetchUserPoints() {
  if (!getToken()) {
    return null;
  }

  const r = await apiFetch("/api/me", { method: "GET" }, { auth: true, ctx: "GET /api/me (points)" });
  if (!r.ok || !r.data) {
    return null;
  }

  return r.data.points ?? 0;
}

function renderLoyaltyLoggedOut(loyaltyPointsEl, useLoyaltyBtn, loyaltyMsg) {
  loyaltyPointsEl.textContent = "0";
  loyaltyMsg.style.color = "#FECACA";
  loyaltyMsg.textContent = "Connectez-vous à votre compte pour cumuler et utiliser vos points.";
  useLoyaltyBtn.style.display = "none";
}

function renderLoyaltyUnavailable(loyaltyPointsEl, useLoyaltyBtn, loyaltyMsg) {
  loyaltyPointsEl.textContent = "0";
  useLoyaltyBtn.style.display = "none";
  loyaltyMsg.style.color = "#FECACA";
  loyaltyMsg.textContent = "Impossible de récupérer vos points pour le moment.";
}

function renderLoyaltyReady(points, loyaltyPointsEl, useLoyaltyBtn, loyaltyMsg) {
  loyaltyPointsEl.textContent = String(points);

  if (points >= 100) {
    useLoyaltyBtn.style.display = "block";
    loyaltyMsg.style.color = "#D1FAE5";
    loyaltyMsg.textContent = "Vous pouvez utiliser vos points pour une séance gratuite.";
  } else {
    useLoyaltyBtn.style.display = "none";
    loyaltyMsg.style.color = "#CBD5E1";
    loyaltyMsg.textContent = `Il vous manque encore ${Math.max(0, 100 - points)} point(s) pour une séance gratuite.`;
  }
}

function bindLoyaltyButton(useLoyaltyBtn, loyaltyPointsEl, loyaltyMsg) {
  if (useLoyaltyBtn.dataset.bound === "true") {
    return;
  }

  useLoyaltyBtn.addEventListener("click", () => {
    loyaltyMsg.textContent = "";

    if (!getToken()) {
      loyaltyMsg.style.color = "#FECACA";
      loyaltyMsg.textContent = "Connectez-vous pour utiliser vos points.";
      return;
    }

    const currentPoints = Number.parseInt(loyaltyPointsEl.textContent || "0", 10);

    if (currentPoints < 100) {
      loyaltyMsg.style.color = "#FECACA";
      loyaltyMsg.textContent = "Vous n'avez pas encore assez de points pour une séance gratuite.";
      return;
    }

    currentPromo = { type: "free", code: "LOYALTY100", is_active: true };
    loyaltyUsed = true;
    updateOrderSummaryFromPanier();

    loyaltyMsg.style.color = "#D1FAE5";
    loyaltyMsg.textContent = "🎉 Séance gratuite activée. Les points seront débités après validation du paiement.";
    useLoyaltyBtn.disabled = true;
  });

  useLoyaltyBtn.dataset.bound = "true";
}

async function initLoyalty() {
  const loyaltyBlock = getEl("loyalty-block");
  const loyaltyPointsEl = getEl("loyalty-points");
  const useLoyaltyBtn = getEl("use-loyalty-btn");
  const loyaltyMsg = getEl("loyalty-msg");

  if (!loyaltyBlock || !loyaltyPointsEl || !useLoyaltyBtn || !loyaltyMsg) {
    return;
  }

  loyaltyBlock.style.display = "block";

  if (!getToken()) {
    renderLoyaltyLoggedOut(loyaltyPointsEl, useLoyaltyBtn, loyaltyMsg);
    return;
  }

  const points = await fetchUserPoints();

  if (points === null) {
    renderLoyaltyUnavailable(loyaltyPointsEl, useLoyaltyBtn, loyaltyMsg);
    return;
  }

  renderLoyaltyReady(points, loyaltyPointsEl, useLoyaltyBtn, loyaltyMsg);
  bindLoyaltyButton(useLoyaltyBtn, loyaltyPointsEl, loyaltyMsg);
}

function initStripeCard() {
  const cardMount = getEl("card-element");
  if (!STRIPE_PUBLISHABLE_KEY || !globalThis.Stripe || !cardMount) {
    return;
  }

  stripe = globalThis.Stripe(STRIPE_PUBLISHABLE_KEY);

  const elements = stripe.elements({
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#F97316",
        colorBackground: "#020617",
        colorText: "#F9FAFB",
        colorTextPlaceholder: "#CBD5E1",
        fontFamily: "Montserrat, system-ui, sans-serif",
        borderRadius: "14px"
      }
    }
  });

  cardElement = elements.create("card", {
    hidePostalCode: true,
    style: {
      base: {
        color: "#F9FAFB",
        fontFamily: "Montserrat, system-ui, sans-serif",
        fontSize: "14px",
        lineHeight: "24px",
        fontSmoothing: "antialiased",
        "::placeholder": { color: "#CBD5E1" }
      },
      invalid: {
        color: "#FECACA"
      }
    }
  });

  cardElement.mount("#card-element");
  cardElement.on("change", (event) => {
    const displayError = getEl("card-errors");
    if (displayError) {
      displayError.textContent = event.error ? event.error.message : "";
    }
  });
}

async function fetchPromoByCode(code) {
  if (!globalThis.supabaseClient) {
    return { errorMessage: "Erreur : service promo indisponible." };
  }

  try {
    const { data, error } = await globalThis.supabaseClient
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .limit(1)
      .maybeSingle();

    if (error) {
      return { errorMessage: "Erreur lors de la vérification du code." };
    }

    if (!data || !isPromoCurrentlyValid(data)) {
      return { errorMessage: "Ce code n’existe pas ou n’est plus valable." };
    }

    return { promo: data };
  } catch {
    return { errorMessage: "Erreur réseau lors de la vérification du code." };
  }
}

function clearPromo() {
  currentPromo = null;
  localStorage.removeItem("promoCode");
  updateOrderSummaryFromPanier();
}

function setPromoMessage(message, type = "") {
  const promoMsg = getEl("promo-message");
  if (!promoMsg) {
    return;
  }

  promoMsg.classList.remove("ok", "error");
  promoMsg.textContent = message;

  if (type) {
    promoMsg.classList.add(type);
  }
}

async function applyPromoCode(silent = false) {
  const promoInput = getEl("promo-code");
  if (!promoInput) {
    return;
  }

  const code = promoInput.value.trim().toUpperCase();

  if (!code) {
    clearPromo();
    setPromoMessage(silent ? "" : "Saisissez un code promo.", silent ? "" : "error");
    return;
  }

  setPromoMessage("Vérification du code...");

  const result = await fetchPromoByCode(code);

  if (result.errorMessage) {
    clearPromo();
    setPromoMessage(result.errorMessage, "error");
    return;
  }

  currentPromo = result.promo;
  localStorage.setItem("promoCode", result.promo.code);
  updateOrderSummaryFromPanier();

  const discountNow = currentTotals.discount || 0;
  setPromoMessage(
    discountNow > 0
      ? "Code appliqué ✔ Réduction de " + formatMoney(discountNow) + " sur votre commande."
      : "Code appliqué ✔",
    "ok"
  );
}

function initPromo() {
  const promoToggle = getEl("promo-toggle");
  const promoBody = getEl("promo-body");
  const promoInput = getEl("promo-code");
  const promoBtn = getEl("apply-promo");

  if (promoToggle && promoBody) {
    promoToggle.addEventListener("click", () => {
      promoBody.classList.toggle("open");
    });
  }

  if (promoBtn) {
    promoBtn.addEventListener("click", () => applyPromoCode(false));
  }

  if (promoInput) {
    promoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyPromoCode(false);
      }
    });

    const stored = localStorage.getItem("promoCode");
    if (stored) {
      promoInput.value = stored;
      applyPromoCode(true);
    }
  }
}

function revealHiddenAncestors(node) {
  let parent = node;
  while (parent && parent !== document.body) {
    if (parent.hidden) {
      parent.hidden = false;
    }
    const st = globalThis.getComputedStyle(parent);
    if (st && st.display === "none") {
      parent.style.display = "";
    }
    parent = parent.parentElement;
  }
}

function showThankYouSection() {
  const thankyouSection = getEl("thankyou-section");
  const billingForm = getEl("billing-form");
  const paymentCard = document.querySelector(".payment-card");
  const checkoutLayout = document.querySelector(".checkout-layout");
  const emptyCartState = getEl("empty-cart-state");

  if (!thankyouSection) {
    console.warn("[THANKYOU] #thankyou-section introuvable dans le DOM.");
    return;
  }

  revealHiddenAncestors(thankyouSection);

  if (emptyCartState) emptyCartState.style.display = "none";
  if (billingForm) billingForm.style.display = "none";
  if (paymentCard) paymentCard.style.display = "none";

  if (checkoutLayout) {
    const tyInside = checkoutLayout.contains(thankyouSection);

    if (tyInside) {
      Array.from(checkoutLayout.children).forEach((child) => {
        if (child === thankyouSection || child.contains(thankyouSection)) {
          return;
        }
        child.style.display = "none";
      });
      checkoutLayout.style.display = "";
    } else {
      checkoutLayout.style.display = "none";
    }
  }

  thankyouSection.style.display = "block";
  thankyouSection.hidden = false;
  thankyouSection.classList.remove("hidden");
  globalThis.scrollTo({ top: 0, behavior: "smooth" });
}

function fillThankYouData() {
  const panierBeforeClear = getPanier();
  const firstItem = panierBeforeClear.length > 0 ? panierBeforeClear[0] : null;

  const thankyouName = getEl("thankyou-name");
  const thankyouDate = getEl("thankyou-date");
  const thankyouTime = getEl("thankyou-time");
  const thankyouBox = getEl("thankyou-box");
  const thankyouTotal = getEl("thankyou-total");

  const dateLabel = firstItem && firstItem.date ? formatDateFr(firstItem.date) : "";
  const boxName = getDisplayBoxName(firstItem);
  const { hourText } = buildOrderMeta(firstItem);
  const prenomValue = (getEl("prenom")?.value || "").trim();

  if (thankyouName) thankyouName.textContent = prenomValue;
  if (thankyouDate) thankyouDate.textContent = dateLabel || "-";
  if (thankyouTime) thankyouTime.textContent = hourText || "-";
  if (thankyouBox) thankyouBox.textContent = boxName;
  if (thankyouTotal) thankyouTotal.textContent = formatMoney(currentTotals.finalTotalTTC || 0);

  const headerTitle = document.querySelector(".checkout-header h1");
  const headerSubtitle = document.querySelector(".checkout-header p:last-of-type");

  if (headerTitle) {
    headerTitle.textContent = "Merci pour votre réservation 🎉";
  }
  if (headerSubtitle) {
    headerSubtitle.textContent = "Voici le récapitulatif de votre séance chez Singbox.";
  }
}

function getCustomerPayload(includeSaveCheckoutInfo = false) {
  const payload = {
    prenom: getEl("prenom")?.value.trim() || "",
    nom: getEl("nom")?.value.trim() || "",
    email: getEl("email")?.value.trim() || "",
    telephone: getEl("telephone")?.value.trim() || "",
    pays: getEl("pays")?.value || "FR",
    adresse: getEl("adresse")?.value.trim() || "",
    complement: getEl("complement")?.value.trim() || "",
    cp: getEl("cp")?.value.trim() || "",
    ville: getEl("ville")?.value.trim() || "",
    naissance: getEl("naissance")?.value || ""
  };

  if (includeSaveCheckoutInfo) {
    payload.save_checkout_info = true;
  }

  return payload;
}

async function confirmReservation(isFree, paymentIntentId, errorEl) {
  let reservationId = null;
  const thankyouRef = getEl("thankyou-ref");

  try {
    const body = {
      panier: getPanier(),
      customer: getCustomerPayload(true),
      promoCode: currentPromo && isPromoCurrentlyValid(currentPromo) ? currentPromo.code : null,
      loyaltyUsed,
      isFree: Boolean(isFree)
    };

    if (!isFree && paymentIntentId) {
      body.paymentIntentId = paymentIntentId;
    }

    const confirmRes = await fetch(`${API_BASE_URL}/api/confirm-reservation`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });

    const confirmJson = await confirmRes.json().catch(() => ({}));

    if (confirmRes.ok && confirmJson && Array.isArray(confirmJson.reservations) && confirmJson.reservations.length > 0) {
      reservationId = confirmJson.reservations[0].id;
      if (thankyouRef) {
        thankyouRef.textContent = reservationId;
      }
    } else if (errorEl) {
      errorEl.textContent =
        confirmJson.error ||
        "Votre réservation a été créée, mais une erreur interne s’est produite. Contactez-nous si besoin.";
    }
  } catch (e) {
    console.error("Erreur confirm-reservation :", e);
  }

  return reservationId;
}

function getSavedPaymentMethodId() {
  return savedCardState?.defaultPaymentMethodId ||
    (savedCardState?.card && savedCardState.card.id) ||
    null;
}

async function confirmDepositIntent(reservationId, isFree, errorEl) {
  if (!reservationId || !stripe) {
    return;
  }

  try {
    const depositRes = await fetch(`${API_BASE_URL}/api/create-deposit-intent`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        reservationId,
        useSavedPaymentMethod: Boolean(lastPayWithSaved),
        customer: {
          prenom: getEl("prenom")?.value.trim() || "",
          nom: getEl("nom")?.value.trim() || "",
          email: getEl("email")?.value.trim() || ""
        }
      })
    });

    const depositJson = await depositRes.json().catch(() => ({}));

    if (!depositRes.ok || !depositJson?.clientSecret) {
      if (errorEl) {
        errorEl.textContent =
          (isFree
            ? "Votre réservation est confirmée, mais la caution de 250€ n'a pas pu être créée."
            : "Votre séance est payée, mais la caution de 250€ n'a pas pu être créée.") +
          " Merci de nous contacter à contactsingbox@gmail.com.";
      }
      return;
    }

    let pmId = getSavedPaymentMethodId();

    if (lastPayWithSaved && !pmId) {
      lastPayWithSaved = false;
      pmId = null;
    }

    const depositResult = lastPayWithSaved
      ? await stripe.confirmCardPayment(depositJson.clientSecret, { payment_method: pmId })
      : await stripe.confirmCardPayment(depositJson.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: buildBillingDetails()
          }
        });

    if (depositResult?.error && errorEl) {
      errorEl.textContent =
        (isFree
          ? "Votre réservation est confirmée, mais la caution de 250€ n'a pas pu être préautorisée : "
          : "Votre séance est payée, mais la caution de 250€ n'a pas pu être préautorisée : ") +
        depositResult.error.message +
        ". Merci de nous contacter à contactsingbox@gmail.com.";
    }
  } catch {
    if (errorEl) {
      errorEl.textContent =
        (isFree
          ? "Votre réservation est confirmée, mais une erreur est survenue lors de la création de la caution."
          : "Votre séance est payée, mais une erreur est survenue lors de la création de la caution.") +
        " Merci de nous contacter à contactsingbox@gmail.com.";
    }
  }
}

async function saveNewsletterOptin() {
  const newsletterCheckbox = getEl("newsletter-optin");
  const email = getEl("email")?.value.trim() || "";

  if (!newsletterCheckbox || !newsletterCheckbox.checked || !globalThis.supabaseClient || !email) {
    return;
  }

  try {
    await globalThis.supabaseClient
      .from("newsletter_subscriptions")
      .insert({ email });
  } catch {
    // no-op
  }
}

function cleanupAfterReservation() {
  saveCheckoutInfoLocal(getCheckoutInfoFromForm());
  savePanier([]);
  localStorage.removeItem("promoCode");
  currentPromo = null;
  updateCartIcon();
}

function renderThankYouQr(reservationId) {
  const thankyouQrContainer = getEl("thankyou-qr");
  const thankyouQrFallback = getEl("thankyou-qr-fallback");

  if (!reservationId || !thankyouQrContainer || !globalThis.QRCode) {
    return;
  }

  try {
    const qrText = `${QR_CHECK_BASE_URL}?id=${encodeURIComponent(reservationId)}`;
    thankyouQrContainer.innerHTML = "";

    new globalThis.QRCode(thankyouQrContainer, {
      text: qrText,
      width: 228,
      height: 228,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: globalThis.QRCode.CorrectLevel.H
    });

    if (thankyouQrFallback) {
      thankyouQrFallback.style.display = "none";
    }
  } catch {
    // no-op
  }
}

async function processReservationAndDeposit({ isFree, paymentIntentId, errorEl }) {
  fillThankYouData();
  const reservationId = await confirmReservation(isFree, paymentIntentId, errorEl);
  await confirmDepositIntent(reservationId, isFree, errorEl);
  await saveNewsletterOptin();
  cleanupAfterReservation();
  showThankYouSection();
  renderThankYouQr(reservationId);
}

function hasStripeReadyForPayment(payWithSavedChecked) {
  if (!stripe) {
    return false;
  }

  if (payWithSavedChecked) {
    return true;
  }

  return Boolean(cardElement);
}

function validateCheckoutBeforePayment() {
  const billingForm = getEl("billing-form");
  const cgvCheckbox = getEl("cgv-checkbox");
  const rulesCheckbox = getEl("rules-checkbox");
  const errorEl = getEl("checkout-error");
  const panier = getPanier();

  if (!billingForm) {
    return false;
  }

  if (!panier || panier.length === 0) {
    if (errorEl) {
      errorEl.textContent = "Votre panier est vide. Ajoutez des créneaux depuis la page Réservation.";
    }
    return false;
  }

  if (!cartValid) {
    if (errorEl) {
      errorEl.textContent = "Erreur panier. Revenez au panier et recommencez.";
    }
    return false;
  }

  if (!billingForm.reportValidity()) {
    if (errorEl) {
      errorEl.textContent = "Merci de compléter tous les champs obligatoires de facturation.";
    }
    return false;
  }

  if (!cgvCheckbox || !cgvCheckbox.checked) {
    if (errorEl) {
      errorEl.textContent = "Vous devez accepter les conditions générales de vente pour continuer.";
    }
    return false;
  }

  if (!rulesCheckbox || !rulesCheckbox.checked) {
    if (errorEl) {
      errorEl.textContent = "Merci de confirmer que vous respecterez les règles dans les box.";
    }
    return false;
  }

  const age = calculateAgeFromBirthdate(getEl("naissance")?.value || "");
  if (!age || age < 18) {
    if (errorEl) {
      errorEl.textContent = "La réservation doit être faite par un adulte (date de naissance invalide).";
    }
    return false;
  }

  return true;
}

function resetFeedbackMessages() {
  const errorEl = getEl("checkout-error");
  const successEl = getEl("checkout-success");

  if (errorEl) errorEl.textContent = "";
  if (successEl) successEl.textContent = "";
}

function normalizeSavedCardChoice() {
  const toggle = getEl("pay-with-saved-card");
  const hasSavedCard = Boolean(savedCardState.card && savedCardState.card.last4);

  lastPayWithSaved = Boolean(toggle?.checked);

  if (!lastPayWithSaved || hasSavedCard) {
    return;
  }

  lastPayWithSaved = false;
  if (toggle) {
    toggle.checked = false;
  }
  setCardElementHidden(false);
}

async function createPaymentIntentRequest() {
  const panier = getPanier();
  const promoCode = currentPromo && isPromoCurrentlyValid(currentPromo) ? currentPromo.code : null;
  const finalAmountCents = currentPromo && currentPromo.type === "free"
    ? 0
    : Math.round((currentTotals.finalTotalTTC || 0) * 100);

  const body = {
    panier,
    customer: getCustomerPayload(false),
    promoCode,
    finalAmountCents,
    loyaltyUsed
  };

  if (lastPayWithSaved) {
    body.useSavedPaymentMethod = true;
  }

  const res = await fetch(`${API_BASE_URL}/api/create-payment-intent`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function confirmSavedCardPayment(clientSecret, errorEl, successEl) {
  const pmId = getSavedPaymentMethodId();

  if (!pmId) {
    lastPayWithSaved = false;
    const toggle = getEl("pay-with-saved-card");
    if (toggle) {
      toggle.checked = false;
    }
    setCardElementHidden(false);

    if (errorEl) {
      errorEl.textContent = "Aucune carte enregistrée détectée. Merci de saisir votre carte.";
    }
    return null;
  }

  const actionRes = await stripe.confirmCardPayment(clientSecret, {
    payment_method: pmId
  });

  if (actionRes.error) {
    if (errorEl) {
      errorEl.textContent = actionRes.error.message;
    }
    return null;
  }

  if (actionRes.paymentIntent && actionRes.paymentIntent.status === "succeeded") {
    if (successEl) {
      successEl.textContent = "Paiement accepté ✔️";
    }
    return actionRes.paymentIntent.id;
  }

  if (errorEl) {
    errorEl.textContent = "Paiement non finalisé. Merci de réessayer.";
  }
  return null;
}

async function confirmStandardCardPayment(clientSecret, errorEl, successEl) {
  if (!cardElement) {
    if (errorEl) {
      errorEl.textContent = "Merci de saisir une carte (aucun champ carte détecté).";
    }
    return null;
  }

  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: buildBillingDetails()
    }
  });

  if (result.error) {
    if (errorEl) {
      errorEl.textContent = result.error.message;
    }
    return null;
  }

  if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
    if (successEl) {
      successEl.textContent = "Paiement accepté ✔️";
    }
    return result.paymentIntent.id;
  }

  if (errorEl) {
    errorEl.textContent = "Paiement non finalisé. Merci de réessayer.";
  }
  return null;
}

function getCheckoutSubmitContext() {
  return {
    submitBtn: getEl("checkout-submit-btn"),
    errorEl: getEl("checkout-error"),
    successEl: getEl("checkout-success"),
    payWithSavedChecked: Boolean(getEl("pay-with-saved-card")?.checked)
  };
}

function prepareCheckoutSubmit(submitBtn) {
  const originalLabel = submitBtn ? submitBtn.textContent : "Commander";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Paiement en cours...";
  }

  return originalLabel;
}

function restoreCheckoutSubmit(submitBtn, originalLabel) {
  if (!submitBtn) {
    return;
  }

  submitBtn.disabled = false;
  submitBtn.textContent = originalLabel;
}

async function handleFreeCheckout(successEl, errorEl) {
  if (successEl) {
    successEl.textContent = "Réservation gratuite validée ✔️";
  }
  await processReservationAndDeposit({ isFree: true, paymentIntentId: null, errorEl });
}

async function handlePaidCheckout(clientSecret, errorEl, successEl) {
  const paymentIntentId = lastPayWithSaved
    ? await confirmSavedCardPayment(clientSecret, errorEl, successEl)
    : await confirmStandardCardPayment(clientSecret, errorEl, successEl);

  if (!paymentIntentId) {
    return;
  }

  await processReservationAndDeposit({
    isFree: false,
    paymentIntentId,
    errorEl
  });
}

async function handleCheckoutSubmit() {
  const { submitBtn, errorEl, successEl, payWithSavedChecked } = getCheckoutSubmitContext();

  if (!hasStripeReadyForPayment(payWithSavedChecked)) {
    if (errorEl) {
      errorEl.textContent = "Erreur de paiement : Stripe n’est pas initialisé.";
    }
    return;
  }

  if (!validateCheckoutBeforePayment()) {
    return;
  }

  resetFeedbackMessages();
  updateOrderSummaryFromPanier();
  normalizeSavedCardChoice();

  const originalLabel = prepareCheckoutSubmit(submitBtn);

  try {
    const { res, json } = await createPaymentIntentRequest();

    if (!res.ok) {
      if (errorEl) {
        errorEl.textContent = json.error || "Erreur lors de la création du paiement.";
      }
      return;
    }

    if (json.isFree) {
      await handleFreeCheckout(successEl, errorEl);
      return;
    }

    if (!json.clientSecret) {
      if (errorEl) {
        errorEl.textContent = "Réponse inattendue du serveur de paiement.";
      }
      return;
    }

    await handlePaidCheckout(json.clientSecret, errorEl, successEl);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = "Erreur inattendue : " + (err?.message || "inconnue");
    }
  } finally {
    restoreCheckoutSubmit(submitBtn, originalLabel);
  }
}

function initCheckoutSubmit() {
  const submitBtn = getEl("checkout-submit-btn");
  if (!submitBtn) {
    return;
  }

  submitBtn.addEventListener("click", handleCheckoutSubmit);
}

function initMobileMenu() {
  const burgerBtn = getEl("burger-button");
  const mobileNav = getEl("mobile-nav");

  if (!burgerBtn || !mobileNav) {
    return;
  }

  burgerBtn.addEventListener("click", () => {
    mobileNav.classList.toggle("open");
    const isExpanded = mobileNav.classList.contains("open");
    burgerBtn.setAttribute("aria-expanded", String(isExpanded));
  });

  mobileNav.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.tagName === "A") {
      mobileNav.classList.remove("open");
      burgerBtn.setAttribute("aria-expanded", "false");
    }
  });
}

function showAuthModal() {
  const modal = getEl("auth-modal");
  if (!modal) {
    return;
  }

  if (typeof modal.showModal === "function" && !modal.open) {
    modal.showModal();
  } else {
    modal.setAttribute("open", "open");
  }
}

function hideAuthModal() {
  const modal = getEl("auth-modal");
  if (!modal) {
    return;
  }

  if (typeof modal.close === "function" && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

function clearAuthMessage() {
  const msgEl = getEl("auth-modal-message");
  if (msgEl) {
    msgEl.textContent = "";
  }
}

function switchAuthTab(mode) {
  const btnLoginTab = getEl("auth-btn-login");
  const btnRegisterTab = getEl("auth-btn-register");
  const loginForm = getEl("auth-login-form");
  const registerForm = getEl("auth-register-form");

  if (!btnLoginTab || !btnRegisterTab || !loginForm || !registerForm) {
    return;
  }

  const isLogin = mode === "login";

  btnLoginTab.classList.toggle("active", isLogin);
  btnRegisterTab.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  clearAuthMessage();
}

async function handleAuthLoginSubmit(e) {
  e.preventDefault();
  const msgEl = getEl("auth-modal-message");
  const email = getEl("auth-login-email")?.value.trim() || "";
  const password = getEl("auth-login-password")?.value || "";

  clearAuthMessage();

  if (!email || !password) {
    if (msgEl) {
      msgEl.textContent = "Merci de renseigner vos identifiants.";
    }
    return;
  }

  try {
    const base = globalThis.API_BASE_URL || API_BASE_URL;
    const res = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (msgEl) {
        msgEl.textContent = data.error || "Erreur de connexion.";
      }
      return;
    }

    localStorage.setItem("token", data.token);
    hideAuthModal();
    globalThis.location.reload();
  } catch {
    if (msgEl) {
      msgEl.textContent = "Erreur réseau. Veuillez réessayer.";
    }
  }
}

async function handleAuthRegisterSubmit(e) {
  e.preventDefault();
  const msgEl = getEl("auth-modal-message");
  const email = getEl("auth-register-email")?.value.trim() || "";
  const password = getEl("auth-register-password")?.value || "";

  clearAuthMessage();

  if (!email || !password) {
    if (msgEl) {
      msgEl.textContent = "Merci de renseigner un email et un mot de passe.";
    }
    return;
  }

  try {
    const base = globalThis.API_BASE_URL || API_BASE_URL;

    const res = await fetch(`${base}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (msgEl) {
        msgEl.textContent = data.error || "Erreur lors de la création du compte.";
      }
      return;
    }

    const loginRes = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const loginData = await loginRes.json().catch(() => ({}));

    if (loginRes.ok) {
      localStorage.setItem("token", loginData.token);
      hideAuthModal();
      globalThis.location.reload();
    } else if (msgEl) {
      msgEl.textContent = "Compte créé, mais la connexion a échoué. Essayez via la connexion.";
    }
  } catch {
    if (msgEl) {
      msgEl.textContent = "Erreur réseau. Veuillez réessayer.";
    }
  }
}

function initAuthModal() {
  const modal = getEl("auth-modal");
  if (!modal) {
    return;
  }

  if (!getToken()) {
    showAuthModal();
  }

  const btnLoginTab = getEl("auth-btn-login");
  const btnRegisterTab = getEl("auth-btn-register");
  const loginForm = getEl("auth-login-form");
  const registerForm = getEl("auth-register-form");
  const skipBtn = getEl("auth-modal-continue");

  if (btnLoginTab) {
    btnLoginTab.addEventListener("click", () => switchAuthTab("login"));
  }
  if (btnRegisterTab) {
    btnRegisterTab.addEventListener("click", () => switchAuthTab("register"));
  }
  if (skipBtn) {
    skipBtn.addEventListener("click", hideAuthModal);
  }
  if (loginForm) {
    loginForm.addEventListener("submit", handleAuthLoginSubmit);
  }
  if (registerForm) {
    registerForm.addEventListener("submit", handleAuthRegisterSubmit);
  }

  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    hideAuthModal();
  });

  modal.addEventListener("click", (e) => {
    const rect = modal.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      hideAuthModal();
    }
  });
}

function initSupabaseClient() {
  if (!globalThis.supabase || typeof globalThis.supabase.createClient !== "function") {
    console.warn("Supabase non disponible.");
    return;
  }

  globalThis.supabaseClient = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

function initNewsletter() {
  const emailInput = getEl("newsletter-email");
  const submitBtn = getEl("newsletter-submit");
  const messageBox = getEl("newsletter-message");

  if (!emailInput || !submitBtn || !messageBox) {
    return;
  }

  submitBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    messageBox.style.color = "#e5e7eb";
    messageBox.textContent = "Envoi en cours...";

    if (!email || !email.includes("@")) {
      messageBox.style.color = "#ff6b6b";
      messageBox.textContent = "Veuillez entrer une adresse e-mail valide.";
      return;
    }

    if (!globalThis.supabaseClient) {
      messageBox.style.color = "#ff6b6b";
      messageBox.textContent = "Service newsletter indisponible.";
      return;
    }

    const { error } = await globalThis.supabaseClient
      .from("newsletter_subscriptions")
      .insert({ email });

    if (error) {
      const isDuplicate =
        error.code === "23505" ||
        (error.message && error.message.includes("duplicate key value"));

      if (isDuplicate) {
        messageBox.style.color = "#38bdf8";
        messageBox.textContent = "Vous êtes déjà inscrit à la newsletter 😉";
        return;
      }

      messageBox.style.color = "#ff6b6b";
      messageBox.textContent = "Erreur : " + error.message;
      return;
    }

    messageBox.style.color = "#38bdf8";
    messageBox.textContent = "Merci ! Vous êtes inscrit 🎉";
    emailInput.value = "";
  });
}

async function initPaymentPage() {
  initSupabaseClient();
  initMobileMenu();
  initAuthModal();
  initNewsletter();

  updateCartIcon();
  updateOrderSummaryFromPanier();

  isPrefilling = true;
  fillCheckoutForm(loadCheckoutInfoLocal());
  isPrefilling = false;

  await prefillFromBackendIfLogged();
  await loadSavedCardStateFromMe();
  await refreshPaymentMethods();

  renderSavedCardUI();
  bindAutosave();
  await initLoyalty();
  initStripeCard();
  initPromo();
  initCheckoutSubmit();

  const saveCardBtn = getEl("save-card-btn");
  if (saveCardBtn) {
    saveCardBtn.addEventListener("click", handleSaveCard);
  }
}

document.addEventListener("DOMContentLoaded", initPaymentPage);
