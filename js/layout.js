(() => {
  "use strict";

  const CONFIG = {
    headerTargetId: "site-header",
    footerTargetId: "site-footer",
    headerPath: "components/header.html",
    footerPath: "components/footer.html",
    activeClassAttribute: "aria-current",
    activeClassValue: "page",
    bodyReadyClass: "layout-ready",
    bodyLoadingClass: "layout-loading",
    cartStorageKey: "panier",
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
    document.querySelectorAll(`[${CONFIG.activeClassAttribute}]`).forEach((el) => {
      el.removeAttribute(CONFIG.activeClassAttribute);
    });
  }

  function setActiveNavLink() {
    clearExistingCurrentMarkers();

    const currentPage = getCurrentPageFile();

    const navLinks = document.querySelectorAll(
      `.main-nav a[href], .mobile-nav a[href]`
    );

    navLinks.forEach((link) => {
      const href = normalizePath(link.getAttribute("href"));
      if (href === currentPage) {
        link.setAttribute(CONFIG.activeClassAttribute, CONFIG.activeClassValue);
      }
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

  function initNewsletterPlaceholder() {
    const form = document.getElementById("newsletter-form");
    const messageBox = document.getElementById("newsletter-message");

    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (messageBox) {
        messageBox.textContent = "Newsletter bientôt disponible.";
        messageBox.style.color = "#9ca3af";
      }
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
      initNewsletterPlaceholder();
      initChestWidgetIfAvailable();
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
  };

  boot();
})();
