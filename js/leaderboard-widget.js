<script>
  (() => {
    "use strict";

    const LeaderboardWidget = {
      endpoint: "/api/leaderboards/home?limit=5",
      rootSelector: "#sb-leaderboard-root",

      init() {
        const root = document.querySelector(this.rootSelector);
        if (!root) return;

        root.innerHTML = `
          <div class="sb-leaderboard-widget">
            <div class="sb-leaderboard-header">
              <div>
                <div class="sb-leaderboard-badge">🎤 Communauté Singbox</div>
                <h2 id="sb-leaderboard-title">Le classement Singbox</h2>
                <p>
                  Découvrez les chanteurs les plus réguliers, les plus actifs et les plus avancés de la communauté.
                </p>
              </div>
            </div>

            <div class="sb-leaderboard-tabs" role="tablist" aria-label="Classements Singbox">
              <button class="sb-leaderboard-tab is-active" type="button" data-tab="streak" role="tab" aria-selected="true">
                Régularité
              </button>
              <button class="sb-leaderboard-tab" type="button" data-tab="sessions" role="tab" aria-selected="false">
                Sessions
              </button>
              <button class="sb-leaderboard-tab" type="button" data-tab="levels" role="tab" aria-selected="false">
                Niveaux
              </button>
            </div>

            <div class="sb-leaderboard-panels">
              <div class="sb-leaderboard-panel is-active" data-panel="streak">
                <div class="sb-leaderboard-loading">Chargement du classement…</div>
              </div>

              <div class="sb-leaderboard-panel" data-panel="sessions">
                <div class="sb-leaderboard-loading">Chargement du classement…</div>
              </div>

              <div class="sb-leaderboard-panel" data-panel="levels">
                <div class="sb-leaderboard-loading">Chargement du classement…</div>
              </div>
            </div>
          </div>
        `;

        this.bindTabs(root);
        this.load(root);
      },

      bindTabs(root) {
        const tabs = root.querySelectorAll(".sb-leaderboard-tab");
        const panels = root.querySelectorAll(".sb-leaderboard-panel");

        tabs.forEach((tab) => {
          tab.addEventListener("click", () => {
            const target = tab.dataset.tab;

            tabs.forEach((btn) => {
              const active = btn === tab;
              btn.classList.toggle("is-active", active);
              btn.setAttribute("aria-selected", active ? "true" : "false");
            });

            panels.forEach((panel) => {
              panel.classList.toggle("is-active", panel.dataset.panel === target);
            });
          });
        });
      },

      async load(root) {
        try {
          const response = await fetch(this.endpoint, {
            method: "GET",
            headers: { "Accept": "application/json" }
          });

          if (!response.ok) {
            throw new Error("Réponse serveur invalide");
          }

          const data = await response.json();

          if (!data || !data.ok) {
            throw new Error("Données leaderboard invalides");
          }

          this.renderPanel(
            root,
            "streak",
            data.streak || [],
            (item) => ({
              value: item.streak_current,
              suffix: item.streak_current > 1 ? "semaines" : "semaine",
              meta: `Meilleure série : ${item.streak_best} • Niveau ${item.level_current} • ${item.xp_total} XP`
            })
          );

          this.renderPanel(
            root,
            "sessions",
            data.sessions || [],
            (item) => ({
              value: item.sessions_completed,
              suffix: item.sessions_completed > 1 ? "sessions" : "session",
              meta: `${item.minutes_sung_total || 0} min chantées au total`
            })
          );

          this.renderPanel(
            root,
            "levels",
            data.levels || [],
            (item) => ({
              value: item.level_current,
              suffix: item.level_name || "niveau",
              meta: `${item.xp_total} XP • Série actuelle : ${item.streak_current} • ${item.sessions_completed} session${item.sessions_completed > 1 ? "s" : ""}`
            })
          );
        } catch (error) {
          console.error("Erreur leaderboard widget :", error);
          this.renderError(root, "streak");
          this.renderError(root, "sessions");
          this.renderError(root, "levels");
        }
      },

      renderPanel(root, panelName, items, formatter) {
        const panel = root.querySelector(`[data-panel="${panelName}"]`);
        if (!panel) return;

        if (!items.length) {
          panel.innerHTML = `<div class="sb-leaderboard-empty">Le classement sera bientôt disponible.</div>`;
          return;
        }

        const html = items
          .map((item) => {
            const formatted = formatter(item);

            return `
              <article class="sb-leaderboard-item">
                <div class="sb-leaderboard-rank">#${item.rank}</div>

                <div class="sb-leaderboard-main">
                  <p class="sb-leaderboard-name">${this.escapeHtml(item.display_name || "Membre Singbox")}</p>
                  <p class="sb-leaderboard-meta">${this.escapeHtml(formatted.meta)}</p>
                </div>

                <div class="sb-leaderboard-value">
                  <strong>${this.escapeHtml(String(formatted.value))}</strong>
                  <span>${this.escapeHtml(formatted.suffix)}</span>
                </div>
              </article>
            `;
          })
          .join("");

        panel.innerHTML = `<div class="sb-leaderboard-list">${html}</div>`;
      },

      renderError(root, panelName) {
        const panel = root.querySelector(`[data-panel="${panelName}"]`);
        if (!panel) return;

        panel.innerHTML = `
          <div class="sb-leaderboard-error">
            Impossible de charger le classement pour le moment.
          </div>
        `;
      },

      escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
    };

    document.addEventListener("DOMContentLoaded", () => {
      LeaderboardWidget.init();
    });
  })();
</script>
