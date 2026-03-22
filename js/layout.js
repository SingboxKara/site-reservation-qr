(() => {
  "use strict";

  const CONFIG = {
    headerTargetId: "site-header",
    footerTargetId: "site-footer",
    headerPath: "components/header.html",
    footerPath: "components/footer.html",
    activeAttr: "aria-current",
    activeAttrValue: "page",
    cartStorageKey: "panier",
    bodyReadyClass: "layout-ready",
    bodyLoadingClass: "layout-loading",
    supabaseUrl: "https://sfckofydfqbllkxhxwnt.supabase.co",
    supabaseKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY2tvZnlkZnFibGxreGh4d250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTA4ODQsImV4cCI6MjA3OTc2Njg4NH0.2kg7GxQBU8nArCCbJPm0JSn208izXCeiDX266FUC1lw",
    chestScriptPath: "js/chestwidget.js",
    chestScriptId: "singbox-chest-widget-script",
  };

  function normalizePath(path) {
    if (!path) return "";
    return path
      .split("#")[0]
      .split("?")[0]
      .replace(/^\/+/, "")
      .trim()
      .toLowerCase();
  }

  function getCurrentPageFile() {
    const path = normalizePath(window.location.pathname);
    if (!path || path.endsWith("/")) return "index.html";
    const parts = path.split("/");
    return parts[parts.length - 1] || "index.html";
  }

  function getCurrentPageKey() {
    const page = getCurrentPageFile();

    const map = {
      "index.html": "index",
      "concept.html": "concept",
      "box.html": "box",
      "actualites.html": "actualites",
      "contact.html": "contact",
      "mon-compte.html": "mon-compte",
      "reservation.html": "reservation",
      "panier.html": "panier",
    };

    return map[page] || "";
  }

  async function fetchText(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Impossible de charger ${url} (${response.status})`);
    }
    return response.text();
  }

  async function injectComponent(targetId, filePath) {
    const target = document.getElementById(targetId);
    if (!target) return false;

    const html = await fetchText(filePath);
    target.innerHTML = html;
    return true;
  }

  function clearExistingCurrentMarkers() {
    document.querySelectorAll(`[${CONFIG.activeAttr}]`).forEach((el) => {
      el.removeAttribute(CONFIG.activeAttr);
    });
  }

  function setActiveNavLink() {
    clearExistingCurrentMarkers();

    const currentPageKey = getCurrentPageKey();
    if (!currentPageKey) return;

    const matchingLinks = document.querySelectorAll(`[data-nav="${currentPageKey}"]`);
    matchingLinks.forEach((link) => {
      link.setAttribute(CONFIG.activeAttr, CONFIG.activeAttrValue);
    });
  }

  function getPanier() {
    try {
      const raw = localStorage.getItem(CONFIG.cartStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Erreur lecture panier :", error);
      return [];
    }
  }

  function updateCartIcon() {
    const countEl = document.getElementById("cart-count");
    if (!countEl) return;

    const panier = getPanier();
    countEl.textContent = panier.length ? String(panier.length) : "";
    countEl.setAttribute("aria-hidden", panier.length ? "false" : "true");
  }

  function closeMobileNav(mobileNav, burgerBtn) {
    if (!mobileNav || !burgerBtn) return;
    mobileNav.classList.remove("open");
    burgerBtn.setAttribute("aria-expanded", "false");
    burgerBtn.setAttribute("aria-label", "Ouvrir le menu");
  }

  function openMobileNav(mobileNav, burgerBtn) {
    if (!mobileNav || !burgerBtn) return;
    mobileNav.classList.add("open");
    burgerBtn.setAttribute("aria-expanded", "true");
    burgerBtn.setAttribute("aria-label", "Fermer le menu");
  }

  function initBurgerMenu() {
    const burgerBtn = document.getElementById("burger-button");
    const mobileNav = document.getElementById("mobile-nav");

    if (!burgerBtn || !mobileNav) return;

    burgerBtn.addEventListener("click", () => {
      const isOpen = mobileNav.classList.contains("open");
      if (isOpen) {
        closeMobileNav(mobileNav, burgerBtn);
      } else {
        openMobileNav(mobileNav, burgerBtn);
      }
    });

    mobileNav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("a")) {
        closeMobileNav(mobileNav, burgerBtn);
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (
        mobileNav.classList.contains("open") &&
        target instanceof Node &&
        !mobileNav.contains(target) &&
        !burgerBtn.contains(target)
      ) {
        closeMobileNav(mobileNav, burgerBtn);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileNav.classList.contains("open")) {
        closeMobileNav(mobileNav, burgerBtn);
      }
    });
  }

  function isValidEmail(email) {
    if (typeof email !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
  }

  function createSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }

    return window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  }

  function isDuplicateNewsletterError(error) {
    return Boolean(
      error &&
        (
          error.code === "23505" ||
          (typeof error.message === "string" &&
            error.message.includes("duplicate key value"))
        )
    );
  }

  function setNewsletterMessage(messageBox, message, color) {
    if (!messageBox) return;
    messageBox.style.color = color;
    messageBox.textContent = message;
  }

  function setNewsletterLoadingState(submitBtn, isLoading) {
    if (!submitBtn) return;

    if (!submitBtn.dataset.originalText) {
      submitBtn.dataset.originalText = submitBtn.textContent || "S'abonner";
    }

    submitBtn.disabled = isLoading;
    submitBtn.setAttribute("aria-busy", String(isLoading));
    submitBtn.textContent = isLoading ? "Envoi..." : submitBtn.dataset.originalText;
  }

  function initNewsletter() {
    const form = document.getElementById("newsletter-form");
    const emailInput = document.getElementById("newsletter-email");
    const submitBtn = document.getElementById("newsletter-submit");
    const messageBox = document.getElementById("newsletter-message");

    if (
      !(form instanceof HTMLFormElement) ||
      !(emailInput instanceof HTMLInputElement) ||
      !(submitBtn instanceof HTMLElement) ||
      !(messageBox instanceof HTMLElement)
    ) {
      return;
    }

    const supabaseClient = createSupabaseClient();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = emailInput.value.trim();
      emailInput.removeAttribute("aria-invalid");

      if (!isValidEmail(email)) {
        emailInput.setAttribute("aria-invalid", "true");
        setNewsletterMessage(
          messageBox,
          "Veuillez entrer une adresse e-mail valide.",
          "#ff6b6b"
        );
        return;
      }

      if (!supabaseClient) {
        setNewsletterMessage(
          messageBox,
          "Le service newsletter n'est pas disponible pour le moment.",
          "#ff6b6b"
        );
        return;
      }

      setNewsletterLoadingState(submitBtn, true);
      setNewsletterMessage(messageBox, "Envoi en cours...", "#e5e7eb");

      try {
        const { error } = await supabaseClient
          .from("newsletter_subscriptions")
          .insert([{ email }]);

        if (error) {
          console.error("Erreur newsletter :", error);

          if (isDuplicateNewsletterError(error)) {
            setNewsletterMessage(
              messageBox,
              "Vous êtes déjà inscrit à la newsletter 😉",
              "#38bdf8"
            );
          } else {
            setNewsletterMessage(
              messageBox,
              "Une erreur est survenue. Merci de réessayer dans quelques instants.",
              "#ff6b6b"
            );
          }
          return;
        }

        setNewsletterMessage(messageBox, "Merci ! Vous êtes inscrit 🎉", "#38bdf8");
        form.reset();
      } catch (error) {
        console.error("Erreur newsletter :", error);
        setNewsletterMessage(
          messageBox,
          "Erreur réseau, merci de réessayer.",
          "#ff6b6b"
        );
      } finally {
        setNewsletterLoadingState(submitBtn, false);
      }
    });

    emailInput.addEventListener("input", () => {
      emailInput.removeAttribute("aria-invalid");
    });
  }

  function initChestWidgetIfAvailable() {
    if (
      window.SingboxChestWidget &&
      typeof window.SingboxChestWidget.refresh === "function"
    ) {
      window.SingboxChestWidget.refresh();
    }
  }

  function ensureChestScriptLoaded() {
    if (
      window.SingboxChestWidget &&
      typeof window.SingboxChestWidget.refresh === "function"
    ) {
      initChestWidgetIfAvailable();
      return Promise.resolve(true);
    }

    const existingScript = document.getElementById(CONFIG.chestScriptId);

    if (existingScript) {
      return new Promise((resolve) => {
        existingScript.addEventListener("load", () => {
          initChestWidgetIfAvailable();
          resolve(true);
        }, { once: true });

        existingScript.addEventListener("error", () => {
          console.error("Erreur chargement chest widget.");
          resolve(false);
        }, { once: true });
      });
    }

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.id = CONFIG.chestScriptId;
      script.src = CONFIG.chestScriptPath;
      script.defer = true;

      script.addEventListener("load", () => {
        initChestWidgetIfAvailable();
        resolve(true);
      }, { once: true });

      script.addEventListener("error", () => {
        console.error("Impossible de charger le script du chest widget.");
        resolve(false);
      }, { once: true });

      document.body.appendChild(script);
    });
  }

  function watchCartChanges() {
    window.addEventListener("storage", (event) => {
      if (event.key === CONFIG.cartStorageKey) {
        updateCartIcon();
      }
    });
  }

  function ensureLoadingState() {
    document.body.classList.add(CONFIG.bodyLoadingClass);
  }

  function setReadyState() {
    document.body.classList.remove(CONFIG.bodyLoadingClass);
    document.body.classList.add(CONFIG.bodyReadyClass);
  }

  async function initLayout() {
    ensureLoadingState();

    try {
      await Promise.all([
        injectComponent(CONFIG.headerTargetId, CONFIG.headerPath),
        injectComponent(CONFIG.footerTargetId, CONFIG.footerPath),
      ]);

      setActiveNavLink();
      initBurgerMenu();
      updateCartIcon();
      initNewsletter();
      await ensureChestScriptLoaded();
      watchCartChanges();
    } catch (error) {
      console.error("Erreur chargement layout :", error);
    } finally {
      setReadyState();
    }
  }

  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initLayout);
    } else {
      initLayout();
    }
  }

  window.SingboxLayout = {
    init: initLayout,
    refreshCart: updateCartIcon,
    refreshChest: initChestWidgetIfAvailable,
    getCurrentPageFile,
    getCurrentPageKey,
  };

  boot();
})();
