// ===================== CONFIG PLANNING =====================
const BOXES = [1, 2]; // Tu peux ajouter d'autres box ici
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23

// ===================== PANIER (localStorage) =====================
function getPanier() {
  return JSON.parse(localStorage.getItem("panier")) || [];
}

function savePanier(panier) {
  localStorage.setItem("panier", JSON.stringify(panier));
  updateCartIcon();
}

function updateCartIcon() {
  const el = document.getElementById("cart-count");
  if (!el) return; // si pas d'icône panier sur la page, on ignore
  const panier = getPanier();
  el.textContent = panier.length > 0 ? panier.length : "";
}

// Met à jour le badge au chargement
document.addEventListener("DOMContentLoaded", function () {
  updateCartIcon();

  const dateInput = document.getElementById("date-input");
  const loadButton = document.getElementById("load-button");

  // Si on est bien sur la page réservation
  if (dateInput && loadButton) {
    // mettre la date du jour par défaut si vide
    if (!dateInput.value) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      dateInput.value = `${y}-${m}-${d}`;
    }

    // charger le planning au chargement initial
    if (dateInput.value) {
      loadPlanning(dateInput.value);
    }

    // bouton "Voir les créneaux"
    loadButton.addEventListener("click", () => {
      const date = dateInput.value;
      if (!date) {
        alert("Choisis une date d'abord.");
        return;
      }
      loadPlanning(date);
    });
  }
});

// ===================== CHARGER LE PLANNING =====================

async function loadPlanning(date) {
  const planningContainer = document.getElementById("planning-container");
  if (!planningContainer) return;

  planningContainer.innerHTML = "Chargement...";

  try {
    const res = await fetch(`/api/slots?date=${encodeURIComponent(date)}`);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Erreur serveur");
    }

    const reservations = json.reservations || [];

    // On construit un set des créneaux occupés, ex: "1-15" = box 1 à 15h
    const busySlots = new Set();
    for (const r of reservations) {
      if (!r.start_time || !r.box_id) continue;
      const start = new Date(r.start_time);
      const hour = start.getHours(); // 0..23
      const key = `${r.box_id}-${hour}`;
      busySlots.add(key);
    }

    // Générer le tableau HTML
    const table = document.createElement("table");

    // Ligne d'entête : "Heure" + Box 1, Box 2, ...
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const emptyTh = document.createElement("th");
    emptyTh.textContent = "Heure";
    headRow.appendChild(emptyTh);

    for (const box of BOXES) {
      const th = document.createElement("th");
      th.textContent = `Box ${box}`;
      headRow.appendChild(th);
    }

    thead.appendChild(headRow);
    table.appendChild(thead);

    // Corps du tableau
    const tbody = document.createElement("tbody");

    for (const hour of HOURS) {
      const row = document.createElement("tr");

      const hourCell = document.createElement("td");
      hourCell.className = "hour-cell";
      hourCell.textContent = `${hour.toString().padStart(2, "0")}h`;
      row.appendChild(hourCell);

      for (const box of BOXES) {
        const cell = document.createElement("td");
        const key = `${box}-${hour}`;

        if (busySlots.has(key)) {
          cell.className = "slot-busy";
          cell.textContent = "Réservé";
        } else {
          cell.className = "slot-free";
          cell.textContent = "Libre";

          // Clic sur créneau libre => ajout au panier
          cell.addEventListener("click", () => {
            addSlotToBasket(date, box, hour, cell);
          });
        }

        row.appendChild(cell);
      }

      tbody.appendChild(row);
    }

    table.appendChild(tbody);

    planningContainer.innerHTML = "";
    planningContainer.appendChild(table);
  } catch (err) {
    console.error(err);
    planningContainer.innerHTML = "Erreur : " + err.message;
  }
}

// ===================== AJOUT AU PANIER =====================

function addSlotToBasket(date, box, hour, cell) {
  const hourLabel = `${hour.toString().padStart(2, "0")}h - ${((hour + 1) % 24)
    .toString()
    .padStart(2, "0")}h`;

  const ok = confirm(
    `Ajouter ce créneau au panier ?\n\nDate : ${date}\nBox : ${box}\nCréneau : ${hourLabel}`
  );
  if (!ok) return;

  const panier = getPanier();
  panier.push({
    date,
    box,
    hour,
    hourLabel,
  });
  savePanier(panier);

  // Feedback visuel
  if (cell) {
    cell.textContent = "Ajouté ✓";
    cell.classList.remove("slot-free");
    cell.classList.add("slot-selected");
  }

  alert("Créneau ajouté au panier !");
}
