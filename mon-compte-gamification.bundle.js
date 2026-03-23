(function () {
  "use strict";

  const MODULE_ID = "singbox-gamification";
  const STYLE_ID = "singbox-gamification-styles";

  const DEFAULTS = {
    mountSelector: "#gamification-root",
    pseudoMaxLength: 20,
    loyaltyGoal: 100,
    reservationUrl: "reservation.html",
    reservationsCardSelector: "#account-reservations-card",
    benefitsCardSelector: "#account-benefits-card",
    selectors: {
      reservationsSlot: "#gamif-reservations-slot",
      benefitsSlot: "#gamif-benefits-slot"
    },
    anchors: {
      reservations: "#gamif-reservations-anchor",
      singcoins: "#gamif-singcoins-section",
      level: "#gamif-xp-section",
      missions: "#gamif-xp-section",
      streak: "#gamif-streak-section",
      badges: "#gamif-badges-section"
    },
    scrollOffset: 110
  };

  const STORAGE_KEYS = {
    pseudoPrefix: "singbox_profile_pseudo__"
  };

  const state = {
    config: { ...DEFAULTS },
    mounted: false,
    root: null,
    user: null,
    data: null,
    eventsBound: false
  };

  const MOCK_GAMIFICATION = {
    identity: {
      displayName: "Singbox Player",
      avatarText: "S",
      memberSince: "janvier 2026",
      status: "Chanteur en progression"
    },
    level: {
      current: 1,
      name: "Nouveau",
      xpCurrent: 0,
      xpNextLevel: 100,
      xpTotal: 0
    },
    streak: {
      current: 0,
      best: 0,
      deadlineText: "Fais au moins une session validée cette semaine pour lancer ton streak.",
      jokers: 0,
      status: "broken",
      lastActivity: "—",
      rhythm: "À lancer"
    },
    singcoins: {
      balance: 0,
      earned: 0,
      used: 0,
      nextReward: "Séance offerte à 100 Singcoins"
    },
    stats: {
      totalSessions: 0,
      totalTime: "0h",
      totalSongs: 0,
      lastSession: "—"
    },
    records: {
      bestStreak: 0,
      activeWeek: "—",
      biggestSession: "—",
      timePerSession: "—"
    },
    missions: [
      { id: "book_once_week", title: "Une session cette semaine", progress: 0, reward: "+5 Singcoins • +10 XP", done: false },
      { id: "come_with_3_people", title: "Venir en groupe", progress: 0, reward: "+5 Singcoins • +10 XP", done: false },
      { id: "weekday_booking", title: "Créneau semaine", progress: 0, reward: "+10 Singcoins • +10 XP", done: false }
    ],
    badges: []
  };

  const BADGE_DEFINITIONS = [
    {
      key: "first_session",
      code: "first_session",
      icon: "🎤",
      title: "Première session",
      desc: "Faire une première session réalisée.",
      rarity: "common",
      rewardSingcoins: 5
    },
    {
      key: "group_3_plus",
      code: "group_3_plus",
      icon: "👥",
      title: "Session en groupe",
      desc: "Faire une session à 3 personnes ou plus.",
      rarity: "common",
      rewardSingcoins: 5
    },
    {
      key: "two_sessions",
      code: "two_sessions",
      icon: "🔁",
      title: "2 sessions réalisées",
      desc: "Faire 2 sessions réalisées.",
      rarity: "common",
      rewardSingcoins: 5
    },
    {
      key: "three_week_streak",
      code: "three_week_streak",
      icon: "🔥",
      title: "3 semaines d’affilée",
      desc: "Atteindre un streak de 3 semaines.",
      rarity: "rare",
      rewardSingcoins: 10
    },
    {
      key: "group_5_plus",
      code: "group_5_plus",
      icon: "👥",
      title: "Groupe de 5+",
      desc: "Faire une session à 5 personnes ou plus.",
      rarity: "rare",
      rewardSingcoins: 10
    },
    {
      key: "five_sessions",
      code: "five_sessions",
      icon: "📅",
      title: "5 sessions réalisées",
      desc: "Faire 5 sessions réalisées.",
      rarity: "rare",
      rewardSingcoins: 10
    },
    {
      key: "three_sessions_in_7_days",
      code: "three_sessions_in_7_days",
      icon: "🎶",
      title: "3 sessions en 7 jours",
      desc: "Faire 3 sessions réalisées sur 7 jours glissants.",
      rarity: "rare",
      rewardSingcoins: 10
    },
    {
      key: "ten_sessions",
      code: "ten_sessions",
      icon: "🚀",
      title: "10 sessions réalisées",
      desc: "Faire 10 sessions réalisées.",
      rarity: "epic",
      rewardSingcoins: 15
    },
    {
      key: "five_week_streak",
      code: "five_week_streak",
      icon: "🔥",
      title: "Streak de 5 semaines",
      desc: "Atteindre un streak de 5 semaines.",
      rarity: "epic",
      rewardSingcoins: 15
    },
    {
      key: "group_8_plus",
      code: "group_8_plus",
      icon: "👥",
      title: "Groupe de 8+",
      desc: "Faire une session à 8 personnes ou plus.",
      rarity: "epic",
      rewardSingcoins: 15
    },
    {
      key: "three_sessions_one_week",
      code: "three_sessions_one_week",
      icon: "🔁",
      title: "3 sessions en 1 semaine",
      desc: "Faire 3 sessions réalisées dans une même semaine.",
      rarity: "epic",
      rewardSingcoins: 15
    },
    {
      key: "twenty_five_sessions",
      code: "twenty_five_sessions",
      icon: "🐐",
      title: "25 sessions réalisées",
      desc: "Faire 25 sessions réalisées.",
      rarity: "legendary",
      rewardSingcoins: 20
    },
    {
      key: "ten_week_streak",
      code: "ten_week_streak",
      icon: "👑",
      title: "Streak de 10 semaines",
      desc: "Atteindre un streak de 10 semaines.",
      rarity: "legendary",
      rewardSingcoins: 20
    },
    {
      key: "ten_group_sessions_5_plus",
      code: "ten_group_sessions_5_plus",
      icon: "🎉",
      title: "10 sessions en groupe (5+)",
      desc: "Faire 10 sessions à 5 personnes ou plus.",
      rarity: "legendary",
      rewardSingcoins: 20
    },
    {
      key: "four_weeks_two_sessions_each",
      code: "four_weeks_two_sessions_each",
      icon: "🔥",
      title: "4 semaines à 2 sessions",
      desc: "Faire 4 semaines consécutives avec au moins 2 sessions par semaine.",
      rarity: "legendary",
      rewardSingcoins: 20
    }
  ];

  const LEVEL_NAMES = [
    { min: 1, max: 9, name: "Nouveau" },
    { min: 10, max: 19, name: "Apprenti de scène" },
    { min: 20, max: 29, name: "Voix montante" },
    { min: 30, max: 39, name: "Performer du vendredi" },
    { min: 40, max: 49, name: "Ambianceur confirmé" },
    { min: 50, max: 59, name: "Tête d'affiche" },
    { min: 60, max: 69, name: "Maître du micro" },
    { min: 70, max: 79, name: "Bête de scène" },
    { min: 80, max: 89, name: "Légende locale" },
    { min: 90, max: 99, name: "Icône Singbox" },
    { min: 100, max: 100, name: "Star absolue" }
  ];

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
      if (!el) return;

      const top = window.scrollY + el.getBoundingClientRect().top - Number(state.config.scrollOffset || 110);
      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    },

    getLevelName(level) {
      const lvl = Math.max(1, Math.min(100, Number(level) || 1));
      const match = LEVEL_NAMES.find((item) => lvl >= item.min && lvl <= item.max);
      return match ? match.name : "Nouveau";
    },

    toNumber(value, fallback = 0) {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    },

    formatMonthYear(value) {
      if (!value) return "janvier 2026";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "janvier 2026";
      try {
        return new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          year: "numeric"
        }).format(date);
      } catch {
        return "janvier 2026";
      }
    },

    formatShortDate(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return utils.safeText(value, 40) || "—";
      try {
        return new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }).format(date);
      } catch {
        return "—";
      }
    },

    formatLastActivity(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays <= 0) return "Aujourd’hui";
      if (diffDays === 1) return "Hier";
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      return utils.formatShortDate(value);
    },

    formatDurationMinutes(minutes) {
      const mins = Math.max(0, Math.floor(utils.toNumber(minutes, 0)));
      if (!mins) return "—";
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
      if (h) return `${h}h`;
      return `${m} min`;
    },

    formatBiggestSession(value) {
      const n = Math.max(0, Math.floor(utils.toNumber(value, 0)));
      if (!n) return "—";
      return `${n} pers.`;
    },

    formatRewardText(mission) {
      const singcoins = Math.max(0, Math.floor(utils.toNumber(mission?.rewardSingcoins, 0)));
      const xp = Math.max(0, Math.floor(utils.toNumber(mission?.rewardXp, 0)));
      const parts = [];
      if (singcoins > 0) parts.push(`+${singcoins} Singcoins`);
      if (xp > 0) parts.push(`+${xp} XP`);
      return parts.join(" • ") || "Récompense à venir";
    },

    formatBadgeRewardText(badge) {
      const singcoins = Math.max(0, Math.floor(utils.toNumber(badge?.rewardSingcoins, 0)));
      if (singcoins <= 0) return "";
      return `Récompense : +${singcoins} Singcoins`;
    },

    normalizeBadgeKey(value) {
      return utils.safeText(value, 120)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_ -]+/g, "")
        .replace(/[\s-]+/g, "_")
        .replace(/^_+|_+$/g, "");
    },

    getBadgeLookupKeys(badge) {
      const keys = new Set();
      const raw = [
        badge?.code,
        badge?.id,
        badge?.key,
        badge?.slug,
        badge?.title,
        badge?.name
      ];

      raw.forEach((item) => {
        const normalized = utils.normalizeBadgeKey(item);
        if (normalized) keys.add(normalized);
      });

      return Array.from(keys);
    },

    deriveStatus(levelCurrent, sessionsCount) {
      const level = Math.max(1, Math.floor(utils.toNumber(levelCurrent, 1)));
      const sessions = Math.max(0, Math.floor(utils.toNumber(sessionsCount, 0)));

      if (level >= 50 || sessions >= 30) return "Habitué confirmé";
      if (level >= 20 || sessions >= 10) return "Voix qui monte";
      return "Chanteur en progression";
    },

    formatWeeks(value) {
      const n = Math.max(0, Math.floor(utils.toNumber(value, 0)));
      return `${n} semaine${n > 1 ? "s" : ""}`;
    },

    computeMissionProgressLabel(progressValue, targetValue, isCompleted) {
      if (isCompleted) return "Mission terminée";
      const safeTarget = Math.max(1, Math.floor(utils.toNumber(targetValue, 1)));
      const safeProgress = Math.max(0, Math.floor(utils.toNumber(progressValue, 0)));
      return `Progression : ${Math.min(safeProgress, safeTarget)} / ${safeTarget}`;
    },

    guessActiveWeek(stats) {
      const total30 = Math.max(0, Math.floor(utils.toNumber(stats?.sessions_last_30_days, 0)));
      const total7 = Math.max(0, Math.floor(utils.toNumber(stats?.sessions_last_7_days, 0)));

      if (total7 > 0) return `${total7} session${total7 > 1 ? "s" : ""}`;
      if (total30 > 0) return `${total30} sur 30 jours`;
      return "—";
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
      #${MODULE_ID} .g-quick-btn,
      #${MODULE_ID} .g-slot-wrap,
      #${MODULE_ID} .g-cta-inline {
        border-radius: 22px;
      }

      #${MODULE_ID} .g-card {
        background: #050b18;
        border: 1px solid rgba(255,255,255,.16);
        box-shadow: 0 24px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(148,163,184,.12);
        padding: 1.2rem;
        position: relative;
        overflow: hidden;
        min-height: 100%;
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
        grid-template-columns: 1.35fr 1fr 1fr 1fr;
        gap: 10px;
      }

      #${MODULE_ID} .g-quick-btn {
        min-height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        text-align: center;
        padding: 0 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
        text-decoration: none;
        border: none;
        cursor: pointer;
        transition: transform .15s ease, filter .15s ease, background .15s ease;
      }

      #${MODULE_ID} .g-quick-btn:hover,
      #${MODULE_ID} .g-quick-btn:focus-visible,
      #${MODULE_ID} .g-cta-inline:hover,
      #${MODULE_ID} .g-cta-inline:focus-visible {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }

      #${MODULE_ID} .g-quick-btn-primary,
      #${MODULE_ID} .g-cta-inline {
        background: linear-gradient(90deg, #c94c35, #f97316);
        color: #f9fafb;
        box-shadow: 0 0 0 1px rgba(255,255,255,.16), 0 12px 30px rgba(0,0,0,.8);
      }

      #${MODULE_ID} .g-quick-btn-secondary {
        background: #111827;
        color: #f9fafb;
        box-shadow: 0 0 0 1px rgba(255,255,255,.18), 0 12px 30px rgba(0,0,0,.75);
      }

      #${MODULE_ID} .g-cta-inline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        padding: 0 12px;
        border: none;
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
        text-decoration: none;
        white-space: nowrap;
        width: 100%;
        margin-top: 8px;
      }

      #${MODULE_ID} .g-profile-hero {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) minmax(230px, 280px);
        gap: 16px;
        align-items: stretch;
      }

      #${MODULE_ID} .g-profile-main {
        display: grid;
        gap: 8px;
        align-content: center;
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
        margin-bottom: 2px;
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
        margin-top: 6px;
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
        margin-top: 4px;
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
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(34,197,94,.10);
        border: 1px solid rgba(34,197,94,.28);
        min-width: 0;
        text-align: left;
        display: grid;
        align-content: center;
      }

      #${MODULE_ID} .g-soft-success {
        color: #d1fae5;
      }

      #${MODULE_ID} .g-source-list,
      #${MODULE_ID} .g-vertical-list {
        display: grid;
        gap: 10px;
      }

      #${MODULE_ID} .g-item,
      #${MODULE_ID} .g-source-card,
      #${MODULE_ID} .g-statbox,
      #${MODULE_ID} .g-recordbox,
      #${MODULE_ID} .g-streakbox,
      #${MODULE_ID} .g-subcard,
      #${MODULE_ID} .g-slot-wrap {
        background: rgba(10,16,30,.95);
        border: 1px solid rgba(255,255,255,.10);
        padding: 12px;
      }

      #${MODULE_ID} .g-slot-wrap {
        padding: 0;
        background: transparent;
        border: none;
        height: 100%;
      }

      #${MODULE_ID} .g-slot-wrap > * {
        margin: 0 !important;
      }

      #${MODULE_ID} .g-slot-wrap > .card {
        height: 100%;
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

      #${MODULE_ID} .g-progress-head,
      #${MODULE_ID} .g-streak-main-top,
      #${MODULE_ID} .g-level-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      #${MODULE_ID} .g-level-top {
        margin-bottom: 10px;
      }

      #${MODULE_ID} .g-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: .05em;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(15,23,42,.85);
        color: #f9fafb;
      }

      #${MODULE_ID} .g-coin-highlight {
        padding: 10px 12px;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(201,76,53,.17), rgba(249,115,22,.12));
        border: 1px solid rgba(249,115,22,.26);
        font-size: 12px;
        color: #fff;
      }

      #${MODULE_ID} .g-coin-highlight-row {
        margin-top: 12px;
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
        margin-top: 12px;
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
      #${MODULE_ID} .g-records-grid {
        display: grid;
        gap: 10px;
      }

      #${MODULE_ID} .g-level-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #${MODULE_ID} .g-stats-grid,
      #${MODULE_ID} .g-records-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #${MODULE_ID} .g-statbox,
      #${MODULE_ID} .g-recordbox {
        min-height: 60px;
        padding: 10px 12px;
      }

      #${MODULE_ID} .g-statbox .g-bignumber,
      #${MODULE_ID} .g-recordbox .g-bignumber {
        font-size: 18px !important;
        margin-top: 2px;
      }

      #${MODULE_ID} .g-streak-hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
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
        grid-template-columns: repeat(2, minmax(0, 1fr));
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

      #${MODULE_ID} .g-slot-wrap .section-title {
        margin-bottom: 10px;
      }

      #${MODULE_ID} .g-slot-wrap .account-subtext {
        margin-top: 12px;
      }

      #${MODULE_ID} .g-slot-wrap .logout-row {
        margin-top: 14px;
      }

      #${MODULE_ID} .g-scroll-area {
        overflow-y: auto;
        padding-right: 4px;
      }

      #${MODULE_ID} .g-scroll-area::-webkit-scrollbar {
        width: 8px;
      }

      #${MODULE_ID} .g-scroll-area::-webkit-scrollbar-track {
        background: rgba(255,255,255,.05);
        border-radius: 999px;
      }

      #${MODULE_ID} .g-scroll-area::-webkit-scrollbar-thumb {
        background: rgba(249,115,22,.55);
        border-radius: 999px;
      }

      #${MODULE_ID} .g-scroll-missions {
        height: 184px;
        min-height: 184px;
        max-height: 184px;
      }

      #${MODULE_ID} .g-scroll-badges {
        height: 276px;
        min-height: 276px;
        max-height: 276px;
      }

      #${MODULE_ID} #gamif-reservations-anchor,
      #${MODULE_ID} #gamif-benefits-section,
      #${MODULE_ID} #gamif-streak-section,
      #${MODULE_ID} #gamif-badges-section,
      #${MODULE_ID} #gamif-stats-section,
      #${MODULE_ID} #gamif-records-section {
        align-self: stretch;
      }

      #${MODULE_ID} #gamif-reservations-slot > .card,
      #${MODULE_ID} #gamif-benefits-slot > .card {
        min-height: 100%;
      }

      #${MODULE_ID} #gamif-reservations-slot #reservations-list {
        max-height: 245px;
        min-height: 245px;
        overflow-y: auto;
        padding-right: 4px;
      }

      #${MODULE_ID} #gamif-reservations-slot #reservations-list::-webkit-scrollbar {
        width: 8px;
      }

      #${MODULE_ID} #gamif-reservations-slot #reservations-list::-webkit-scrollbar-track {
        background: rgba(255,255,255,.05);
        border-radius: 999px;
      }

      #${MODULE_ID} #gamif-reservations-slot #reservations-list::-webkit-scrollbar-thumb {
        background: rgba(249,115,22,.55);
        border-radius: 999px;
      }

      @media (max-width: 1100px) {
        #${MODULE_ID} .g-actions-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
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

        #${MODULE_ID} .g-level-grid,
        #${MODULE_ID} .g-coin-stats,
        #${MODULE_ID} .g-stats-grid,
        #${MODULE_ID} .g-records-grid,
        #${MODULE_ID} .g-streak-grid,
        #${MODULE_ID} .g-actions-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        #${MODULE_ID} .g-scroll-missions,
        #${MODULE_ID} .g-scroll-badges,
        #${MODULE_ID} #gamif-reservations-slot #reservations-list {
          height: auto;
          min-height: 0;
          max-height: none;
        }
      }

      @media (max-width: 640px) {
        #${MODULE_ID} .g-level-grid,
        #${MODULE_ID} .g-coin-stats,
        #${MODULE_ID} .g-stats-grid,
        #${MODULE_ID} .g-records-grid,
        #${MODULE_ID} .g-streak-grid,
        #${MODULE_ID} .g-actions-row {
          grid-template-columns: 1fr;
        }

        #${MODULE_ID} .g-coin-stat-label,
        #${MODULE_ID} .g-coin-stat-value {
          white-space: normal;
        }

        #${MODULE_ID} .g-quick-btn {
          white-space: nowrap;
          font-size: 11px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getStatusText(status) {
    if (status === "warning") return "À surveiller";
    if (status === "broken") return "À relancer";
    return "Actif";
  }

  function normalizeBadges(apiBadges, fallbackBadges) {
    const sourceList = Array.isArray(apiBadges) ? apiBadges : [];
    const apiMap = new Map();

    sourceList.forEach((badge) => {
      utils.getBadgeLookupKeys(badge).forEach((key) => {
        if (!apiMap.has(key)) apiMap.set(key, badge);
      });
    });

    const catalog = BADGE_DEFINITIONS.length
      ? BADGE_DEFINITIONS
      : (Array.isArray(fallbackBadges) ? fallbackBadges : []).map((badge) => ({
          key: utils.normalizeBadgeKey(badge.title || badge.id || badge.code),
          code: badge.code || badge.id || badge.title,
          icon: badge.icon,
          title: badge.title,
          desc: badge.desc,
          rarity: badge.rarity,
          rewardSingcoins: badge.rewardSingcoins || 0
        }));

    return catalog.map((definition, index) => {
      const defKey = utils.normalizeBadgeKey(
        definition.key || definition.code || definition.title || `badge-${index}`
      );

      const matched =
        apiMap.get(defKey) ||
        apiMap.get(utils.normalizeBadgeKey(definition.code)) ||
        apiMap.get(utils.normalizeBadgeKey(definition.title)) ||
        null;

      const isUnlocked =
        typeof matched?.isUnlocked === "boolean"
          ? matched.isUnlocked
          : Boolean(matched?.unlocked || matched?.unlockedAt);

      return {
        code: matched?.code || definition.code || defKey,
        icon: matched?.icon || definition.icon || "★",
        title: matched?.title || definition.title || "Badge",
        desc: matched?.description || matched?.desc || definition.desc || "",
        rarity: matched?.rarity || definition.rarity || "common",
        rewardSingcoins: Math.max(
          0,
          Math.floor(
            utils.toNumber(
              matched?.rewardSingcoins ?? definition.rewardSingcoins,
              0
            )
          )
        ),
        unlocked: isUnlocked,
        date: matched?.unlockedAt ? utils.formatShortDate(matched.unlockedAt) : ""
      };
    });
  }

  function normalizeGamificationResponse(apiData, user = {}) {
    const fallback = utils.deepClone(MOCK_GAMIFICATION);
    const email = utils.normalizeEmail(user?.email || "");
    const displayName = utils.getDisplayName(user);

    const api = apiData && typeof apiData === "object" ? apiData : {};
    const levelApi = api.level && typeof api.level === "object" ? api.level : {};
    const streakApi = api.streak && typeof api.streak === "object" ? api.streak : {};
    const singcoinsApi = api.singcoins && typeof api.singcoins === "object" ? api.singcoins : {};
    const statsApi = api.stats && typeof api.stats === "object" ? api.stats : {};
    const recordsApi = api.records && typeof api.records === "object" ? api.records : {};

    const balance =
      singcoinsApi.balance != null
        ? Math.max(0, Math.floor(utils.toNumber(singcoinsApi.balance, 0)))
        : Math.max(0, Math.floor(utils.toNumber(user?.points, fallback.singcoins.balance)));

    const earned =
      singcoinsApi.earned != null
        ? Math.max(0, Math.floor(utils.toNumber(singcoinsApi.earned, 0)))
        : Math.max(balance + Math.max(0, Math.floor(utils.toNumber(singcoinsApi.used, fallback.singcoins.used))), fallback.singcoins.earned);

    const used =
      singcoinsApi.used != null
        ? Math.max(0, Math.floor(utils.toNumber(singcoinsApi.used, 0)))
        : fallback.singcoins.used;

    const totalSessions =
      statsApi.totalSessions != null
        ? Math.max(0, Math.floor(utils.toNumber(statsApi.totalSessions, 0)))
        : (user?.sessionsCount != null
            ? Math.max(0, Math.floor(utils.toNumber(user.sessionsCount, 0)))
            : fallback.stats.totalSessions);

    const levelCurrent = Math.max(
      1,
      Math.floor(
        utils.toNumber(
          levelApi.current,
          fallback.level.current
        )
      )
    );

    const xpCurrent = Math.max(0, Math.floor(utils.toNumber(levelApi.xpCurrent, fallback.level.xpCurrent)));
    const xpNextLevel = Math.max(1, Math.floor(utils.toNumber(levelApi.xpNextLevel, fallback.level.xpNextLevel)));
    const xpTotal = Math.max(0, Math.floor(utils.toNumber(levelApi.xpTotal, xpCurrent)));

    const streakCurrent = Math.max(0, Math.floor(utils.toNumber(streakApi.current, fallback.streak.current)));
    const streakBest = Math.max(
      streakCurrent,
      Math.floor(utils.toNumber(streakApi.best, fallback.streak.best))
    );

    const lastValidatedAt = streakApi.lastValidatedAt || "";
    const lastPeriodKey = utils.safeText(streakApi.lastPeriodKey || "", 60);

    let streakStatus = "broken";
    if (streakCurrent > 0) streakStatus = "active";
    if (streakCurrent > 0 && !lastValidatedAt) streakStatus = "warning";

    const deadlineText = streakCurrent > 0
      ? "Fais au moins une session validée cette semaine pour conserver ton streak."
      : "Fais une session validée cette semaine pour lancer ton streak.";

    const totalTime =
      typeof statsApi.totalTime === "string" && utils.safeText(statsApi.totalTime)
        ? utils.safeText(statsApi.totalTime, 40)
        : (statsApi.totalTime != null
            ? utils.formatDurationMinutes(statsApi.totalTime)
            : fallback.stats.totalTime);

    const totalSongs =
      statsApi.totalSongs != null
        ? Math.max(0, Math.floor(utils.toNumber(statsApi.totalSongs, 0)))
        : fallback.stats.totalSongs;

    const lastSession = statsApi.lastSession
      ? utils.formatShortDate(statsApi.lastSession)
      : fallback.stats.lastSession;

    const biggestSession =
      recordsApi.biggestSession != null
        ? utils.formatBiggestSession(recordsApi.biggestSession)
        : fallback.records.biggestSession;

    const timePerSession =
      recordsApi.longestSessionMinutes != null
        ? utils.formatDurationMinutes(recordsApi.longestSessionMinutes)
        : fallback.records.timePerSession;

    const normalizedMissions = Array.isArray(api.missions)
      ? api.missions.map((mission, index) => {
          const targetValue = Math.max(1, utils.toNumber(mission?.targetValue, 1));
          const progressValue = Math.max(0, utils.toNumber(mission?.progressValue, 0));
          const isCompleted = Boolean(mission?.isCompleted);
          return {
            id: utils.safeText(mission?.code || `mission-${index}`, 80) || `mission-${index}`,
            title: utils.safeText(mission?.title || `Mission ${index + 1}`, 140),
            progress: isCompleted ? 100 : utils.pct(progressValue, targetValue),
            progressValue,
            targetValue,
            reward: utils.formatRewardText(mission),
            done: isCompleted
          };
        })
      : fallback.missions;

    const normalized = {
      identity: {
        displayName,
        avatarText: utils.initialsFromText(displayName || email || "S"),
        memberSince: utils.formatMonthYear(user?.created_at || user?.createdAt),
        status: utils.deriveStatus(levelCurrent, totalSessions)
      },

      level: {
        current: levelCurrent,
        name: utils.safeText(levelApi.name || "", 60) || utils.getLevelName(levelCurrent),
        xpCurrent,
        xpNextLevel,
        xpTotal
      },

      streak: {
        current: streakCurrent,
        best: streakBest,
        deadlineText,
        jokers: streakApi.jokers != null ? Math.max(0, Math.floor(utils.toNumber(streakApi.jokers, 0))) : 0,
        status: streakStatus,
        lastActivity: lastValidatedAt ? utils.formatLastActivity(lastValidatedAt) : "—",
        rhythm: streakCurrent >= 8 ? "Très bon" : streakCurrent >= 4 ? "Bon rythme" : "À lancer",
        lastPeriodKey
      },

      singcoins: {
        balance,
        earned,
        used,
        nextReward: balance >= state.config.loyaltyGoal
          ? "Séance offerte débloquée"
          : "Séance offerte à 100 Singcoins"
      },

      stats: {
        totalSessions,
        totalTime,
        totalSongs,
        lastSession,
        sessions_last_7_days: Math.max(0, utils.toNumber(statsApi.sessionsLast7Days, 0)),
        sessions_last_30_days: Math.max(0, utils.toNumber(statsApi.sessionsLast30Days, 0))
      },

      records: {
        bestStreak: recordsApi.bestStreak != null
          ? Math.max(0, Math.floor(utils.toNumber(recordsApi.bestStreak, 0)))
          : streakBest,
        activeWeek: fallback.records.activeWeek || "—",
        biggestSession,
        timePerSession
      },

      missions: normalizedMissions,
      badges: normalizeBadges(api.badges, fallback.badges)
    };

    normalized.records.activeWeek = utils.guessActiveWeek(normalized.stats);

    return normalized;
  }

  function buildData(user = {}) {
    const fallback = utils.deepClone(MOCK_GAMIFICATION);
    const gamificationApi = user?.gamification && typeof user.gamification === "object"
      ? user.gamification
      : null;

    if (!gamificationApi) {
      const email = utils.normalizeEmail(user?.email || "");
      const displayName = utils.getDisplayName(user);
      const points = Number.isFinite(Number(user?.points)) ? Math.max(0, Math.floor(Number(user.points))) : 0;

      fallback.identity.displayName = displayName;
      fallback.identity.avatarText = utils.initialsFromText(displayName || email || "S");
      fallback.identity.memberSince = utils.formatMonthYear(user?.created_at || user?.createdAt);
      fallback.identity.status = utils.deriveStatus(fallback.level.current, user?.sessionsCount || fallback.stats.totalSessions);

      fallback.singcoins.balance = points;
      fallback.singcoins.earned = Math.max(points + Number(fallback.singcoins.used || 0), Number(fallback.singcoins.earned || 0));
      fallback.singcoins.nextReward = points >= state.config.loyaltyGoal
        ? "Séance offerte débloquée"
        : "Séance offerte à 100 Singcoins";

      const sessionsCount = Number.isFinite(Number(user?.sessionsCount))
        ? Math.max(0, Math.floor(Number(user.sessionsCount)))
        : null;

      if (sessionsCount !== null) {
        fallback.stats.totalSessions = sessionsCount;
      }

      fallback.badges = normalizeBadges([], BADGE_DEFINITIONS);

      return fallback;
    }

    const normalized = normalizeGamificationResponse(gamificationApi, user);

    return {
      ...fallback,
      ...normalized,
      identity: { ...fallback.identity, ...normalized.identity },
      level: { ...fallback.level, ...normalized.level },
      streak: { ...fallback.streak, ...normalized.streak },
      singcoins: { ...fallback.singcoins, ...normalized.singcoins },
      stats: { ...fallback.stats, ...normalized.stats },
      records: { ...fallback.records, ...normalized.records },
      missions: Array.isArray(normalized.missions) && normalized.missions.length ? normalized.missions : fallback.missions,
      badges: Array.isArray(normalized.badges) && normalized.badges.length ? normalized.badges : normalizeBadges([], BADGE_DEFINITIONS)
    };
  }

  function renderShell() {
    if (!state.root) return;

    state.root.id = MODULE_ID;
    state.root.innerHTML = `
      <div class="gamif-grid">
        <section class="g-card g-span-12" id="gamif-actions-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Sommaire</h2>
              <div class="g-subtitle">Accédez directement aux sections principales de votre compte.</div>
            </div>
          </div>
          <div class="g-actions-row" id="gamif-actions-row"></div>
        </section>

        <section class="g-card g-span-12" id="gamif-profile-section">
          <div class="g-profile-hero">
            <div class="g-avatar" id="gamif-avatar">S</div>

            <div class="g-profile-main">
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
                <span class="g-pill"><span class="g-mini-icon">🎤</span><span id="gamif-level-pill">Niveau Nouveau</span></span>
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

        <section class="g-span-8" id="gamif-reservations-anchor">
          <div class="g-slot-wrap" id="gamif-reservations-slot"></div>
        </section>

        <section class="g-span-4" id="gamif-benefits-section">
          <div class="g-slot-wrap" id="gamif-benefits-slot"></div>
        </section>

        <section class="g-card g-span-7" id="gamif-singcoins-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Singcoins</h2>
              <div class="g-subtitle">Votre programme fidélité principal reste très visible.</div>
            </div>
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

          <div class="g-coin-highlight-row">
            <div class="g-coin-highlight" id="gamif-next-reward">Prochaine récompense : séance offerte à 100 Singcoins</div>
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
              <div class="g-subtitle">Un bloc simple pour guider l’utilisateur.</div>
            </div>
          </div>
          <div class="g-source-list" id="gamif-singcoins-sources"></div>
        </section>

        <section class="g-card g-span-7" id="gamif-xp-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Mon niveau</h2>
              <div class="g-subtitle">Votre niveau évolue avec votre activité sur Singbox.</div>
            </div>
          </div>

          <div class="g-level-grid">
            <div class="g-subcard">
              <div class="g-soft">Niveau actuel</div>
              <div class="g-bignumber" id="gamif-level-current">1</div>
            </div>
            <div class="g-subcard">
              <div class="g-soft">Nom du niveau</div>
              <div class="g-bignumber" id="gamif-level-name">Nouveau</div>
            </div>
          </div>

          <div class="g-progress-wrap">
            <div class="g-progress-head">
              <span class="g-soft">XP actuelle : <strong id="gamif-xp-current">0</strong></span>
              <span class="g-soft">Objectif suivant : <strong id="gamif-xp-next">100 XP</strong></span>
            </div>
            <div class="g-progress-bar"><div class="g-progress-fill g-progress-fill-xp" id="gamif-xp-fill" style="width:0%;"></div></div>
            <div class="g-soft" id="gamif-xp-text">Plus que 100 XP pour atteindre le niveau suivant.</div>
          </div>

          <div style="margin-top:16px;">
            <div class="g-level-top">
              <h3 class="g-title" style="font-size:18px;margin:0;">Mes missions</h3>
              <span class="g-tag">Hebdomadaires</span>
            </div>
            <div class="g-scroll-area g-scroll-missions" id="gamif-missions-list"></div>
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

        <section class="g-card g-span-6" id="gamif-streak-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Streak</h2>
              <div class="g-subtitle">Votre régularité hebdomadaire reste bien mise en avant.</div>
            </div>
          </div>

          <div class="g-streak-hero">
            <div class="g-streak-main">
              <div class="g-streak-main-top">
                <div>
                  <div class="g-soft">Streak actuel</div>
                  <div class="g-bignumber" id="gamif-streak-current-value">0 semaine</div>
                </div>
                <div class="g-streak-status" id="gamif-streak-status">
                  <span class="g-streak-dot"></span>
                  <span id="gamif-streak-status-text">À relancer</span>
                </div>
              </div>
              <div class="g-soft" style="margin-top:10px;" id="gamif-streak-deadline">Fais au moins une session validée cette semaine pour lancer ton streak.</div>
            </div>

            <div class="g-streak-grid">
              <div class="g-streakbox">
                <div class="g-soft">Jokers disponibles</div>
                <div class="g-bignumber" id="gamif-streak-jokers">0</div>
                <div class="g-soft" id="gamif-streak-joker-help">Protège une absence si activé plus tard.</div>
              </div>
              <div class="g-streakbox">
                <div class="g-soft">Meilleur streak</div>
                <div class="g-bignumber" id="gamif-streak-best">0</div>
              </div>
              <div class="g-streakbox">
                <div class="g-soft">Dernière activité</div>
                <div class="g-bignumber" id="gamif-streak-last-activity">—</div>
              </div>
              <div class="g-streakbox">
                <div class="g-soft">Ne pas casser mon streak</div>
                <a class="g-cta-inline" href="${utils.safeHtml(state.config.reservationUrl)}">Réserver maintenant</a>
              </div>
            </div>
          </div>
        </section>

        <section class="g-card g-span-6" id="gamif-badges-section">
          <div class="g-section-head">
            <div>
              <h2 class="g-title">Badges / succès</h2>
              <div class="g-subtitle">Vos badges débloqués et ceux à viser.</div>
            </div>
          </div>
          <div class="g-scroll-area g-scroll-badges" id="gamif-badges-list"></div>
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
      </div>
    `;
  }

  function prepareExternalCards() {
    const reservationsCard = document.querySelector(state.config.reservationsCardSelector);
    const benefitsCard = document.querySelector(state.config.benefitsCardSelector);

    if (reservationsCard) {
      const title = reservationsCard.querySelector("h2");
      if (title) title.textContent = "Mes réservations";

      const singcoinsField = reservationsCard.querySelector("[data-account-singcoins-field]");
      if (singcoinsField) singcoinsField.style.display = "none";

      const helperText = reservationsCard.querySelector("[data-account-helper-text]");
      if (helperText) helperText.style.display = "none";
    }

    if (benefitsCard) {
      const title = benefitsCard.querySelector(".section-title");
      if (title) title.textContent = "Avantages du compte";
    }
  }

  function mountExternalCards() {
    prepareExternalCards();

    const reservationsSlot = document.querySelector(state.config.selectors.reservationsSlot);
    const benefitsSlot = document.querySelector(state.config.selectors.benefitsSlot);
    const reservationsCard = document.querySelector(state.config.reservationsCardSelector);
    const benefitsCard = document.querySelector(state.config.benefitsCardSelector);

    if (reservationsSlot && reservationsCard && reservationsCard.parentElement !== reservationsSlot) {
      reservationsSlot.appendChild(reservationsCard);
      reservationsCard.hidden = false;
      reservationsCard.style.display = "";
    }

    if (benefitsSlot && benefitsCard && benefitsCard.parentElement !== benefitsSlot) {
      benefitsSlot.appendChild(benefitsCard);
      benefitsCard.hidden = false;
      benefitsCard.style.display = "";
    }
  }

  function renderQuickActions() {
    const el = document.getElementById("gamif-actions-row");
    if (!el) return;

    el.innerHTML = `
      <button class="g-quick-btn g-quick-btn-primary" type="button" data-gamif-action="reservations">Réservations</button>
      <button class="g-quick-btn g-quick-btn-secondary" type="button" data-gamif-action="singcoins">Mes Singcoins</button>
      <button class="g-quick-btn g-quick-btn-secondary" type="button" data-gamif-action="level">Mon niveau</button>
      <button class="g-quick-btn g-quick-btn-secondary" type="button" data-gamif-action="streak">Ma streak</button>
    `;
  }

  function renderSourceCards() {
    const singcoinsEl = document.getElementById("gamif-singcoins-sources");
    const xpEl = document.getElementById("gamif-xp-sources");

    if (singcoinsEl) {
      const items = [
        { icon: "🎟", title: "Session réalisée", text: "Chaque session validée rapporte des Singcoins." },
        { icon: "🏅", title: "Missions", text: "Les missions hebdomadaires peuvent donner un bonus de Singcoins." },
        { icon: "✨", title: "Badges", text: "Débloquer un badge vous rapporte aussi des Singcoins." },
        { icon: "🎁", title: "Récompenses", text: "Votre progression vous rapproche de la séance offerte." }
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
        { icon: "🎤", title: "Sessions réalisées", text: "Chaque session validée participe à votre progression XP." },
        { icon: "🔥", title: "Régularité", text: "Entretenir votre streak hebdomadaire valorise votre profil." },
        { icon: "✅", title: "Missions", text: "Les missions accomplies peuvent rapporter de l’XP." },
        { icon: "🌟", title: "Progression", text: "Votre niveau augmente au fil de vos réservations et missions." }
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
        ? "Votre profil se renforce à chaque session validée et récompense débloquée."
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
    if (loyaltyText) {
      loyaltyText.textContent = balance >= state.config.loyaltyGoal
        ? "Bravo ! Votre palier principal est atteint."
        : `Plus que ${remaining} Singcoins avant votre séance offerte.`;
    }
    if (current) current.textContent = String(balance);
    if (earnedEl) earnedEl.textContent = String(earned);
    if (usedEl) usedEl.textContent = String(used);
  }

  function renderLevel(data) {
    const currentXp = Number(data.level.xpCurrent || 0);
    const nextXp = Math.max(1, Number(data.level.xpNextLevel || 1));
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
    const lastActivity = document.getElementById("gamif-streak-last-activity");
    const jokerHelp = document.getElementById("gamif-streak-joker-help");

    if (currentValue) currentValue.textContent = utils.formatWeeks(data.streak.current);
    if (deadline) deadline.textContent = data.streak.deadlineText;
    if (jokers) jokers.textContent = String(data.streak.jokers);
    if (best) best.textContent = String(data.streak.best);
    if (lastActivity) lastActivity.textContent = data.streak.lastActivity;
    if (statusText) statusText.textContent = getStatusText(data.streak.status);
    if (jokerHelp) jokerHelp.textContent = "Protège une absence si activé plus tard.";

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
      const progressLabel = utils.computeMissionProgressLabel(
        mission.progressValue,
        mission.targetValue,
        mission.done
      );

      return `
        <div class="g-item">
          <span class="g-badge-icon">${mission.done ? "✓" : "🎯"}</span>
          <div class="g-item-content">
            <strong style="color:#f9fafb;">${utils.safeHtml(mission.title)}</strong>
            <div class="g-soft">Récompense : ${utils.safeHtml(mission.reward)}</div>
            <div class="g-mission-progress">
              <div class="g-soft">${utils.safeHtml(progressLabel)}</div>
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
      { label: "Dernière session", value: data.stats.lastSession }
    ];

    el.innerHTML = items.map((item) => `
      <div class="g-statbox">
        <div class="g-soft">${utils.safeHtml(item.label)}</div>
        <div class="g-bignumber">${utils.safeHtml(item.value)}</div>
      </div>
    `).join("");
  }

  function renderRecords(data) {
    const el = document.getElementById("gamif-records-grid");
    if (!el) return;

    const items = [
      { label: "Meilleur streak", value: utils.formatWeeks(data.records.bestStreak).replace(" semaines", "").replace(" semaine", "") || "0" },
      { label: "Semaine la plus active", value: data.records.activeWeek },
      { label: "Plus grosse session", value: data.records.biggestSession },
      { label: "Record temps", value: data.records.timePerSession }
    ];

    el.innerHTML = items.map((item) => `
      <div class="g-recordbox">
        <div class="g-soft">${utils.safeHtml(item.label)}</div>
        <div class="g-bignumber">${utils.safeHtml(item.value)}</div>
      </div>
    `).join("");
  }

  function renderBadges(data) {
    const el = document.getElementById("gamif-badges-list");
    if (!el) return;

    el.innerHTML = data.badges.map((badge) => {
      const rewardText = utils.formatBadgeRewardText(badge);

      return `
        <div class="g-item ${badge.unlocked ? "" : "g-locked"}">
          <span class="g-badge-icon">${utils.safeHtml(badge.icon || "★")}</span>
          <div class="g-item-content">
            <strong style="color:#f9fafb;">${utils.safeHtml(badge.title)}</strong>
            <div class="g-soft">${utils.safeHtml(badge.desc)}</div>
            ${rewardText ? `<div class="g-soft" style="margin-top:6px;">${utils.safeHtml(rewardText)}</div>` : ""}
            <span class="g-rarity ${utils.safeHtml(badge.rarity || "common")}">${utils.safeHtml(badge.rarity || "common")}</span>
            ${badge.date ? `<div class="g-soft" style="margin-top:6px;">Obtenu le ${utils.safeHtml(badge.date)}</div>` : `<div class="g-soft" style="margin-top:6px;">À débloquer</div>`}
          </div>
        </div>
      `;
    }).join("");
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
    if (!state.root || state.eventsBound) return;

    state.root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const actionBtn = target.closest("[data-gamif-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-gamif-action");
        if (action === "reservations") utils.scrollTo(state.config.anchors.reservations);
        if (action === "singcoins") utils.scrollTo(state.config.anchors.singcoins);
        if (action === "level") utils.scrollTo(state.config.anchors.level);
        if (action === "missions") utils.scrollTo(state.config.anchors.missions);
        if (action === "streak") utils.scrollTo(state.config.anchors.streak);
        if (action === "badges") utils.scrollTo(state.config.anchors.badges);
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

    state.root.addEventListener("submit", (event) => {
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

    state.root.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target || target.id !== "gamif-pseudo-input") return;
      target.value = utils.sanitizePseudo(target.value);
    });

    state.eventsBound = true;
  }

  function renderAll() {
    const data = buildData(state.user || {});
    state.data = data;

    mountExternalCards();
    renderQuickActions();
    renderSourceCards();
    renderIdentity(data, state.user || {});
    renderSingcoins(data);
    renderLevel(data);
    renderMissions(data);
    renderStreak(data);
    renderBadges(data);
    renderStats(data);
    renderRecords(data);
  }

  function mount(options = {}) {
    state.config = {
      ...DEFAULTS,
      ...state.config,
      ...options,
      selectors: {
        ...DEFAULTS.selectors,
        ...(state.config.selectors || {}),
        ...(options.selectors || {})
      },
      anchors: {
        ...DEFAULTS.anchors,
        ...(state.config.anchors || {}),
        ...(options.anchors || {})
      }
    };

    const root = document.querySelector(state.config.mountSelector);
    if (!root) {
      console.warn("[SingboxGamification] Conteneur introuvable :", state.config.mountSelector);
      return;
    }

    state.root = root;
    injectStyles();
    renderShell();
    mountExternalCards();
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
      points: 0,
      gamification: null
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
    refresh,
    normalizeGamificationResponse
  };
})();
