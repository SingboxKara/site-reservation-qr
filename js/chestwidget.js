(() => {
  "use strict";

  /*
    ==========================================================
    SINGBOX CHEST WIDGET — V1 FRONT ONLY
    ----------------------------------------------------------
    - Widget flottant bas gauche
    - Etat connecté / non connecté
    - Coffre de bienvenue
    - 1 coffre tous les 5 passages
    - Récompenses simulées en localStorage
    - CSS injecté automatiquement
    ==========================================================
  */

  const CONFIG = {
    position: "left", // "left" ou "right"
    loginUrl: "/connexion.html",
    signupUrl: "/mon-compte.html",
    accountUrl: "/mon-compte.html",

    // Clés localStorage
    storageKey: "singbox_chest_widget_v1",
    demoLoginKey: "singbox_demo_logged_in",

    // Réglages
    sessionsPerChest: 5,
    maxActiveRewardCount: 1,
    enableTeaserWhenLoggedOut: true,

    // Affichage
    brandName: "Singbox",
    widgetLabel: "Coffre cadeaux",
  };

  const DEFAULT_STATE = {
    welcomeChestOpened: false,
    completedSessions: 0,
    openedMilestones: [], // ex: [5, 10, 15]
    rewards: [], // historique et récompenses actives
    lastReward: null,
  };

  const REWARDS_POOL = [
    {
      id: "coins_50",
      type: "points",
      label: "+50 Singcoins",
      description: "Tu gagnes 50 Singcoins.",
      weight: 35,
      value: 50,
      isEmpty: false,
    },
    {
      id: "coins_100",
      type: "points",
      label: "+100 Singcoins",
      description: "Tu gagnes 100 Singcoins.",
      weight: 20,
      value: 100,
      isEmpty: false,
    },
    {
      id: "discount_5_eur",
      type: "discount_fixed",
      label: "5€ de réduction",
      description: "5€ de réduction sur ta prochaine session.",
      weight: 15,
      value: 5,
      isEmpty: false,
    },
    {
      id: "discount_10_percent",
      type: "discount_percent",
      label: "-10%",
      description: "-10% sur ta prochaine session.",
      weight: 10,
      value: 10,
      isEmpty: false,
    },
    {
      id: "empty",
      type: "none",
      label: "Pas de gain cette fois",
      description: "Pas de gain cette fois, mais retente ta chance au prochain coffre.",
      weight: 20,
      value: 0,
      isEmpty: true,
    },
  ];

  function injectStyles() {
    if (document.getElementById("sb-chest-widget-styles")) return;

    const style = document.createElement("style");
    style.id = "sb-chest-widget-styles";
    style.textContent = `
      .sb-chest-widget {
        position: fixed;
        z-index: 9999;
        bottom: 22px;
        ${CONFIG.position === "right" ? "right: 22px;" : "left: 22px;"}
        font-family: Inter, Arial, sans-serif;
      }

      .sb-chest-trigger {
        width: 68px;
        height: 68px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #111827, #1f2937);
        box-shadow: 0 10px 30px rgba(0,0,0,0.24);
        color: #fff;
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        position: relative;
        overflow: hidden;
      }

      .sb-chest-trigger:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 14px 36px rgba(0,0,0,0.30);
      }

      .sb-chest-trigger.sb-available {
        animation: sbChestPulse 1.8s infinite;
      }

      .sb-chest-trigger.sb-locked {
        opacity: 0.92;
      }

      .sb-chest-icon {
        font-size: 30px;
        line-height: 1;
      }

      .sb-chest-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        min-width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #facc15;
        color: #111827;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      }

      .sb-chest-tooltip {
        position: absolute;
        bottom: 78px;
        ${CONFIG.position === "right" ? "right: 0;" : "left: 0;"}
        background: rgba(17,24,39,0.96);
        color: #fff;
        padding: 10px 12px;
        border-radius: 14px;
        font-size: 13px;
        width: 220px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.22);
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
        background: rgba(2, 6, 23, 0.62);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 16px;
      }

      .sb-chest-overlay.sb-open {
        display: flex;
      }

      .sb-chest-modal {
        width: 100%;
        max-width: 420px;
        background: #ffffff;
        border-radius: 22px;
        padding: 22px;
        box-shadow: 0 28px 70px rgba(0,0,0,0.22);
        position: relative;
        color: #111827;
      }

      .sb-chest-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 38px;
        height: 38px;
        border: none;
        border-radius: 999px;
        background: #f3f4f6;
        color: #111827;
        cursor: pointer;
        font-size: 18px;
      }

      .sb-chest-title {
        font-size: 22px;
        font-weight: 800;
        margin: 0 0 8px;
      }

      .sb-chest-subtitle {
        margin: 0 0 16px;
        color: #4b5563;
        font-size: 14px;
        line-height: 1.5;
      }

      .sb-chest-hero {
        width: 92px;
        height: 92px;
        border-radius: 22px;
        margin: 0 auto 16px;
        background: linear-gradient(135deg, #111827, #374151);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        color: #fff;
      }

      .sb-chest-card {
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        padding: 14px;
        margin-bottom: 14px;
      }

      .sb-chest-card strong {
        display: block;
        margin-bottom: 6px;
        font-size: 15px;
      }

      .sb-chest-card p {
        margin: 0;
        color: #4b5563;
        font-size: 14px;
        line-height: 1.5;
      }

      .sb-chest-progress {
        margin: 12px 0 4px;
      }

      .sb-chest-progress-bar {
        height: 10px;
        background: #e5e7eb;
        border-radius: 999px;
        overflow: hidden;
      }

      .sb-chest-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #f59e0b, #facc15);
        border-radius: 999px;
        transition: width 0.25s ease;
      }

      .sb-chest-progress-text {
        margin-top: 8px;
        font-size: 13px;
        color: #6b7280;
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
        transition: transform 0.15s ease, opacity 0.15s ease;
      }

      .sb-chest-btn:hover {
        transform: translateY(-1px);
      }

      .sb-chest-btn-primary {
        background: #111827;
        color: #fff;
      }

      .sb-chest-btn-secondary {
        background: #f3f4f6;
        color: #111827;
      }

      .sb-chest-btn-gold {
        background: linear-gradient(135deg, #d97706, #facc15);
        color: #111827;
      }

      .sb-chest-reward {
        text-align: center;
        padding: 12px 10px 4px;
      }

      .sb-chest-reward-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 14px;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        font-weight: 800;
        font-size: 14px;
        margin-bottom: 10px;
      }

      .sb-chest-footnote {
        margin-top: 12px;
        font-size: 12px;
        color: #9ca3af;
        line-height: 1.45;
      }

      @keyframes sbChestPulse {
        0%   { transform: scale(1); box-shadow: 0 10px 30px rgba(0,0,0,0.24); }
        50%  { transform: scale(1.06); box-shadow: 0 18px 38px rgba(250,204,21,0.35); }
        100% { transform: scale(1); box-shadow: 0 10px 30px rgba(0,0,0,0.24); }
      }

      @media (max-width: 640px) {
        .sb-chest-widget {
          bottom: 16px;
          ${CONFIG.position === "right" ? "right: 16px;" : "left: 16px;"}
        }

        .sb-chest-trigger {
          width: 62px;
          height: 62px;
        }

        .sb-chest-modal {
          padding: 18px;
          border-radius: 18px;
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
    } catch (e) {
      return fallback;
    }
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

  function isDemoLoggedIn() {
    return localStorage.getItem(CONFIG.demoLoginKey) === "1";
  }

  async function detectLoggedInUser() {
    // 1) hook manuel si tu veux l’injecter depuis ton site
    if (window.__SINGBOX_USER__ && window.__SINGBOX_USER__.id) {
      return {
        loggedIn: true,
        user: window.__SINGBOX_USER__,
        source: "window.__SINGBOX_USER__",
      };
    }

    // 2) client Supabase custom global
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
      } catch (e) {}
    }

    // 3) autre nom global possible
    if (window.sb && window.sb.auth?.getSession) {
      try {
        const result = await window.sb.auth.getSession();
        const session = result?.data?.session || null;
        if (session?.user) {
          return {
            loggedIn: true,
            user: session.user,
            source: "window.sb",
          };
        }
      } catch (e) {}
    }

    // 4) fallback démo front-only
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

  function getActiveRewards(state) {
    return state.rewards.filter((reward) => reward.status === "active");
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
    if (!loggedIn) {
      return {
        isAvailable: false,
        availableCount: 0,
        type: "logged_out",
      };
    }

    const milestoneChests = getAvailableMilestoneChests(state);
    const welcomeAvailable = hasWelcomeChestAvailable(state);

    const count = (welcomeAvailable ? 1 : 0) + milestoneChests.length;

    return {
      isAvailable: count > 0,
      availableCount: count,
      type: count > 0 ? "available" : "locked",
      milestoneChests,
      welcomeAvailable,
    };
  }

  function createReward(state, triggerType, triggerValue) {
    const activeRewards = getActiveRewards(state);

    // Pour rester simple en V1 : une seule récompense active max
    if (activeRewards.length >= CONFIG.maxActiveRewardCount) {
      return {
        reward: {
          id: "blocked_active_reward",
          type: "none",
          label: "Tu as déjà une récompense active",
          description: "Utilise d’abord ta récompense en cours avant d’en débloquer une nouvelle.",
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
      rewards: [rewardRecord, ...state.rewards],
      lastReward: rewardRecord,
    };

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
      <button class="sb-chest-trigger sb-locked" id="sb-chest-trigger" type="button" aria-label="${CONFIG.widgetLabel}">
        <span class="sb-chest-icon">🎁</span>
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
    const overlay = document.getElementById("sb-chest-overlay");
    if (overlay) overlay.classList.remove("sb-open");
  }

  function setModalContent(html) {
    const content = document.getElementById("sb-chest-modal-content");
    if (content) content.innerHTML = html;
  }

  function renderLoggedOutModal() {
    setModalContent(`
      <div class="sb-chest-hero">🎁</div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Débloque les coffres ${CONFIG.brandName}</h2>
      <p class="sb-chest-subtitle">
        Crée ton compte pour accéder aux coffres cadeaux et tenter de gagner des réductions ou des points fidélité.
      </p>

      <div class="sb-chest-card">
        <strong>Pourquoi créer un compte ?</strong>
        <p>
          Tu pourras suivre tes réservations, débloquer un coffre de bienvenue, puis un nouveau coffre toutes les ${CONFIG.sessionsPerChest} sessions.
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

  function renderLoggedInModal(state) {
    const availability = getChestAvailability(true, state);
    const nextMilestone = getNextMilestone(state);
    const progressInBlock = state.completedSessions % CONFIG.sessionsPerChest;
    const progressPercent = availability.isAvailable
      ? 100
      : Math.min(100, (progressInBlock / CONFIG.sessionsPerChest) * 100);

    const activeReward = getActiveRewards(state)[0] || null;

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

    const activeRewardHtml = activeReward
      ? `
        <div class="sb-chest-card">
          <strong>Récompense active</strong>
          <p>${activeReward.label} — ${activeReward.description}</p>
        </div>
      `
      : "";

    setModalContent(`
      <div class="sb-chest-hero">🎁</div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Tes coffres ${CONFIG.brandName}</h2>
      <p class="sb-chest-subtitle">
        Débloque un coffre à la création du compte, puis un nouveau coffre toutes les ${CONFIG.sessionsPerChest} sessions validées.
      </p>

      ${chestMessage}
      ${activeRewardHtml}

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
        Version front temporaire : les récompenses sont simulées localement pour tester l’UX.
      </div>
    `);

    document.getElementById("sb-go-account")?.addEventListener("click", () => {
      window.location.href = CONFIG.accountUrl;
    });

    document.getElementById("sb-open-welcome-chest")?.addEventListener("click", () => {
      const current = getState();
      const result = openWelcomeChest(current);
      saveState(result.state);
      renderRewardModal(result.reward);
      refreshWidget();
    });

    document.getElementById("sb-open-session-chest")?.addEventListener("click", (e) => {
      const milestone = Number(e.currentTarget.getAttribute("data-milestone"));
      const current = getState();
      const result = openMilestoneChest(current, milestone);
      saveState(result.state);
      renderRewardModal(result.reward);
      refreshWidget();
    });
  }

  function renderRewardModal(reward) {
    const isRealReward = reward && !reward.isEmpty && reward.status !== "blocked";

    setModalContent(`
      <div class="sb-chest-hero">${isRealReward ? "✨" : "🎁"}</div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Résultat du coffre</h2>
      <p class="sb-chest-subtitle">
        ${isRealReward ? "Bravo, tu as débloqué une récompense." : "Le coffre a été ouvert."}
      </p>

      <div class="sb-chest-reward">
        <div class="sb-chest-reward-badge">${reward.label}</div>
      </div>

      <div class="sb-chest-card">
        <strong>Détail</strong>
        <p>${reward.description}</p>
      </div>

      <div class="sb-chest-actions">
        <button class="sb-chest-btn sb-chest-btn-primary" id="sb-reward-ok" type="button">Super</button>
        <button class="sb-chest-btn sb-chest-btn-secondary" id="sb-reward-account" type="button">Voir mon compte</button>
      </div>

      <div class="sb-chest-footnote">
        Plus tard, cette récompense pourra être reliée à ton vrai compte et à tes vraies réservations.
      </div>
    `);

    document.getElementById("sb-reward-ok")?.addEventListener("click", () => {
      closeModal();
    });

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

    if (!trigger || !badge || !tooltip) return;

    trigger.classList.remove("sb-available", "sb-locked");

    if (!loggedIn) {
      if (!CONFIG.enableTeaserWhenLoggedOut) {
        const widget = document.getElementById("sb-chest-widget");
        if (widget) widget.style.display = "none";
        return;
      }

      trigger.classList.add("sb-locked");
      badge.style.display = "none";
      tooltip.textContent = "Crée ton compte pour débloquer les coffres cadeaux.";
      return;
    }

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
      tooltip.textContent = `Encore ${CONFIG.sessionsPerChest - progressInBlock || CONFIG.sessionsPerChest} session(s) avant le prochain coffre.`;
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

    closeBtn?.addEventListener("click", closeModal);

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

  /*
    ==========================================================
    OUTILS DE TEST — À GARDER POUR LA V1
    ----------------------------------------------------------
    Utilisation dans la console :
    SingboxChestWidget.debugLogin(true)
    SingboxChestWidget.debugLogin(false)
    SingboxChestWidget.debugSetSessions(5)
    SingboxChestWidget.debugAddSession()
    SingboxChestWidget.debugReset()
    SingboxChestWidget.refresh()
    ==========================================================
  */
  window.SingboxChestWidget = {
    refresh: refreshWidget,

    debugLogin(value) {
      localStorage.setItem(CONFIG.demoLoginKey, value ? "1" : "0");
      refreshWidget();
    },

    debugSetSessions(count) {
      const state = getState();
      state.completedSessions = Math.max(0, Number(count) || 0);
      saveState(state);
      refreshWidget();
    },

    debugAddSession() {
      const state = getState();
      state.completedSessions += 1;
      saveState(state);
      refreshWidget();
    },

    debugReset() {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem(CONFIG.demoLoginKey);
      refreshWidget();
    },

    getState() {
      return getState();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
