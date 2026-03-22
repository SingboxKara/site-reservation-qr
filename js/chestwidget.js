(() => {
  "use strict";

  const CONFIG = {
    position: "right",
    loginUrl: "mon-compte.html",
    signupUrl: "mon-compte.html",
    accountUrl: "mon-compte.html",
    reservationUrl: "reservation.html",

    storageKey: "singbox_chest_widget_v1",
    rewardSessionKey: "singbox_chest_active_reward_session",
    demoLoginKey: "singbox_demo_logged_in",

    sessionsPerChest: 5,
    enableTeaserWhenLoggedOut: true,

    brandName: "Singbox",
    widgetLabel: "Coffre cadeaux",
    openingDurationMs: 1600,

    assetClosed: "/assets/chest-closed.png",
    assetOpening: "/assets/chest-opening.png",
    assetOpen: "/assets/chest-open.png",
    assetSpark: "/assets/spark.png",
    assetCoin: "/assets/singcoin.png",
  };

  const DEFAULT_STATE = {
    welcomeChestOpened: false,
    completedSessions: 0,
    openedMilestones: [],
    rewardsHistory: [],
    lastReward: null,
  };

  const REWARDS_POOL = [
    {
      id: "empty",
      type: "none",
      label: "Pas de gain cette fois",
      description: "Le coffre était vide... mais le prochain sera peut-être le bon.",
      weight: 45,
      value: 0,
      isEmpty: true,
    },
    {
      id: "coins_20",
      type: "points",
      label: "+20 Singcoins",
      description: "Tu gagnes 20 Singcoins.",
      weight: 25,
      value: 20,
      isEmpty: false,
    },
    {
      id: "coins_30",
      type: "points",
      label: "+30 Singcoins",
      description: "Tu gagnes 30 Singcoins.",
      weight: 15,
      value: 30,
      isEmpty: false,
    },
    {
      id: "discount_10_percent",
      type: "discount_percent",
      label: "-10% sur ta réservation",
      description: "Réduction de 10% si tu réserves pendant cette visite.",
      weight: 10,
      value: 10,
      isEmpty: false,
    },
    {
      id: "discount_20_percent",
      type: "discount_percent",
      label: "-20% sur ta réservation",
      description: "Réduction de 20% si tu réserves pendant cette visite.",
      weight: 4,
      value: 20,
      isEmpty: false,
    },
    {
      id: "free_session",
      type: "free_session",
      label: "Session offerte",
      description: "Incroyable : tu as gagné une session offerte si tu réserves pendant cette visite.",
      weight: 1,
      value: 1,
      isEmpty: false,
    },
  ];

  let isOpeningChest = false;

  function injectStyles() {
    if (document.getElementById("sb-chest-widget-styles")) return;

    const style = document.createElement("style");
    style.id = "sb-chest-widget-styles";
    style.textContent = `
      .sb-chest-widget {
        position: fixed;
        z-index: 9999;
        bottom: 22px;
        right: 22px;
        font-family: "Montserrat", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .sb-chest-trigger {
        width: 68px;
        height: 68px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 999px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 30% 0%, rgba(248, 250, 252, 0.12), rgba(15, 23, 42, 0.86)),
          linear-gradient(135deg, #111827, #1f2937);
        box-shadow:
          0 10px 30px rgba(0, 0, 0, 0.34),
          0 0 0 1px rgba(249, 250, 251, 0.08);
        color: #fff;
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(6px);
      }

      .sb-chest-trigger:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow:
          0 14px 36px rgba(0, 0, 0, 0.42),
          0 0 0 1px rgba(249, 250, 251, 0.14);
      }

      .sb-chest-trigger.sb-available {
        animation: sbChestPulse 1.8s infinite;
      }

      .sb-chest-trigger.sb-locked {
        opacity: 0.92;
      }

      .sb-chest-trigger.sb-opened {
        background:
          radial-gradient(circle at 30% 0%, rgba(248, 250, 252, 0.12), rgba(15, 23, 42, 0.86)),
          linear-gradient(135deg, #3f3f46, #18181b);
      }

      .sb-chest-trigger.sb-trigger-opening {
        animation: sbTriggerOpening 0.85s ease-in-out infinite;
        filter: brightness(1.08);
      }

      .sb-chest-icon {
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .sb-chest-icon img {
        width: 42px;
        height: auto;
        display: block;
        pointer-events: none;
        user-select: none;
      }

      .sb-chest-trigger.sb-available .sb-chest-icon img {
        animation: chestFloat 2s infinite ease-in-out;
      }

      .sb-chest-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        min-width: 22px;
        height: 22px;
        border-radius: 999px;
        background: linear-gradient(135deg, #f59e0b, #facc15);
        color: #111827;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.22);
      }

      .sb-chest-tooltip {
        position: absolute;
        bottom: 78px;
        right: 0;
        background: rgba(2, 6, 23, 0.96);
        color: #fff;
        padding: 10px 12px;
        border-radius: 14px;
        font-size: 13px;
        width: 240px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        border: 1px solid rgba(148, 163, 184, 0.18);
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .sb-chest-widget:hover .sb-chest-tooltip {
        opacity: 1;
        transform: translateY(0);
      }

      .sb-chest-overlay {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.78);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 16px;
        backdrop-filter: blur(6px);
      }

      .sb-chest-overlay.sb-open {
        display: flex;
      }

      .sb-chest-modal {
        width: 100%;
        max-width: 450px;
        background:
          radial-gradient(circle at top left, rgba(201, 76, 53, 0.16), transparent 35%),
          radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 30%),
          linear-gradient(180deg, rgba(3, 7, 18, 0.98), rgba(2, 6, 23, 0.98));
        border-radius: 24px;
        padding: 22px;
        box-shadow:
          0 28px 70px rgba(0,0,0,0.42),
          0 0 0 1px rgba(148, 163, 184, 0.16);
        position: relative;
        color: #f8fafc;
        overflow: hidden;
      }

      .sb-chest-modal::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 24px;
        padding: 1px;
        background: linear-gradient(135deg, rgba(249,115,22,0.34), rgba(59,130,246,0.24), rgba(201,76,53,0.34));
        -webkit-mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }

      .sb-chest-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 38px;
        height: 38px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.82);
        color: #f8fafc;
        cursor: pointer;
        font-size: 18px;
      }

      .sb-chest-title {
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 26px;
        font-weight: 800;
        margin: 0 0 8px;
        color: #f8fafc;
      }

      .sb-chest-subtitle {
        margin: 0 0 16px;
        color: #cbd5e1;
        font-size: 14px;
        line-height: 1.5;
      }

      .sb-chest-hero {
        width: 110px;
        min-height: 98px;
        border-radius: 24px;
        margin: 0 auto 16px;
        background:
          radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12), transparent 35%),
          linear-gradient(135deg, #111827, #1f2937);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        box-shadow:
          0 16px 36px rgba(0,0,0,0.24),
          0 0 0 1px rgba(248,250,252,0.08);
        overflow: hidden;
      }

      .sb-chest-hero.sb-hero-opening {
        animation: sbHeroOpening 0.85s ease-in-out infinite;
      }

      .sb-chest-hero img {
        width: 90px;
        height: auto;
        display: block;
        user-select: none;
        pointer-events: none;
      }

      .sb-chest-hero img.sb-spark {
        width: 72px;
      }

      .sb-chest-hero img.sb-coin {
        width: 72px;
      }

      .sb-chest-card {
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        padding: 14px;
        margin-bottom: 14px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
      }

      .sb-chest-card strong {
        display: block;
        margin-bottom: 6px;
        font-size: 15px;
        color: #f8fafc;
      }

      .sb-chest-card p {
        margin: 0;
        color: #cbd5e1;
        font-size: 14px;
        line-height: 1.5;
      }

      .sb-chest-progress {
        margin: 12px 0 4px;
      }

      .sb-chest-progress-bar {
        height: 10px;
        background: rgba(51, 65, 85, 0.78);
        border-radius: 999px;
        overflow: hidden;
      }

      .sb-chest-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #c94c35, #f97316);
        border-radius: 999px;
        transition: width 0.25s ease;
      }

      .sb-chest-progress-text {
        margin-top: 8px;
        font-size: 13px;
        color: #94a3b8;
      }

      .sb-chest-actions {
        display: flex;
        gap: 10px;
        margin-top: 16px;
        flex-wrap: wrap;
      }

      .sb-chest-btn {
        flex: 1 1 auto;
        min-width: 140px;
        border: none;
        border-radius: 14px;
        padding: 12px 14px;
        cursor: pointer;
        font-weight: 700;
        font-size: 14px;
        transition: transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
      }

      .sb-chest-btn:hover {
        transform: translateY(-1px);
      }

      .sb-chest-btn:disabled {
        opacity: 0.72;
        cursor: not-allowed;
        transform: none;
      }

      .sb-chest-btn-primary {
        background: #111827;
        color: #fff;
        border: 1px solid rgba(148, 163, 184, 0.16);
      }

      .sb-chest-btn-secondary {
        background: rgba(15, 23, 42, 0.88);
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.16);
      }

      .sb-chest-btn-gold {
        background: linear-gradient(135deg, #c94c35, #f97316);
        color: #fff;
        box-shadow: 0 10px 24px rgba(201, 76, 53, 0.24);
      }

      .sb-chest-reward {
        text-align: center;
        padding: 12px 10px 4px;
        animation: sbRevealFadeIn 0.55s ease;
      }

      .sb-chest-reward-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 9px 15px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(249, 115, 22, 0.18), rgba(201, 76, 53, 0.24));
        color: #fdba74;
        border: 1px solid rgba(249, 115, 22, 0.18);
        font-weight: 800;
        font-size: 14px;
        margin-bottom: 10px;
      }

      .sb-chest-footnote {
        margin-top: 12px;
        font-size: 12px;
        color: #94a3b8;
        line-height: 1.45;
      }

      .sb-chest-opening-stage {
        text-align: center;
        padding: 8px 0 4px;
      }

      .sb-chest-opening-ring {
        width: 132px;
        height: 132px;
        margin: 0 auto 16px;
        border-radius: 999px;
        position: relative;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at center, rgba(249,115,22,0.14), rgba(249,115,22,0.02) 55%, transparent 72%);
      }

      .sb-chest-opening-ring::before {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: 999px;
        border: 2px solid rgba(249,115,22,0.20);
        animation: sbRingPulse 1.2s ease-in-out infinite;
      }

      .sb-chest-opening-ring::after {
        content: "";
        position: absolute;
        inset: -4px;
        border-radius: 999px;
        border: 1px solid rgba(59,130,246,0.14);
        animation: sbRingPulse 1.2s ease-in-out infinite 0.25s;
      }

      .sb-chest-opening-text {
        font-size: 14px;
        color: #cbd5e1;
        line-height: 1.5;
      }

      .sb-chest-opening-dots::after {
        content: "";
        animation: sbDots 1.2s steps(4, end) infinite;
      }

      @keyframes chestFloat {
        0% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
        100% { transform: translateY(0); }
      }

      @keyframes sbChestPulse {
        0% {
          transform: scale(1);
          box-shadow:
            0 10px 30px rgba(0,0,0,0.34),
            0 0 0 1px rgba(249,250,251,0.08);
        }
        50% {
          transform: scale(1.06);
          box-shadow:
            0 18px 40px rgba(249, 115, 22, 0.38),
            0 0 0 1px rgba(249,250,251,0.16);
        }
        100% {
          transform: scale(1);
          box-shadow:
            0 10px 30px rgba(0,0,0,0.34),
            0 0 0 1px rgba(249,250,251,0.08);
        }
      }

      @keyframes sbTriggerOpening {
        0% { transform: scale(1) rotate(0deg); box-shadow: 0 10px 30px rgba(0,0,0,0.34), 0 0 0 1px rgba(249,250,251,0.08); }
        25% { transform: scale(1.06) rotate(-8deg); }
        50% { transform: scale(1.1) rotate(8deg); box-shadow: 0 18px 44px rgba(249,115,22,0.34), 0 0 0 1px rgba(249,250,251,0.14); }
        75% { transform: scale(1.06) rotate(-5deg); }
        100% { transform: scale(1) rotate(0deg); box-shadow: 0 10px 30px rgba(0,0,0,0.34), 0 0 0 1px rgba(249,250,251,0.08); }
      }

      @keyframes sbHeroOpening {
        0% { transform: scale(1) rotate(0deg); }
        20% { transform: scale(1.05) rotate(-7deg); }
        40% { transform: scale(1.1) rotate(7deg); }
        60% { transform: scale(1.06) rotate(-4deg); }
        80% { transform: scale(1.08) rotate(4deg); }
        100% { transform: scale(1) rotate(0deg); }
      }

      @keyframes sbRingPulse {
        0% { transform: scale(0.92); opacity: 0.3; }
        50% { transform: scale(1.04); opacity: 0.8; }
        100% { transform: scale(1.14); opacity: 0; }
      }

      @keyframes sbRevealFadeIn {
        0% { opacity: 0; transform: translateY(10px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes sbDots {
        0% { content: ""; }
        25% { content: "."; }
        50% { content: ".."; }
        75% { content: "..."; }
        100% { content: ""; }
      }

      @media (max-width: 640px) {
        .sb-chest-widget {
          bottom: 16px;
          right: 16px;
        }

        .sb-chest-trigger {
          width: 62px;
          height: 62px;
        }

        .sb-chest-icon,
        .sb-chest-icon img {
          width: 38px;
        }

        .sb-chest-modal {
          padding: 18px;
          border-radius: 20px;
        }

        .sb-chest-tooltip {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getRewardVisual(reward) {
    if (!reward) {
      return {
        src: CONFIG.assetSpark,
        className: "sb-spark",
        alt: "Récompense",
      };
    }

    if (reward.type === "points") {
      return {
        src: CONFIG.assetCoin,
        className: "sb-coin",
        alt: "Singcoin",
      };
    }

    return {
      src: CONFIG.assetSpark,
      className: "sb-spark",
      alt: "Récompense",
    };
  }

  function getState() {
    const raw = localStorage.getItem(CONFIG.storageKey);
    const parsed = raw ? safeParse(raw, null) : null;
    return parsed && typeof parsed === "object"
      ? { ...DEFAULT_STATE, ...parsed }
      : { ...DEFAULT_STATE };
  }

  function saveState(nextState) {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(nextState));
  }

  function getSessionReward() {
    const raw = sessionStorage.getItem(CONFIG.rewardSessionKey);
    const parsed = raw ? safeParse(raw, null) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  }

  function saveSessionReward(reward) {
    if (!reward) return;
    sessionStorage.setItem(CONFIG.rewardSessionKey, JSON.stringify(reward));
  }

  function clearSessionReward() {
    sessionStorage.removeItem(CONFIG.rewardSessionKey);
  }

  function isDemoLoggedIn() {
    return localStorage.getItem(CONFIG.demoLoginKey) === "1";
  }

  async function detectLoggedInUser() {
    if (window.__SINGBOX_USER__ && window.__SINGBOX_USER__.id) {
      return {
        loggedIn: true,
        user: window.__SINGBOX_USER__,
        source: "window.__SINGBOX_USER__",
      };
    }

    if (window.supabaseClient && window.supabaseClient.auth?.getSession) {
      try {
        const result = await window.supabaseClient.auth.getSession();
        const session = result?.data?.session || null;
        if (session?.user) {
          return {
            loggedIn: true,
            user: session.user,
            source: "window.supabaseClient",
          };
        }
      } catch {}
    }

    if (window.__SINGBOX_SUPABASE_CLIENT__?.auth?.getSession) {
      try {
        const result = await window.__SINGBOX_SUPABASE_CLIENT__.auth.getSession();
        const session = result?.data?.session || null;
        if (session?.user) {
          return {
            loggedIn: true,
            user: session.user,
            source: "window.__SINGBOX_SUPABASE_CLIENT__",
          };
        }
      } catch {}
    }

    if (isDemoLoggedIn()) {
      return {
        loggedIn: true,
        user: { id: "demo-user", email: "demo@singbox.local" },
        source: "demo-localStorage",
      };
    }

    return { loggedIn: false, user: null, source: "none" };
  }

  function weightedRandom(pool) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let threshold = Math.random() * total;

    for (const item of pool) {
      threshold -= item.weight;
      if (threshold <= 0) return item;
    }

    return pool[pool.length - 1];
  }

  function getActiveReward() {
    const reward = getSessionReward();
    return reward && reward.status === "active" ? reward : null;
  }

  function getNextMilestone(state) {
    return Math.ceil(Math.max(1, state.completedSessions) / CONFIG.sessionsPerChest) * CONFIG.sessionsPerChest;
  }

  function getAvailableMilestoneChests(state) {
    const available = [];
    const completed = state.completedSessions;

    for (let milestone = CONFIG.sessionsPerChest; milestone <= completed; milestone += CONFIG.sessionsPerChest) {
      if (!state.openedMilestones.includes(milestone)) {
        available.push(milestone);
      }
    }

    return available;
  }

  function hasWelcomeChestAvailable(state) {
    return !state.welcomeChestOpened;
  }

  function getChestAvailability(loggedIn, state) {
    const activeReward = getActiveReward();

    if (!loggedIn) {
      return {
        isAvailable: false,
        availableCount: 0,
        type: "logged_out",
        activeReward: null,
      };
    }

    const milestoneChests = getAvailableMilestoneChests(state);
    const welcomeAvailable = hasWelcomeChestAvailable(state);
    const count = (welcomeAvailable ? 1 : 0) + milestoneChests.length;

    if (activeReward) {
      return {
        isAvailable: false,
        availableCount: 0,
        type: "opened",
        milestoneChests,
        welcomeAvailable,
        activeReward,
      };
    }

    return {
      isAvailable: count > 0,
      availableCount: count,
      type: count > 0 ? "available" : "locked",
      milestoneChests,
      welcomeAvailable,
      activeReward: null,
    };
  }

  function createReward(state, triggerType, triggerValue) {
    const activeReward = getActiveReward();

    if (activeReward) {
      return {
        reward: {
          id: "blocked_active_reward",
          type: "none",
          label: "Tu as déjà une offre active",
          description: "Réserve maintenant pour utiliser ton gain avant qu’il ne disparaisse.",
          isEmpty: true,
          status: "blocked",
        },
        state,
      };
    }

    const picked = weightedRandom(REWARDS_POOL);

    const rewardRecord = {
      rewardId: `${picked.id}_${Date.now()}`,
      type: picked.type,
      label: picked.label,
      description: picked.description,
      value: picked.value,
      isEmpty: picked.isEmpty,
      status: picked.isEmpty ? "opened_empty" : "active",
      createdAt: new Date().toISOString(),
      triggerType,
      triggerValue,
    };

    const nextState = {
      ...state,
      rewardsHistory: [rewardRecord, ...(state.rewardsHistory || [])],
      lastReward: rewardRecord,
    };

    if (!picked.isEmpty) {
      saveSessionReward(rewardRecord);
    } else {
      clearSessionReward();
    }

    return { reward: rewardRecord, state: nextState };
  }

  function openWelcomeChest(state) {
    const { reward, state: nextState } = createReward(state, "welcome", 1);
    nextState.welcomeChestOpened = true;
    return { reward, state: nextState };
  }

  function openMilestoneChest(state, milestone) {
    const { reward, state: nextState } = createReward(state, "sessions", milestone);
    if (!nextState.openedMilestones.includes(milestone)) {
      nextState.openedMilestones.push(milestone);
      nextState.openedMilestones.sort((a, b) => a - b);
    }
    return { reward, state: nextState };
  }

  function createWidgetShell() {
    const widget = document.createElement("div");
    widget.className = "sb-chest-widget";
    widget.id = "sb-chest-widget";

    widget.innerHTML = `
      <button class="sb-chest-trigger sb-locked" id="sb-chest-trigger" type="button" aria-label="${escapeHtml(CONFIG.widgetLabel)}">
        <span class="sb-chest-icon">
          <img id="sb-chest-widget-img" src="${CONFIG.assetClosed}" alt="Coffre récompense" />
        </span>
        <span class="sb-chest-badge" id="sb-chest-badge" style="display:none;">1</span>
      </button>

      <div class="sb-chest-tooltip" id="sb-chest-tooltip">
        Chargement du coffre...
      </div>
    `;

    document.body.appendChild(widget);
    return widget;
  }

  function createModalShell() {
    const overlay = document.createElement("div");
    overlay.className = "sb-chest-overlay";
    overlay.id = "sb-chest-overlay";

    overlay.innerHTML = `
      <div class="sb-chest-modal" role="dialog" aria-modal="true" aria-labelledby="sb-chest-modal-title">
        <button class="sb-chest-close" id="sb-chest-close" type="button" aria-label="Fermer">✕</button>
        <div id="sb-chest-modal-content"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function openModal() {
    const overlay = document.getElementById("sb-chest-overlay");
    if (overlay) overlay.classList.add("sb-open");
  }

  function closeModal() {
    if (isOpeningChest) return;
    const overlay = document.getElementById("sb-chest-overlay");
    if (overlay) overlay.classList.remove("sb-open");
  }

  function setModalContent(html) {
    const content = document.getElementById("sb-chest-modal-content");
    if (content) content.innerHTML = html;
  }

  function goToReservationWithReward() {
    const activeReward = getActiveReward();
    const url = new URL(CONFIG.reservationUrl, window.location.origin);

    if (activeReward && !activeReward.isEmpty) {
      url.searchParams.set("chestReward", activeReward.rewardId);
      url.searchParams.set("rewardType", activeReward.type);
      url.searchParams.set("rewardValue", String(activeReward.value));
    }

    window.location.href = url.pathname + url.search;
  }

  function renderLoggedOutModal() {
    setModalContent(`
      <div class="sb-chest-hero">
        <img src="${CONFIG.assetClosed}" alt="Coffre fermé" />
      </div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Débloque les coffres ${escapeHtml(CONFIG.brandName)}</h2>
      <p class="sb-chest-subtitle">
        Connecte-toi pour accéder aux coffres cadeaux et tenter de gagner des récompenses Singbox.
      </p>

      <div class="sb-chest-card">
        <strong>Pourquoi créer un compte ?</strong>
        <p>
          Tu pourras suivre tes réservations, voir ta progression et débloquer des coffres bonus.
        </p>
      </div>

      <div class="sb-chest-actions">
        <button class="sb-chest-btn sb-chest-btn-primary" id="sb-chest-go-login" type="button">Se connecter</button>
        <button class="sb-chest-btn sb-chest-btn-secondary" id="sb-chest-go-signup" type="button">Créer un compte</button>
      </div>
    `);

    document.getElementById("sb-chest-go-login")?.addEventListener("click", () => {
      window.location.href = CONFIG.loginUrl;
    });

    document.getElementById("sb-chest-go-signup")?.addEventListener("click", () => {
      window.location.href = CONFIG.signupUrl;
    });
  }

  function renderOpeningModal() {
    setModalContent(`
      <div class="sb-chest-opening-stage">
        <div class="sb-chest-opening-ring">
          <div class="sb-chest-hero sb-hero-opening">
            <img src="${CONFIG.assetOpening}" alt="Coffre en ouverture" />
          </div>
        </div>
        <h2 class="sb-chest-title" id="sb-chest-modal-title">Ouverture du coffre</h2>
        <p class="sb-chest-subtitle">
          La récompense est en train d’être révélée…
        </p>

        <div class="sb-chest-card">
          <strong>Patiente un instant</strong>
          <p class="sb-chest-opening-text">
            Ton coffre s’ouvre<span class="sb-chest-opening-dots"></span>
          </p>
        </div>
      </div>
    `);
  }

  function renderLoggedInModal(state) {
    const availability = getChestAvailability(true, state);
    const nextMilestone = getNextMilestone(state);
    const progressInBlock = state.completedSessions % CONFIG.sessionsPerChest;
    const progressPercent = availability.isAvailable
      ? 100
      : Math.min(100, (progressInBlock / CONFIG.sessionsPerChest) * 100);

    if (availability.activeReward) {
      const reward = availability.activeReward;
      const rewardVisual = getRewardVisual(reward);

      setModalContent(`
        <div class="sb-chest-hero">
          <img class="${rewardVisual.className}" src="${rewardVisual.src}" alt="${escapeHtml(rewardVisual.alt)}" />
        </div>
        <h2 class="sb-chest-title" id="sb-chest-modal-title">Offre active</h2>
        <p class="sb-chest-subtitle">
          Ton coffre a déjà été ouvert pendant cette visite. Réserve maintenant pour en profiter.
        </p>

        <div class="sb-chest-reward">
          <div class="sb-chest-reward-badge">${escapeHtml(reward.label)}</div>
        </div>

        <div class="sb-chest-card">
          <strong>Important</strong>
          <p>Cette offre est temporaire. Si tu quittes le site, elle disparaît.</p>
        </div>

        <div class="sb-chest-actions">
          <button class="sb-chest-btn sb-chest-btn-gold" id="sb-reward-book-now" type="button">
            Réserver maintenant
          </button>
          <button class="sb-chest-btn sb-chest-btn-secondary" id="sb-reward-close" type="button">
            Plus tard
          </button>
        </div>

        <div class="sb-chest-footnote">
          Version front V1 : l’offre reste active seulement pendant ta visite actuelle.
        </div>
      `);

      document.getElementById("sb-reward-book-now")?.addEventListener("click", goToReservationWithReward);
      document.getElementById("sb-reward-close")?.addEventListener("click", closeModal);
      return;
    }

    let chestMessage = "";
    let actionHtml = "";

    if (availability.welcomeAvailable) {
      chestMessage = `
        <div class="sb-chest-card">
          <strong>Coffre de bienvenue disponible</strong>
          <p>Ton premier coffre t’attend. Ouvre-le maintenant.</p>
        </div>
      `;
      actionHtml = `
        <button class="sb-chest-btn sb-chest-btn-gold" id="sb-open-welcome-chest" type="button">
          Ouvrir mon coffre
        </button>
      `;
    } else if (availability.milestoneChests.length > 0) {
      const milestone = availability.milestoneChests[0];
      chestMessage = `
        <div class="sb-chest-card">
          <strong>Coffre débloqué</strong>
          <p>Tu as atteint ${milestone} sessions. Ton coffre est disponible.</p>
        </div>
      `;
      actionHtml = `
        <button class="sb-chest-btn sb-chest-btn-gold" id="sb-open-session-chest" data-milestone="${milestone}" type="button">
          Ouvrir mon coffre
        </button>
      `;
    } else {
      chestMessage = `
        <div class="sb-chest-card">
          <strong>Prochain coffre bientôt</strong>
          <p>Continue à réserver pour débloquer ton prochain coffre à ${nextMilestone} sessions.</p>
        </div>
      `;
      actionHtml = `
        <button class="sb-chest-btn sb-chest-btn-primary" id="sb-go-account" type="button">
          Voir mon compte
        </button>
      `;
    }

    setModalContent(`
      <div class="sb-chest-hero">
        <img src="${CONFIG.assetClosed}" alt="Coffre fermé" />
      </div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Tes coffres ${escapeHtml(CONFIG.brandName)}</h2>
      <p class="sb-chest-subtitle">
        Ouvre un coffre quand il est disponible et découvre ta récompense instantanée.
      </p>

      ${chestMessage}

      <div class="sb-chest-progress">
        <div class="sb-chest-progress-bar">
          <div class="sb-chest-progress-fill" style="width:${progressPercent}%;"></div>
        </div>
        <div class="sb-chest-progress-text">
          ${availability.isAvailable
            ? "Un coffre est prêt à être ouvert."
            : `${progressInBlock}/${CONFIG.sessionsPerChest} sessions vers le prochain coffre`}
        </div>
      </div>

      <div class="sb-chest-actions">
        ${actionHtml}
      </div>

      <div class="sb-chest-footnote">
        Version front temporaire : la vraie logique backend sera branchée après.
      </div>
    `);

    document.getElementById("sb-go-account")?.addEventListener("click", () => {
      window.location.href = CONFIG.accountUrl;
    });

    document.getElementById("sb-open-welcome-chest")?.addEventListener("click", async () => {
      if (isOpeningChest) return;
      await handleChestOpen("welcome");
    });

    document.getElementById("sb-open-session-chest")?.addEventListener("click", async (e) => {
      if (isOpeningChest) return;
      const milestone = Number(e.currentTarget.getAttribute("data-milestone"));
      await handleChestOpen("sessions", milestone);
    });
  }

  async function handleChestOpen(type, milestone = null) {
    isOpeningChest = true;

    const trigger = document.getElementById("sb-chest-trigger");
    const widgetImg = document.getElementById("sb-chest-widget-img");

    if (trigger) {
      trigger.classList.add("sb-trigger-opening");
      trigger.disabled = true;
    }

    if (widgetImg) {
      widgetImg.src = CONFIG.assetOpening;
      widgetImg.alt = "Coffre en ouverture";
    }

    renderOpeningModal();
    await wait(CONFIG.openingDurationMs);

    const current = getState();
    const result =
      type === "welcome"
        ? openWelcomeChest(current)
        : openMilestoneChest(current, milestone);

    saveState(result.state);
    renderRewardModal(result.reward);
    isOpeningChest = false;

    if (trigger) {
      trigger.classList.remove("sb-trigger-opening");
      trigger.disabled = false;
    }

    refreshWidget();
  }

  function renderRewardModal(reward) {
    const isRealReward = reward && !reward.isEmpty && reward.status !== "blocked";
    const rewardVisual = getRewardVisual(reward);

    setModalContent(`
      <div class="sb-chest-hero">
        <img class="${rewardVisual.className}" src="${rewardVisual.src}" alt="${escapeHtml(rewardVisual.alt)}" />
      </div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Résultat du coffre</h2>
      <p class="sb-chest-subtitle">
        ${isRealReward ? "Bravo, tu as débloqué une récompense." : "Le coffre a été ouvert."}
      </p>

      <div class="sb-chest-reward">
        <div class="sb-chest-reward-badge">${escapeHtml(reward.label)}</div>
      </div>

      <div class="sb-chest-card">
        <strong>Détail</strong>
        <p>${escapeHtml(reward.description)}</p>
      </div>

      <div class="sb-chest-actions">
        ${
          isRealReward
            ? `<button class="sb-chest-btn sb-chest-btn-gold" id="sb-reward-book-now" type="button">Réserver maintenant</button>`
            : `<button class="sb-chest-btn sb-chest-btn-primary" id="sb-reward-ok" type="button">Super</button>`
        }
        <button class="sb-chest-btn sb-chest-btn-secondary" id="sb-reward-account" type="button">Voir mon compte</button>
      </div>

      <div class="sb-chest-footnote">
        ${
          isRealReward
            ? "Cette offre est temporaire et disparaît si tu quittes le site."
            : "Retente ta chance au prochain coffre."
        }
      </div>
    `);

    document.getElementById("sb-reward-ok")?.addEventListener("click", () => {
      closeModal();
    });

    document.getElementById("sb-reward-book-now")?.addEventListener("click", goToReservationWithReward);

    document.getElementById("sb-reward-account")?.addEventListener("click", () => {
      window.location.href = CONFIG.accountUrl;
    });
  }

  async function refreshWidget() {
    const sessionInfo = await detectLoggedInUser();
    const loggedIn = sessionInfo.loggedIn;
    const state = getState();
    const availability = getChestAvailability(loggedIn, state);

    const trigger = document.getElementById("sb-chest-trigger");
    const badge = document.getElementById("sb-chest-badge");
    const tooltip = document.getElementById("sb-chest-tooltip");
    const widgetImg = document.getElementById("sb-chest-widget-img");

    if (!trigger || !badge || !tooltip || !widgetImg) return;

    trigger.classList.remove("sb-available", "sb-locked", "sb-opened");

    if (!loggedIn) {
      if (!CONFIG.enableTeaserWhenLoggedOut) {
        const widget = document.getElementById("sb-chest-widget");
        if (widget) widget.style.display = "none";
        return;
      }

      trigger.classList.add("sb-locked");
      badge.style.display = "none";
      widgetImg.src = CONFIG.assetClosed;
      widgetImg.alt = "Coffre verrouillé";
      tooltip.textContent = "Crée ton compte pour débloquer les coffres cadeaux.";
      return;
    }

    if (availability.activeReward) {
      trigger.classList.add("sb-opened");
      badge.style.display = "none";
      widgetImg.src = CONFIG.assetOpen;
      widgetImg.alt = "Coffre ouvert";
      tooltip.textContent = "Tu as une offre active. Réserve maintenant avant de quitter le site.";
      return;
    }

    widgetImg.src = CONFIG.assetClosed;
    widgetImg.alt = "Coffre fermé";

    if (availability.isAvailable) {
      trigger.classList.add("sb-available");
      badge.style.display = "flex";
      badge.textContent = String(availability.availableCount);
      tooltip.textContent = availability.welcomeAvailable
        ? "Ton coffre de bienvenue est disponible."
        : `Tu as ${availability.availableCount} coffre${availability.availableCount > 1 ? "s" : ""} à ouvrir.`;
    } else {
      trigger.classList.add("sb-locked");
      badge.style.display = "none";
      const progressInBlock = state.completedSessions % CONFIG.sessionsPerChest;
      const remaining = CONFIG.sessionsPerChest - progressInBlock || CONFIG.sessionsPerChest;
      tooltip.textContent = `Encore ${remaining} session(s) avant le prochain coffre.`;
    }
  }

  function bindEvents() {
    const trigger = document.getElementById("sb-chest-trigger");
    const overlay = document.getElementById("sb-chest-overlay");
    const closeBtn = document.getElementById("sb-chest-close");

    trigger?.addEventListener("click", async () => {
      const sessionInfo = await detectLoggedInUser();
      const state = getState();

      openModal();

      if (!sessionInfo.loggedIn) {
        renderLoggedOutModal();
      } else {
        renderLoggedInModal(state);
      }
    });

    closeBtn?.addEventListener("click", () => {
      closeModal();
    });

    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  function init() {
    if (document.getElementById("sb-chest-widget")) return;

    injectStyles();
    createWidgetShell();
    createModalShell();
    bindEvents();
    refreshWidget();
  }

  window.SingboxChestWidget = {
    refresh: refreshWidget,

    async debugLogin(value) {
      localStorage.setItem(CONFIG.demoLoginKey, value ? "1" : "0");
      await refreshWidget();
    },

    async debugSetSessions(count) {
      const state = getState();
      state.completedSessions = Math.max(0, Number(count) || 0);
      saveState(state);
      await refreshWidget();
    },

    async debugAddSession() {
      const state = getState();
      state.completedSessions += 1;
      saveState(state);
      await refreshWidget();
    },

    async debugReset() {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem(CONFIG.demoLoginKey);
      sessionStorage.removeItem(CONFIG.rewardSessionKey);
      isOpeningChest = false;
      await refreshWidget();
    },

    async debugClearReward() {
      clearSessionReward();
      await refreshWidget();
    },

    async debugForceWelcomeChest() {
      const state = getState();
      state.welcomeChestOpened = false;
      saveState(state);
      clearSessionReward();
      await refreshWidget();
    },

    async debugForceMilestoneChest(milestone = 5) {
      const state = getState();
      const target = Math.max(5, Number(milestone) || 5);
      state.completedSessions = target;
      state.openedMilestones = state.openedMilestones.filter((m) => m !== target);
      saveState(state);
      clearSessionReward();
      await refreshWidget();
    },

    getState() {
      return getState();
    },

    getActiveReward() {
      return getActiveReward();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
