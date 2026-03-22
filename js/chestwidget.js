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
      description: "Le coffre était vide... mais le prochain sera peut-être le bon 🎤",
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
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
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
        background: rgba(2, 6, 23, 0.72);
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
        max-width: 430px;
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98));
        border-radius: 22px;
        padding: 22px;
        box-shadow: 0 28px 70px rgba(0,0,0,0.28);
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
        font-family: "League Spartan", system-ui, sans-serif;
        font-size: 24px;
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
        box-shadow: 0 14px 34px rgba(0,0,0,0.16);
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
        background: linear-gradient(90deg, #c94c35, #f97316);
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
      }

      .sb-chest-btn-secondary {
        background: #f3f4f6;
        color: #111827;
      }

      .sb-chest-btn-gold {
        background: linear-gradient(135deg, #c94c35, #f97316);
        color: #fff;
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
        background: #ffedd5;
        color: #9a3412;
        font-weight: 800;
        font-size: 14px;
        margin-bottom: 10px;
      }

      .sb-chest-footnote {
        margin-top: 12px;
        font-size: 12px;
        color: #6b7280;
        line-height: 1.45;
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

      @media (max-width: 640px) {
        .sb-chest-widget {
          bottom: 16px;
          right: 16px;
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
    } catch {
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
      <div class="sb-chest-hero">🎁</div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Débloque les coffres ${CONFIG.brandName}</h2>
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

  function renderLoggedInModal(state) {
    const availability = getChestAvailability(true, state);
    const nextMilestone = getNextMilestone(state);
    const progressInBlock = state.completedSessions % CONFIG.sessionsPerChest;
    const progressPercent = availability.isAvailable
      ? 100
      : Math.min(100, (progressInBlock / CONFIG.sessionsPerChest) * 100);

    if (availability.activeReward) {
      const reward = availability.activeReward;

      setModalContent(`
        <div class="sb-chest-hero">✨</div>
        <h2 class="sb-chest-title" id="sb-chest-modal-title">Offre active</h2>
        <p class="sb-chest-subtitle">
          Ton coffre a déjà été ouvert pendant cette visite. Réserve maintenant pour en profiter.
        </p>

        <div class="sb-chest-reward">
          <div class="sb-chest-reward-badge">${reward.label}</div>
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
      <div class="sb-chest-hero">🎁</div>
      <h2 class="sb-chest-title" id="sb-chest-modal-title">Tes coffres ${CONFIG.brandName}</h2>
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

    document.getElementById("sb-open-welcome-chest")?.addEventListener("click", () => {
      const btn = document.getElementById("sb-open-welcome-chest");
      if (btn) btn.disabled = true;

      const current = getState();
      const result = openWelcomeChest(current);
      saveState(result.state);
      renderRewardModal(result.reward);
      refreshWidget();
    });

    document.getElementById("sb-open-session-chest")?.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      if (btn) btn.disabled = true;

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
    const icon = document.querySelector("#sb-chest-trigger .sb-chest-icon");

    if (!trigger || !badge || !tooltip || !icon) return;

    trigger.classList.remove("sb-available", "sb-locked", "sb-opened");

    if (!loggedIn) {
      if (!CONFIG.enableTeaserWhenLoggedOut) {
        const widget = document.getElementById("sb-chest-widget");
        if (widget) widget.style.display = "none";
        return;
      }

      trigger.classList.add("sb-locked");
      badge.style.display = "none";
      icon.textContent = "🎁";
      tooltip.textContent = "Crée ton compte pour débloquer les coffres cadeaux.";
      return;
    }

    if (availability.activeReward) {
      trigger.classList.add("sb-opened");
      badge.style.display = "none";
      icon.textContent = "✨";
      tooltip.textContent = "Tu as une offre active. Réserve maintenant avant de quitter le site.";
      return;
    }

    icon.textContent = "🎁";

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
      sessionStorage.removeItem(CONFIG.rewardSessionKey);
      refreshWidget();
    },

    debugClearReward() {
      clearSessionReward();
      refreshWidget();
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
