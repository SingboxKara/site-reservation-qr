(function () {
  const API_BASE_URL =
    (globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1")
      ? "http://localhost:3000"
      : "https://singbox-backend.onrender.com";

  const STRIPE_PUBLISHABLE_KEY =
    "pk_test_51SYUBK44gpoNdGNgYqQMcppFvT0kViCVEFyDzOQMDz0DR0L71Ob9Kvlh3MO4BFxeRR2bM9VUID7pvrxBoC5GbGSC00Dt8htb3X";

  const FETCH_TIMEOUT_MS = 15000;

  function safeText(value, maxLen = 255) {
    return String(value ?? "").trim().slice(0, maxLen);
  }

  function getToken() {
    const token = localStorage.getItem("token");
    return !token || token === "null" || token === "undefined" ? null : token;
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return token ? { ...extra, Authorization: "Bearer " + token } : extra;
  }

  function formatMoney(value) {
    const amount = Number(value || 0);
    return `${amount.toFixed(2).replace(".", ",")}€`;
  }

  function normalizePassType(passType) {
    return safeText(passType, 80);
  }

  function createFetchTimeoutSignal(timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timeoutId)
    };
  }

  async function parseResponseData(res) {
    const clone = res.clone();
    try {
      return await res.json();
    } catch {
      try {
        const text = await clone.text();
        return text ? { raw: text } : null;
      } catch {
        return null;
      }
    }
  }

  async function apiFetch(path, options = {}, config = {}) {
    const {
      auth = false,
      json = true,
      timeoutMs = FETCH_TIMEOUT_MS
    } = config;

    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    const timeout = createFetchTimeoutSignal(timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers: auth ? authHeaders(options.headers || {}) : (options.headers || {}),
        signal: options.signal || timeout.signal
      });

      let data = null;
      if (json) {
        data = await parseResponseData(res);
      }

      if ((res.status === 401 || res.status === 403) && auth) {
        localStorage.removeItem("token");
      }

      return {
        ok: res.ok,
        status: res.status,
        data,
        res
      };
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      return {
        ok: false,
        status: 0,
        data: {
          error: isAbort ? "Délai d’attente dépassé." : "Erreur réseau."
        },
        res: null
      };
    } finally {
      timeout.clear();
    }
  }

  async function getCatalog() {
    return apiFetch("/api/passes/catalog", { method: "GET" }, { auth: false });
  }

  async function getMyPasses() {
    return apiFetch("/api/passes/me", { method: "GET" }, { auth: true });
  }

  async function createPurchasePaymentIntent(passType) {
    return apiFetch(
      "/api/passes/create-payment-intent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passType: normalizePassType(passType) })
      },
      { auth: true }
    );
  }

  async function confirmPurchase(paymentIntentId, passType) {
    return apiFetch(
      "/api/passes/confirm-purchase",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: safeText(paymentIntentId, 200),
          passType: normalizePassType(passType)
        })
      },
      { auth: true }
    );
  }

  async function previewUsage(userPassId, cart) {
    return apiFetch(
      "/api/passes/preview-usage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPassId: safeText(userPassId, 120),
          cart: Array.isArray(cart) ? cart : [],
          promoCode: null,
          singcoinsUsed: false
        })
      },
      { auth: true }
    );
  }

  async function confirmReservationWithPass(userPassId, cart, customer) {
    return apiFetch(
      "/api/passes/confirm-reservation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPassId: safeText(userPassId, 120),
          cart: Array.isArray(cart) ? cart : [],
          customer: customer && typeof customer === "object" ? customer : {},
          promoCode: null,
          singcoinsUsed: false
        })
      },
      { auth: true }
    );
  }

  function getStripe() {
    if (!globalThis.Stripe) {
      return null;
    }
    return globalThis.Stripe(STRIPE_PUBLISHABLE_KEY);
  }

  globalThis.SingboxPasses = {
    API_BASE_URL,
    STRIPE_PUBLISHABLE_KEY,
    getToken,
    authHeaders,
    formatMoney,
    getCatalog,
    getMyPasses,
    createPurchasePaymentIntent,
    confirmPurchase,
    previewUsage,
    confirmReservationWithPass,
    getStripe
  };
})();
