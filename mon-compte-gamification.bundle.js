(function () {
  "use strict";

  const MODULE_ID = "singbox-gamification";
  const STYLE_ID = "singbox-gamification-styles";

  const DEFAULTS = {
    mountSelector: "#gamification-root",
    pseudoMaxLength: 20,
    loyaltyGoal: 100,
    reservationUrl: "reservation.html",
    anchors: {
      singcoins: "#gamif-singcoins-section",
      rewards: "#gamif-rewards-section",
      ranking: "#gamif-ranking-section",
      streak: "#gamif-streak-section"
    }
  };

  const STORAGE_KEYS = {
    pseudoPrefix: "singbox_profile_pseudo__"
  };

  const state = {
    config: { ...DEFAULTS },
    mounted: false,
    root: null,
    user: null,
    data: null
  };

  const MOCK_GAMIFICATION = {
    identity: {
      displayName: "Singbox Player",
      avatarText: "S",
      memberSince: "janvier 2026",
      status: "Chanteur en progression"
    },
    level: {
      current: 3,
      name: "Rising Star",
      xpCurrent: 240,
      xpNextLevel: 400
    },
    streak: {
      current: 4,
      best: 8,
      deadlineText: "Reviens avant le 24 mars à 23h59 pour conserver ton streak.",
      jokers: 1,
      status: "active",
      lastActivity: "Hier",
      rhythm: "Très bon"
    },
    singcoins: {
      balance: 0,
      earned: 120,
      used: 20,
      nextReward: "Séance offerte à 100 Singcoins"
    },
    stats: {
      totalSessions: 12,
      totalTime: "18h",
      totalSongs: 96,
      averageSongs: 8,
      lastSession: "18 mars"
    },
    records: {
      bestStreak: 8,
      activeWeek: "4 sessions",
      biggestSession: "6 pers.",
      songsPerSession: 14,
      timePerSession: "2h"
    },
    missions: [
      { id: "m1", title: "Faire 1 session cette semaine", progress: 100, reward: "+10 Singcoins", done: true },
      { id: "m2", title: "Venir avec 3 personnes", progress: 66, reward: "+15 Singcoins", done: false },
      { id: "m3", title: "Réserver avant dimanche", progress: 30, reward: "Badge Retour éclair", done: false }
    ],
    badges: [
      { icon: "🎤", title: "Première session", desc: "Tu as lancé ta toute première session Singbox.", rarity: "common", unlocked: true, date: "12 fév. 2026" },
      { icon: "🔥", title: "Régulier", desc: "Tu es revenu plusieurs semaines de suite.", rarity: "rare", unlocked: false, date: "" },
      { icon: "🌟", title: "Habitué Singbox", desc: "10 sessions réalisées sur ton compte.", rarity: "epic", unlocked: true, date: "02 mars 2026" }
    ],
    ranking: {
      weeklyPosition: "#7",
      weeklyText: "7e sur la dynamique de la semaine",
      globalPosition: "#21",
      globalText: "21e sur l’activité globale",
      topSummary: "1. Luna · 14 streak — 2. Max · 12 streak — 3. Nina · 10 streak"
    },
    chest: {
      title: "Coffre Bronze",
      condition: "Débloqué après 2 sessions ce mois-ci",
      reward: "Récompense possible : +10 Singcoins",
      history: ["+10 Singcoins · 10 mars", "Code promo -10% · 01 mars"]
    }
  };

  const utils = {
    safeText(value, maxLen = 300) {
      return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLen);
    },

    safeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },

    normalizeEmail(email) {
      return utils.safeText(email, 254).toLowerCase();
    },

    emailLocalPart(email) {
      const safe = utils.normalizeEmail(email);
      return safe.includes("@") ? safe.split("@")[0] : safe;
    },

    capitalizeWords(text) {
      const safe = utils.safeText(text, 120).toLowerCase();
      if (!safe) return "";
      return safe.replace(/\b\p{L}/gu, (m) => m.toUpperCase());
    },

    initialsFromText(text) {
      const safe = utils.safeText(text, 120);
      if (!safe) return "S";
      const words = safe.split(/\s+/).filter(Boolean);
      if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
      return safe.charAt(0).toUpperCase();
    },

    clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    },

    pct(part, total) {
      if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
      return utils.clamp(Math.round((part / total) * 100), 0, 100);
    },

    deepClone(obj) {
      try {
        return structuredClone(obj);
      } catch {
        return JSON.parse(JSON.stringify(obj));
      }
    },

    slugFromEmail(email) {
      return utils.emailLocalPart(email).replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "guest";
    },

    pseudoKey(email) {
      return `${STORAGE_KEYS.pseudoPrefix}${utils.slugFromEmail(email)}`;
    },

    getStoredPseudo(email) {
      if (!email) return "";
      try {
        return utils.safeText(localStorage.getItem(utils.pseudoKey(email)) || "", state.config.pseudoMaxLength);
      } catch {
        return "";
      }
    },

    setStoredPseudo(email, pseudo) {
      if (!email) return;
      try {
        localStorage.setItem(utils.pseudoKey(email), pseudo);
      } catch {}
    },

    sanitizePseudo(value) {
      return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, state.config.pseudoMaxLength);
    },

    getDisplayName(user) {
      const email = utils.normalizeEmail(user?.email || "");
      const localPseudo = utils.getStoredPseudo(email);
      if (localPseudo) return localPseudo;

      const backendPseudo =
        utils.safeText(user?.pseudo || "", state.config.pseudoMaxLength) ||
        utils.safeText(user?.username || "", state.config.pseudoMaxLength);

      if (backendPseudo) return utils.sanitizePseudo(backendPseudo);

      const firstName =
        utils.safeText(user?.prenom || "", state.config.pseudoMaxLength) ||
        utils.safeText(user?.firstName || "", state.config.pseudoMaxLength) ||
        utils.safeText(user?.firstname || "", state.config.pseudoMaxLength);

      if (firstName) return utils.sanitizePseudo(firstName);

      const localPart = utils.emailLocalPart(email).replace(/[._-]+/g, " ");
      const fromEmail = utils.capitalizeWords(localPart);
      if (fromEmail) return fromEmail.slice(0, state.config.pseudoMaxLength);

      return "Singbox Player";
    },

    scrollTo(selector) {
      if (!selector) return;
      const el = document.querySelector(selector);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${MODULE_ID} {
        display: grid;
        gap: 1.1rem;
      }

      #${MODULE_ID} * {
        box-sizing: border-box;
      }

      #${MODULE_ID} .gamif-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 1rem;
      }

      #${MODULE_ID} .g-span-12 { grid-column: span 12; }
      #${MODULE_ID} .g-span-8 { grid-column: span 8; }
      #${MODULE_ID} .g-span-7 { grid-column: span 7; }
      #${MODULE_ID} .g-span-6 { grid-column: span 6; }
      #${MODULE_ID} .g-span-5 { grid-column: span 5; }
      #${MODULE_ID} .g-span-4 { grid-column: span 4; }

      #${MODULE_ID} .g-card,
      #${MODULE_ID} .g-subcard,
      #${MODULE_ID} .g-statbox,
      #${MODULE_ID} .g-recordbox,
      #${MODULE_ID} .g-streakbox,
      #${MODULE_ID} .g-item,
      #${MODULE_ID} .g-source-card,
      #${MODULE_ID} .g-quick-btn {
        border-radius: 22px;
      }

      #${MODULE_ID} .g-card {
        background: #050b18;
        border: 1px solid rgba(255,255,255,.16);
        box-shadow: 0 24px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(148,163,184,.12);
        padding: 1.35rem;
        position: relative;
        overflow: hidden;
      }

      #${MODULE_ID} .g-card::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 0 0, rgba(148,163,184,.08), transparent 55%);
        opacity: .7;
      }

      #${MODULE_ID} .g-card > * {
        position: relative;
        z-index: 1;
      }

      #${MODULE_ID} .g-title {
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 22px;
        letter-spacing: .03em;
        margin: 0 0 6px;
        color: #f9fafb;
      }

      #${MODULE_ID} .g-subtitle,
      #${MODULE_ID} .g-soft,
      #${MODULE_ID} .g-help {
        color: #d1d5db;
        font-size: 12px;
        line-height: 1.55;
      }

      #${MODULE_ID} .g-section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 12px;
      }

      #${MODULE_ID} .g-actions-row {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
      }

      #${MODULE_ID} .g-quick-btn {
        min-height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        text-align: center;
        padding: 0 14px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
        text-decoration: none;
        border: none;
        cursor: pointer;
        transition: transform .15s ease, filter .15s ease, background .15s ease;
      }

      #${MODULE_ID} .g-quick-btn:hover,
      #${MODULE_ID} .g-quick-btn:focus-visible {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }

      #${MODULE_ID} .g-quick-btn-primary {
        background: linear-gradient(90deg, #c94c35, #f97316);
        color: #f9fafb;
        box-shadow: 0 0 0 1px rgba(255,255,255,.16), 0 12px 30px rgba(0,0,0,.8);
      }

      #${MODULE_ID} .g-quick-btn-secondary {
        background: #111827;
        color: #f9fafb;
        box-shadow: 0 0 0 1px rgba(255,255,255,.18), 0 12px 30px rgba(0,0,0,.75);
      }

      #${MODULE_ID} .g-profile-hero {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
      }

      #${MODULE_ID} .g-avatar {
        width: 76px;
        height: 76px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 28px;
        font-weight: 800;
        color: #fff;
        background: linear-gradient(135deg, rgba(201,76,53,.95), rgba(124,58,237,.9));
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
      }

      #${MODULE_ID} .g-profile-name {
        margin: 0;
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 29px;
        line-height: 1;
        color: #f9fafb;
      }

      #${MODULE_ID} .g-profile-name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }

      #${MODULE_ID} .g-inline-btn {
        border: none;
        border-radius: 999px;
        padding: 8px 12px;
        background: #111827;
        color: #f9fafb;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 0 0 1px rgba(255,255,255,.16);
      }

      #${MODULE_ID} .g-inline-btn-primary {
        background: linear-gradient(90deg, #c94c35, #f97316);
      }

      #${MODULE_ID} .g-input {
        width: 100%;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.22);
        background: #020617;
        color: #f9fafb;
        padding: 11px 14px;
        font-size: 13px;
        outline: none;
      }

      #${MODULE_ID} .g-input:focus {
        border-color: #f97316;
        box-shadow: 0 0 0 1px rgba(249,115,22,.7), 0 0 18px rgba(249,115,22,.22);
      }

      #${MODULE_ID} .g-pseudo-form {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }

      #${MODULE_ID} .g-pseudo-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      #${MODULE_ID} .g-message {
        min-height: 16px;
        font-size: 12px;
      }

      #${MODULE_ID} .g-message.ok { color: #bbf7d0; }
      #${MODULE_ID} .g-message.error { color: #fca5a5; }

      #${MODULE_ID} .g-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      #${MODULE_ID} .g-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(15,23,42,.92);
        border: 1px solid rgba(255,255,255,.18);
        font-size: 12px;
        color: #f9fafb;
      }

      #${MODULE_ID} .g-mini-icon,
      #${MODULE_ID} .g-badge-icon,
      #${MODULE_ID} .g-benefit-icon {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #c94c35, #f97316);
        color: #fff;
        font-size: 12px;
        flex-shrink: 0;
      }

      #${MODULE_ID} .g-status-card {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(34,197,94,.10);
        border: 1px solid rgba(34,197,94,.28);
        min-width: 210px;
        text-align: left;
      }

      #${MODULE_ID} .g-soft-success {
        color: #d1fae5;
      }

      #${MODULE_ID} .g-benefits-list,
      #${MODULE_ID} .g-source-list,
      #${MODULE_ID} .g-vertical-list,
      #${MODULE_ID} .g-reward-history {
        display: grid;
        gap: 10px;
      }

      #${MODULE_ID} .g-item,
      #${MODULE_ID} .g-source-card,
      #${MODULE_ID} .g-statbox,
      #${MODULE_ID} .g-recordbox,
      #${MODULE_ID} .g-streakbox,
      #${MODULE_ID} .g-subcard {
        background: rgba(10,16,30,.95);
        border: 1px solid rgba(255,255,255,.10);
        padding: 12px;
      }

      #${MODULE_ID} .g-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      #${MODULE_ID} .g-item-content {
        flex: 1;
        min-width: 0;
      }

      #${MODULE_ID} .g-coin-top,
      #${MODULE_ID} .g-progress-head,
      #${MODULE_ID} .g-streak-main-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      #${MODULE_ID} .g-coin-highlight {
        padding: 10px 12px;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(201,76,53,.17), rgba(249,115,22,.12));
        border: 1px solid rgba(249,115,22,.26);
        font-size: 12px;
        color: #fff;
      }

      #${MODULE_ID} .g-bignumber {
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 30px;
        line-height: 1;
        color: #f9fafb;
      }

      #${MODULE_ID} .g-progress-wrap {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }

      #${MODULE_ID} .g-progress-bar,
      #${MODULE_ID} .g-mini-progress {
        width: 100%;
        overflow: hidden;
        background: rgba(255,255,255,.08);
        border-radius: 999px;
      }

      #${MODULE_ID} .g-progress-bar {
        height: 12px;
      }

      #${MODULE_ID} .g-mini-progress {
        height: 8px;
      }

      #${MODULE_ID} .g-progress-fill,
      #${MODULE_ID} .g-mini-progress > span {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #c94c35, #f97316);
      }

      #${MODULE_ID} .g-progress-fill-xp {
        background: linear-gradient(90deg, #2563eb, #7c3aed);
      }

      #${MODULE_ID} .g-coin-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }

      #${MODULE_ID} .g-coin-stat {
        padding: 12px;
        border-radius: 14px;
        background: rgba(2,6,23,.95);
        border: 1px solid rgba(255,255,255,.08);
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 82px;
      }

      #${MODULE_ID} .g-coin-stat-label {
        font-size: 11px;
        color: #d1d5db;
        white-space: nowrap;
      }

      #${MODULE_ID} .g-coin-stat-value {
        font-size: 18px;
        font-family: "League Spartan", system-ui, sans-serif;
        color: #f9fafb;
      }

      #${MODULE_ID} .g-level-grid,
      #${MODULE_ID} .g-stats-grid,
      #${MODULE_ID} .g-records-grid,
      #${MODULE_ID} .g-ranking-grid {
        display: grid;
        gap: 10px;
      }

      #${MODULE_ID} .g-level-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #${MODULE_ID} .g-stats-grid,
      #${MODULE_ID} .g-records-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      #${MODULE_ID} .g-ranking-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

      #${MODULE_ID} .g-streak-hero {
        display: grid;
        grid-template-columns: 1.3fr .7fr;
        gap: 12px;
      }

      #${MODULE_ID} .g-streak-main {
        background: linear-gradient(135deg, rgba(245,158,11,.18), rgba(201,76,53,.12));
        border: 1px solid rgba(245,158,11,.22);
        border-radius: 18px;
        padding: 14px;
      }

      #${MODULE_ID} .g-streak-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.15);
        background: rgba(2,6,23,.55);
      }

      #${MODULE_ID} .g-streak-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 10px rgba(34,197,94,.8);
      }

      #${MODULE_ID} .g-streak-status.warning .g-streak-dot {
        background: #f59e0b;
        box-shadow: 0 0 10px rgba(245,158,11,.8);
      }

      #${MODULE_ID} .g-streak-status.broken .g-streak-dot {
        background: #ef4444;
        box-shadow: 0 0 10px rgba(239,68,68,.8);
      }

      #${MODULE_ID} .g-streak-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }

      #${MODULE_ID} .g-mission-progress {
        display: grid;
        gap: 6px;
        margin-top: 8px;
      }

      #${MODULE_ID} .g-rarity {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
        border-radius: 999px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: .05em;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.04);
        margin-top: 6px;
      }

      #${MODULE_ID} .g-rarity.common { color: #e5e7eb; }
      #${MODULE_ID} .g-rarity.rare { color: #93c5fd; }
      #${MODULE_ID} .g-rarity.epic { color: #c4b5fd; }
      #${MODULE_ID} .g-rarity.legendary { color: #fdba74; }

      #${MODULE_ID} .g-locked {
        opacity: .62;
        filter: grayscale(.15);
      }

      #${MODULE_ID} .g-ranking-pos {
        width: 42px;
        height: 42px;
        border-radius: 14px;
        background: rgba(124,58,237,.16);
        border: 1px solid rgba(124,58,237,.28);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 20px;
        color: #f9fafb;
        flex-shrink: 0;
      }

      #${MODULE_ID} .g-rewards-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr);
        gap: 12px;
        align-items: start;
      }

      #${MODULE_ID} .g-res-anchor-note {
        color: #d1d5db;
        font-size: 12px;
        line-height: 1.55;
        padding: 12px;
        border-radius: 16px;
        background: rgba(15,23,42,.75);
        border: 1px dashed rgba(255,255,255,.16);
      }

      #${MODULE_ID} .g-sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0,0,0,0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      @media (max-width: 1100px) {
        #${MODULE_ID} .g-stats-grid,
        #${MODULE_ID} .g-records-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        #${MODULE_ID} .g-actions-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 900px) {
        #${MODULE_ID} .g-span-8,
        #${MODULE_ID} .g-span-7,
        #${MODULE_ID} .g-span-6,
        #${MODULE_ID} .g-span-5,
        #${MODULE_ID} .g-span-4 {
          grid-column: span 12;
        }

        #${MODULE_ID} .g-profile-hero {
          grid-template-columns: 1fr;
          align-items: start;
        }

        #${MODULE_ID} .g-streak-hero,
        #${MODULE_ID} .g-rewards-layout {
          grid-template-columns: 1fr;
        }

        #${MODULE_ID} .g-level-grid,
        #${MODULE_ID} .g-coin-stats,
        #${MODULE_ID} .g-stats-grid,
        #${MODULE_ID} .g-records-grid,
        #${MODULE_ID} .g-ranking-grid,
        #${MODULE_ID} .g-streak-grid,
        #${MODULE_ID} .g-actions-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        #${MODULE_ID} .g-level-grid,
        #${MODULE_ID} .g-coin-stats,
        #${MODULE_ID} .g-stats-grid,
        #${MODULE_ID} .g-records-grid,
        #${MODULE_ID} .g-ranking-grid,
        #${MODULE_ID} .g-streak-grid,
        #${MODULE_ID} .g-actions-row {
          grid-template-columns: 1fr;
        }

        #${MODULE_ID} .g-coin-stat-label,
        #${MODULE_ID} .g-coin-stat-value,
        #${MODULE_ID} .g-quick-btn {
          white-space: normal;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getStatusText(status) {
    if (status === "warning") return "À relancer";
    if (status === "broken") return "À repartir";
    return "Actif";
  }

  function buildData(user = {}) {
    const data = utils.deepClone(MOCK_GAMIFICATION);

    const email = utils.normalizeEmail(user?.email || "");
    const displayName = utils.getDisplayName(user);
    const points = Number.isFinite(Number(user?.points)) ? Math.max(0, Math.floor(Number(user.points))) : 0;

    data.identity.displayName = displayName;
    data.identity.avatarText = utils.initialsFromText(displayName || email || "S");

    data.singcoins.balance = points;
    data.singcoins.earned = Math.max(points + Number(data.singcoins.used || 0), Number(data.singcoins.earned || 0));

    if (points >= state.config.loyaltyGoal) {
      data.singcoins.nextReward = "Séance offerte débloquée";
      data.identity.status = "Habitué confirmé";
    } else if (points >= 50) {
      data.identity.status = "Voix qui monte";
    }

    const sessionsCount = Number.isFinite(Number(user?.sessionsCount))
      ? Math.max(0, Math.floor(Number(user.sessionsCount)))
      : null;

    if (sessionsCount !== null) {
      data.stats.totalSessions = sessionsCount;
    }

    return data;
  }

  function renderShell() {
    if (!state.root) return;

    state.root.id = MODULE_ID;
    state.root.innerHTML = `
      <div class="g-grid">
        <section class="g-card g-span-12" id="gamif-actions-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Actions rapides</h2>
              <div class="g-subtitle">Accédez directement aux actions principales de votre compte.</div>
            </div>
          </div>
          <div class="g-actions-row" id="gamif-actions-row"></div>
        </section>

        <section class="g-card g-span-12" id="gamif-profile-section">
          <div class="g-profile-hero">
            <div class="g-avatar" id="gamif-avatar">S</div>

            <div>
              <div class="g-soft">Profil joueur</div>

              <div class="g-profile-name-row">
                <h2 class="g-profile-name" id="gamif-display-name">Singbox Player</h2>
                <div id="gamif-pseudo-read-mode">
                  <button type="button" class="g-inline-btn" id="gamif-edit-pseudo-btn">Modifier le pseudo</button>
                </div>
              </div>

              <form class="g-pseudo-form" id="gamif-pseudo-form" style="display:none;">
                <label class="g-sr-only" for="gamif-pseudo-input">Pseudo</label>
                <input id="gamif-pseudo-input" class="g-input" type="text" maxlength="${state.config.pseudoMaxLength}" placeholder="Votre pseudo" autocomplete="nickname" />
                <div class="g-pseudo-actions">
                  <button type="submit" class="g-inline-btn g-inline-btn-primary">Enregistrer</button>
                  <button type="button" class="g-inline-btn" id="gamif-cancel-pseudo-btn">Annuler</button>
                </div>
                <div class="g-help">Maximum ${state.config.pseudoMaxLength} caractères.</div>
                <div class="g-message" id="gamif-pseudo-message" aria-live="polite" role="status"></div>
              </form>

              <div class="g-soft" id="gamif-email-line">Email : —</div>

              <div class="g-pills">
                <span class="g-pill"><span class="g-mini-icon">★</span><span id="gamif-member-since">Membre depuis janvier 2026</span></span>
                <span class="g-pill"><span class="g-mini-icon">🎤</span><span id="gamif-level-pill">Niveau Rising Star</span></span>
                <span class="g-pill"><span class="g-mini-icon">🔥</span><span id="gamif-streak-pill">Streak : 0</span></span>
              </div>
            </div>

            <div class="g-status-card">
              <div class="g-soft g-soft-success">Statut actuel</div>
              <strong id="gamif-status-text" style="color:#f9fafb;">Chanteur en progression</strong>
              <div class="g-soft" id="gamif-status-subline" style="margin-top:6px;">Votre profil évolue à chaque réservation.</div>
            </div>
          </div>
        </section>

        <section class="g-card g-span-8" id="gamif-reservations-anchor">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Réservations</h2>
              <div class="g-subtitle">Cette zone correspond à l’emplacement prévu pour remonter votre bloc réservations dans la page finale.</div>
            </div>
          </div>
          <div class="g-res-anchor-note">
            Lors du branchement dans <strong>mon-compte.html</strong>, le bloc réel “Mes informations & réservations” devra être déplacé juste ici, avant les blocs de gamification détaillés.
          </div>
        </section>

        <section class="g-card g-span-4" id="gamif-benefits-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Avantages du compte</h2>
              <div class="g-subtitle">Vos avantages restent visibles juste après les réservations.</div>
            </div>
          </div>
          <div class="g-benefits-list" id="gamif-benefits-list"></div>
        </section>

        <section class="g-card g-span-7" id="gamif-singcoins-section">
          <div class="g-coin-top">
            <div>
              <h2 class="g-title">Singcoins</h2>
              <div class="g-subtitle">Votre programme fidélité principal reste très visible.</div>
            </div>
            <div class="g-coin-highlight" id="gamif-next-reward">Prochaine récompense : séance offerte à 100 Singcoins</div>
          </div>

          <div class="g-bignumber" id="gamif-singcoins-balance">0</div>
          <div class="g-soft" style="margin-top:6px;">Solde actuel Singcoins</div>

          <div class="g-progress-wrap">
            <div class="g-progress-head">
              <span class="g-soft">Progression récompense</span>
              <span class="g-soft" id="gamif-loyalty-value">0 / 100</span>
            </div>
            <div class="g-progress-bar"><div class="g-progress-fill" id="gamif-loyalty-fill" style="width:0%;"></div></div>
            <div class="g-soft" id="gamif-loyalty-text">Connectez-vous pour voir votre progression.</div>
          </div>

          <div class="g-coin-stats">
            <div class="g-coin-stat">
              <span class="g-coin-stat-label">Solde actuel</span>
              <strong class="g-coin-stat-value" id="gamif-points-current">0</strong>
            </div>
            <div class="g-coin-stat">
              <span class="g-coin-stat-label">Total gagné</span>
              <strong class="g-coin-stat-value" id="gamif-points-earned">0</strong>
            </div>
            <div class="g-coin-stat">
              <span class="g-coin-stat-label">Total utilisé</span>
              <strong class="g-coin-stat-value" id="gamif-points-used">0</strong>
            </div>
          </div>
        </section>

        <section class="g-card g-span-5" id="gamif-singcoins-help-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Comment gagner des Singcoins</h2>
              <div class="g-subtitle">Bloc pédagogique visuel, sans dépendance backend complète.</div>
            </div>
          </div>
          <div class="g-source-list" id="gamif-singcoins-sources"></div>
        </section>

        <section class="g-card g-span-7" id="gamif-xp-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Niveau / XP / progression</h2>
              <div class="g-subtitle">Votre niveau évolue avec votre activité sur Singbox.</div>
            </div>
          </div>

          <div class="g-level-grid">
            <div class="g-subcard">
              <div class="g-soft">Niveau actuel</div>
              <div class="g-bignumber" id="gamif-level-current">3</div>
            </div>
            <div class="g-subcard">
              <div class="g-soft">Nom du niveau</div>
              <div class="g-bignumber" id="gamif-level-name">Rising Star</div>
            </div>
          </div>

          <div class="g-progress-wrap">
            <div class="g-progress-head">
              <span class="g-soft">XP actuelle : <strong id="gamif-xp-current">240</strong></span>
              <span class="g-soft">Objectif suivant : <strong id="gamif-xp-next">400 XP</strong></span>
            </div>
            <div class="g-progress-bar"><div class="g-progress-fill g-progress-fill-xp" id="gamif-xp-fill" style="width:60%;"></div></div>
            <div class="g-soft" id="gamif-xp-text">Plus que 160 XP pour atteindre le niveau suivant.</div>
          </div>
        </section>

        <section class="g-card g-span-5" id="gamif-xp-help-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Comment gagner de l’XP</h2>
              <div class="g-subtitle">Un bloc pédagogique prêt pour le futur système.</div>
            </div>
          </div>
          <div class="g-source-list" id="gamif-xp-sources"></div>
        </section>

        <section class="g-card g-span-12" id="gamif-streak-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Streak</h2>
              <div class="g-subtitle">Votre régularité reste bien mise en avant.</div>
            </div>
          </div>

          <div class="g-streak-hero">
            <div class="g-streak-main">
              <div class="g-streak-main-top">
                <div>
                  <div class="g-soft">Streak actuel</div>
                  <div class="g-bignumber" id="gamif-streak-current-value">4 jours</div>
                </div>
                <div class="g-streak-status" id="gamif-streak-status">
                  <span class="g-streak-dot"></span>
                  <span id="gamif-streak-status-text">Actif</span>
                </div>
              </div>
              <div class="g-soft" style="margin-top:10px;" id="gamif-streak-deadline">Reviens avant le 24 mars à 23h59 pour conserver ton streak.</div>
            </div>

            <div class="g-streakbox">
              <div class="g-soft">Jokers disponibles</div>
              <div class="g-bignumber" id="gamif-streak-jokers">1</div>
              <div class="g-soft" id="gamif-streak-joker-help">S’active automatiquement si vous manquez une période et prolonge votre streak.</div>
            </div>
          </div>

          <div class="g-streak-grid">
            <div class="g-streakbox">
              <div class="g-soft">Meilleur streak</div>
              <div class="g-bignumber" id="gamif-streak-best">8</div>
            </div>
            <div class="g-streakbox">
              <div class="g-soft">État actuel</div>
              <div class="g-bignumber" id="gamif-streak-state">Actif</div>
            </div>
            <div class="g-streakbox">
              <div class="g-soft">Dernière activité</div>
              <div class="g-bignumber" id="gamif-streak-last-activity">Hier</div>
            </div>
            <div class="g-streakbox">
              <div class="g-soft">Rythme actuel</div>
              <div class="g-bignumber" id="gamif-streak-rhythm">Très bon</div>
            </div>
          </div>
        </section>

        <section class="g-card g-span-12" id="gamif-missions-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Missions</h2>
              <div class="g-subtitle">Des objectifs motivants, clairs et visuels.</div>
            </div>
          </div>
          <div class="g-vertical-list" id="gamif-missions-list"></div>
        </section>

        <section class="g-card g-span-6" id="gamif-stats-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Stats globales</h2>
              <div class="g-subtitle">Votre vue d’ensemble d’activité.</div>
            </div>
          </div>
          <div class="g-stats-grid" id="gamif-stats-grid"></div>
        </section>

        <section class="g-card g-span-6" id="gamif-records-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Records</h2>
              <div class="g-subtitle">Vos meilleures performances récentes.</div>
            </div>
          </div>
          <div class="g-records-grid" id="gamif-records-grid"></div>
        </section>

        <section class="g-card g-span-6" id="gamif-badges-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Badges / succès</h2>
              <div class="g-subtitle">Vos badges débloqués et ceux à viser.</div>
            </div>
          </div>
          <div class="g-vertical-list" id="gamif-badges-list"></div>
        </section>

        <section class="g-card g-span-6" id="gamif-ranking-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Classement</h2>
              <div class="g-subtitle">Votre position dans la dynamique Singbox.</div>
            </div>
          </div>

          <div class="g-ranking-grid" id="gamif-ranking-grid"></div>

          <div class="g-subcard" style="margin-top:10px;">
            <div class="g-soft">Top 3 résumé</div>
            <div class="g-soft" id="gamif-ranking-top" style="margin-top:6px;"></div>
          </div>
        </section>

        <section class="g-card g-span-12" id="gamif-rewards-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Coffre / récompenses</h2>
              <div class="g-subtitle">Vos récompenses à débloquer et votre historique récent.</div>
            </div>
          </div>

          <div class="g-rewards-layout">
            <div class="g-item">
              <span class="g-badge-icon">🎁</span>
              <div class="g-item-content">
                <strong id="gamif-chest-title" style="color:#f9fafb;">Coffre Bronze</strong>
                <div class="g-soft" id="gamif-chest-condition">Débloqué après 2 sessions ce mois-ci</div>
                <div class="g-soft" id="gamif-chest-reward">Récompense possible : +10 Singcoins</div>
              </div>
            </div>

            <div class="g-reward-history" id="gamif-rewards-history"></div>
          </div>
        </section>
      </div>
    `;
  }

  function renderQuickActions() {
    const el = document.getElementById("gamif-actions-row");
    if (!el) return;

    el.innerHTML = `
      <a class="g-quick-btn g-quick-btn-primary" href="${utils.safeHtml(state.config.reservationUrl)}">Réserver</a>
      <button class="g-quick-btn g-quick-btn-secondary" type="button" data-gamif-action="singcoins">Mes Singcoins</button>
      <button class="g-quick-btn g-quick-btn-secondary" type="button" data-gamif-action="rewards">Récompenses</button>
      <button class="g-quick-btn g-quick-btn-secondary" type="button" data-gamif-action="ranking">Classement</button>
      <a class="g-quick-btn g-quick-btn-secondary" href="${utils.safeHtml(state.config.reservationUrl)}">Reprendre mon streak</a>
    `;
  }

  function renderBenefits() {
    const el = document.getElementById("gamif-benefits-list");
    if (!el) return;

    const items = [
      { icon: "🎟", title: "QR code instantané", text: "Retrouvez votre accès directement depuis votre espace client." },
      { icon: "⏰", title: "Modification simplifiée", text: "Changez votre réservation jusqu’à 6h avant selon disponibilité." },
      { icon: "★", title: "Fidélité automatique", text: "Chaque réservation payante alimente votre progression Singcoins." }
    ];

    el.innerHTML = items.map((item) => `
      <div class="g-item">
        <span class="g-benefit-icon">${utils.safeHtml(item.icon)}</span>
        <div class="g-item-content">
          <strong style="color:#f9fafb;">${utils.safeHtml(item.title)}</strong>
          <div class="g-soft">${utils.safeHtml(item.text)}</div>
        </div>
      </div>
    `).join("");
  }

  function renderSourceCards() {
    const singcoinsEl = document.getElementById("gamif-singcoins-sources");
    const xpEl = document.getElementById("gamif-xp-sources");

    if (singcoinsEl) {
      const items = [
        { icon: "🎟", title: "Réservation", text: "10 Singcoins gagnés par réservation." },
        { icon: "🏅", title: "Succès", text: "Certains succès débloquent des bonus ponctuels." },
        { icon: "✨", title: "Badges", text: "Quelques badges peuvent offrir des gains supplémentaires." },
        { icon: "🎁", title: "Coffres", text: "Les récompenses spéciales peuvent ajouter des Singcoins." },
        { icon: "🔁", title: "Régularité", text: "Un bonus toutes les 5 sessions peut être ajouté plus tard." }
      ];

      singcoinsEl.innerHTML = items.map((item) => `
        <div class="g-source-card">
          <div class="g-item" style="padding:0;border:none;background:transparent;">
            <span class="g-badge-icon">${utils.safeHtml(item.icon)}</span>
            <div class="g-item-content">
              <strong style="color:#f9fafb;">${utils.safeHtml(item.title)}</strong>
              <div class="g-soft">${utils.safeHtml(item.text)}</div>
            </div>
          </div>
        </div>
      `).join("");
    }

    if (xpEl) {
      const items = [
        { icon: "🎤", title: "Réservations", text: "Chaque réservation participe à votre progression XP." },
        { icon: "🔥", title: "Régularité", text: "Entretenir son streak peut accélérer la progression." },
        { icon: "✅", title: "Missions", text: "Les missions accomplies peuvent rapporter de l’XP." },
        { icon: "🌟", title: "Succès", text: "Débloquer certains succès peut donner un bonus d’XP." },
        { icon: "🎁", title: "Bonus spéciaux", text: "Des coffres et événements spéciaux pourront aussi rapporter de l’XP." }
      ];

      xpEl.innerHTML = items.map((item) => `
        <div class="g-source-card">
          <div class="g-item" style="padding:0;border:none;background:transparent;">
            <span class="g-badge-icon">${utils.safeHtml(item.icon)}</span>
            <div class="g-item-content">
              <strong style="color:#f9fafb;">${utils.safeHtml(item.title)}</strong>
              <div class="g-soft">${utils.safeHtml(item.text)}</div>
            </div>
          </div>
        </div>
      `).join("");
    }
  }

  function renderIdentity(data, user) {
    const email = utils.normalizeEmail(user?.email || "");
    const displayName = data.identity.displayName || "Singbox Player";

    const avatar = document.getElementById("gamif-avatar");
    const displayNameEl = document.getElementById("gamif-display-name");
    const emailLine = document.getElementById("gamif-email-line");
    const memberSince = document.getElementById("gamif-member-since");
    const levelPill = document.getElementById("gamif-level-pill");
    const streakPill = document.getElementById("gamif-streak-pill");
    const statusText = document.getElementById("gamif-status-text");
    const statusSubline = document.getElementById("gamif-status-subline");

    if (avatar) avatar.textContent = data.identity.avatarText || "S";
    if (displayNameEl) displayNameEl.textContent = displayName;
    if (emailLine) emailLine.textContent = `Email : ${email || "—"}`;
    if (memberSince) memberSince.textContent = `Membre depuis ${data.identity.memberSince}`;
    if (levelPill) levelPill.textContent = `Niveau ${data.level.name}`;
    if (streakPill) streakPill.textContent = `Streak : ${data.streak.current}`;
    if (statusText) statusText.textContent = data.identity.status;
    if (statusSubline) {
      statusSubline.textContent = email
        ? "Votre profil se renforce à chaque session et récompense débloquée."
        : "Connectez-vous pour personnaliser votre profil et suivre votre progression.";
    }
  }

  function renderSingcoins(data) {
    const balance = Number(data.singcoins.balance || 0);
    const used = Number(data.singcoins.used || 0);
    const earned = Number(data.singcoins.earned || 0);
    const progressValue = Math.min(balance, state.config.loyaltyGoal);
    const progress = utils.pct(progressValue, state.config.loyaltyGoal);
    const remaining = Math.max(0, state.config.loyaltyGoal - balance);

    const nextReward = document.getElementById("gamif-next-reward");
    const balanceEl = document.getElementById("gamif-singcoins-balance");
    const loyaltyValue = document.getElementById("gamif-loyalty-value");
    const loyaltyFill = document.getElementById("gamif-loyalty-fill");
    const loyaltyText = document.getElementById("gamif-loyalty-text");
    const current = document.getElementById("gamif-points-current");
    const earnedEl = document.getElementById("gamif-points-earned");
    const usedEl = document.getElementById("gamif-points-used");

    if (nextReward) nextReward.textContent = `Prochaine récompense : ${data.singcoins.nextReward}`;
    if (balanceEl) balanceEl.textContent = String(balance);
    if (loyaltyValue) loyaltyValue.textContent = `${progressValue} / ${state.config.loyaltyGoal}`;
    if (loyaltyFill) loyaltyFill.style.width = `${progress}%`;
    if (loyaltyText) loyaltyText.textContent = balance >= state.config.loyaltyGoal
      ? "Bravo ! Votre palier principal est atteint."
      : `Plus que ${remaining} Singcoins avant votre séance offerte.`;
    if (current) current.textContent = String(balance);
    if (earnedEl) earnedEl.textContent = String(earned);
    if (usedEl) usedEl.textContent = String(used);
  }

  function renderLevel(data) {
    const currentXp = Number(data.level.xpCurrent || 0);
    const nextXp = Number(data.level.xpNextLevel || 1);
    const progress = utils.pct(currentXp, nextXp);
    const remaining = Math.max(0, nextXp - currentXp);

    const levelCurrent = document.getElementById("gamif-level-current");
    const levelName = document.getElementById("gamif-level-name");
    const xpCurrent = document.getElementById("gamif-xp-current");
    const xpNext = document.getElementById("gamif-xp-next");
    const xpFill = document.getElementById("gamif-xp-fill");
    const xpText = document.getElementById("gamif-xp-text");

    if (levelCurrent) levelCurrent.textContent = String(data.level.current);
    if (levelName) levelName.textContent = data.level.name;
    if (xpCurrent) xpCurrent.textContent = String(currentXp);
    if (xpNext) xpNext.textContent = `${nextXp} XP`;
    if (xpFill) xpFill.style.width = `${progress}%`;
    if (xpText) xpText.textContent = `Plus que ${remaining} XP pour atteindre le niveau suivant.`;
  }

  function renderStreak(data) {
    const currentValue = document.getElementById("gamif-streak-current-value");
    const status = document.getElementById("gamif-streak-status");
    const statusText = document.getElementById("gamif-streak-status-text");
    const deadline = document.getElementById("gamif-streak-deadline");
    const jokers = document.getElementById("gamif-streak-jokers");
    const best = document.getElementById("gamif-streak-best");
    const stateText = document.getElementById("gamif-streak-state");
    const lastActivity = document.getElementById("gamif-streak-last-activity");
    const rhythm = document.getElementById("gamif-streak-rhythm");
    const jokerHelp = document.getElementById("gamif-streak-joker-help");

    if (currentValue) currentValue.textContent = `${data.streak.current} jours`;
    if (deadline) deadline.textContent = data.streak.deadlineText;
    if (jokers) jokers.textContent = String(data.streak.jokers);
    if (best) best.textContent = String(data.streak.best);
    if (stateText) stateText.textContent = getStatusText(data.streak.status);
    if (lastActivity) lastActivity.textContent = data.streak.lastActivity;
    if (rhythm) rhythm.textContent = data.streak.rhythm;
    if (statusText) statusText.textContent = getStatusText(data.streak.status);
    if (jokerHelp) jokerHelp.textContent = "S’active automatiquement si vous manquez une période et prolonge votre streak.";

    if (status) {
      status.className = "g-streak-status";
      if (data.streak.status === "warning") status.classList.add("warning");
      if (data.streak.status === "broken") status.classList.add("broken");
    }
  }

  function renderMissions(data) {
    const el = document.getElementById("gamif-missions-list");
    if (!el) return;

    el.innerHTML = data.missions.map((mission) => {
      const progress = utils.clamp(Number(mission.progress || 0), 0, 100);

      return `
        <div class="g-item">
          <span class="g-badge-icon">${mission.done ? "✓" : "🎯"}</span>
          <div class="g-item-content">
            <strong style="color:#f9fafb;">${utils.safeHtml(mission.title)}</strong>
            <div class="g-soft">Récompense : ${utils.safeHtml(mission.reward)}</div>
            <div class="g-mission-progress">
              <div class="g-soft">${mission.done ? "Mission terminée" : `Progression : ${progress}%`}</div>
              <div class="g-mini-progress"><span style="width:${progress}%;"></span></div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderStats(data) {
    const el = document.getElementById("gamif-stats-grid");
    if (!el) return;

    const items = [
      { label: "Sessions totales", value: String(data.stats.totalSessions) },
      { label: "Temps chanté", value: data.stats.totalTime },
      { label: "Chansons chantées", value: String(data.stats.totalSongs) },
      { label: "Moyenne / session", value: String(data.stats.averageSongs) },
      { label: "Dernière session", value: data.stats.lastSession }
    ];

    el.innerHTML = items.map((item) => `
      <div class="g-statbox">
        <div class="g-soft">${utils.safeHtml(item.label)}</div>
        <div class="g-bignumber" style="font-size:22px;">${utils.safeHtml(item.value)}</div>
      </div>
    `).join("");
  }

  function renderRecords(data) {
    const el = document.getElementById("gamif-records-grid");
    if (!el) return;

    const items = [
      { label: "Meilleur streak", value: String(data.records.bestStreak) },
      { label: "Semaine la plus active", value: data.records.activeWeek },
      { label: "Plus grosse session", value: data.records.biggestSession },
      { label: "Record chansons", value: String(data.records.songsPerSession) },
      { label: "Record temps", value: data.records.timePerSession }
    ];

    el.innerHTML = items.map((item) => `
      <div class="g-recordbox">
        <div class="g-soft">${utils.safeHtml(item.label)}</div>
        <div class="g-bignumber" style="font-size:22px;">${utils.safeHtml(item.value)}</div>
      </div>
    `).join("");
  }

  function renderBadges(data) {
    const el = document.getElementById("gamif-badges-list");
    if (!el) return;

    el.innerHTML = data.badges.map((badge) => `
      <div class="g-item ${badge.unlocked ? "" : "g-locked"}">
        <span class="g-badge-icon">${utils.safeHtml(badge.icon || "★")}</span>
        <div class="g-item-content">
          <strong style="color:#f9fafb;">${utils.safeHtml(badge.title)}</strong>
          <div class="g-soft">${utils.safeHtml(badge.desc)}</div>
          <span class="g-rarity ${utils.safeHtml(badge.rarity || "common")}">${utils.safeHtml(badge.rarity || "common")}</span>
          ${badge.date ? `<div class="g-soft" style="margin-top:6px;">Obtenu le ${utils.safeHtml(badge.date)}</div>` : ""}
        </div>
      </div>
    `).join("");
  }

  function renderRanking(data) {
    const el = document.getElementById("gamif-ranking-grid");
    const top = document.getElementById("gamif-ranking-top");
    if (!el) return;

    const items = [
      { position: data.ranking.weeklyPosition, title: "Classement hebdo", text: data.ranking.weeklyText },
      { position: data.ranking.globalPosition, title: "Classement global", text: data.ranking.globalText }
    ];

    el.innerHTML = items.map((item) => `
      <div class="g-item">
        <span class="g-ranking-pos">${utils.safeHtml(item.position)}</span>
        <div class="g-item-content">
          <strong style="color:#f9fafb;">${utils.safeHtml(item.title)}</strong>
          <div class="g-soft">${utils.safeHtml(item.text)}</div>
        </div>
      </div>
    `).join("");

    if (top) top.textContent = data.ranking.topSummary;
  }

  function renderRewards(data) {
    const title = document.getElementById("gamif-chest-title");
    const condition = document.getElementById("gamif-chest-condition");
    const reward = document.getElementById("gamif-chest-reward");
    const history = document.getElementById("gamif-rewards-history");

    if (title) title.textContent = data.chest.title;
    if (condition) condition.textContent = data.chest.condition;
    if (reward) reward.textContent = data.chest.reward;

    if (history) {
      history.innerHTML = (data.chest.history || []).map((entry) => `
        <div class="g-subcard">${utils.safeHtml(entry)}</div>
      `).join("");
    }
  }

  function setPseudoMessage(message, type = "") {
    const el = document.getElementById("gamif-pseudo-message");
    if (!el) return;
    el.textContent = message;
    el.className = "g-message";
    if (type) el.classList.add(type);
  }

  function setPseudoEditMode(isEditing) {
    const readMode = document.getElementById("gamif-pseudo-read-mode");
    const form = document.getElementById("gamif-pseudo-form");
    const input = document.getElementById("gamif-pseudo-input");
    const title = document.getElementById("gamif-display-name");

    if (readMode) readMode.style.display = isEditing ? "none" : "";
    if (form) form.style.display = isEditing ? "" : "none";

    if (isEditing && input && title) {
      input.value = title.textContent || "";
      input.focus();
      input.select();
    }
  }

  function bindEvents() {
    state.root?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const actionBtn = target.closest("[data-gamif-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-gamif-action");
        if (action === "singcoins") utils.scrollTo(state.config.anchors.singcoins);
        if (action === "rewards") utils.scrollTo(state.config.anchors.rewards);
        if (action === "ranking") utils.scrollTo(state.config.anchors.ranking);
        return;
      }

      if (target.id === "gamif-edit-pseudo-btn") {
        setPseudoMessage("");
        setPseudoEditMode(true);
        return;
      }

      if (target.id === "gamif-cancel-pseudo-btn") {
        setPseudoMessage("");
        setPseudoEditMode(false);
      }
    });

    state.root?.addEventListener("submit", (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || form.id !== "gamif-pseudo-form") return;

      event.preventDefault();

      const email = utils.normalizeEmail(state.user?.email || "");
      const input = document.getElementById("gamif-pseudo-input");

      if (!(input instanceof HTMLInputElement)) return;

      if (!email) {
        setPseudoMessage("Connectez-vous pour personnaliser votre pseudo.", "error");
        return;
      }

      const value = utils.sanitizePseudo(input.value);
      input.value = value;

      if (!value) {
        setPseudoMessage("Le pseudo ne peut pas être vide.", "error");
        return;
      }

      utils.setStoredPseudo(email, value);
      setPseudoMessage("Pseudo enregistré.", "ok");
      setPseudoEditMode(false);
      refresh();
    });

    state.root?.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target || target.id !== "gamif-pseudo-input") return;
      target.value = utils.sanitizePseudo(target.value);
    });
  }

  function renderAll() {
    const data = buildData(state.user || {});
    state.data = data;

    renderQuickActions();
    renderBenefits();
    renderSourceCards();
    renderIdentity(data, state.user || {});
    renderSingcoins(data);
    renderLevel(data);
    renderStreak(data);
    renderMissions(data);
    renderStats(data);
    renderRecords(data);
    renderBadges(data);
    renderRanking(data);
    renderRewards(data);
  }

  function mount(options = {}) {
    state.config = {
      ...DEFAULTS,
      ...state.config,
      ...options
    };

    const root = document.querySelector(state.config.mountSelector);
    if (!root) {
      console.warn("[SingboxGamification] Conteneur introuvable :", state.config.mountSelector);
      return;
    }

    state.root = root;
    injectStyles();
    renderShell();
    renderAll();
    bindEvents();
    state.mounted = true;
  }

  function updateUser(user = {}) {
    state.user = {
      ...(state.user || {}),
      ...user
    };

    if (state.mounted) renderAll();
  }

  function renderLoggedOut() {
    state.user = {
      email: "",
      points: 0
    };

    if (state.mounted) renderAll();
  }

  function refresh() {
    if (state.mounted) renderAll();
  }

  window.SingboxGamification = {
    mount,
    updateUser,
    renderLoggedOut,
    refresh
  };
})();
