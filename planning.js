// ===================== CONFIG PLANNING =====================
const BOXES = [1, 2]; 
const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
  if (!el) return;
  const p = getPanier();
  el.textContent = p.length > 0 ? p.length : "";
}

document.addEventListener("DOMContentLoaded", updateCartIcon);

// ===================== DOM =====================
const dateInput = document.getElementById("date-input");
const loadButton = document.getElementById("load-button");
const planningContainer = document.getElementById("planning-container");

if (loadButton) {
  loadButton.addEventListener("click", () => {
    const date = dateInput.value;
    if (!date) {
      alert("Choisis une date d'abord.");
      return;
    }
    loadPlanning(date);
  });
}

// ===================== PLANNING =====================
async function loadPlanning(date) {
  planningContainer.innerHTML = "Chargement...";
  try {
    const res = await fetch(`/api/slots?date=${encodeURIComponent(date)}`);
    const json = await res.json();

    if (!res.ok) throw new Error(json.error);

    const reservations = json.reservations || [];

    const busySlots = new Set();
    for (const r of reservations) {
      const start = new Date(r.start_time);
      busySlots.add(`${r.box_id}-${start.getHours()}`);
    }

    const table = document.createElement("table");

    // En-tête
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

    // Corps
    const tbody = document.createElement("tbody");

    for (const hour of HOURS) {
      const row = document.createElement("tr");

      const hourCell = document.createElement("td");
      hourCell.textContent = `${hour.toString().padStart(2, "0")}h`;
      hourCell.className = "hour-cell";
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

          // ========== CLIC → AJOUT PANIER ==========
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
    planningContainer.textContent = "Erreur : " + err.message;
  }
}

// ===================== AJOUT AU PANIER =====================
function addSlotToBasket(date, box, hour, cell) {
  const slot = {
    date,
    box,
    hour,
    label: `${hour}h - ${hour + 1}h`
  };

  const ok = confirm(
    `Ajouter ce créneau au panier ?\n\nDate : ${date}\nBox : ${box}\nHeure : ${slot.label}`
  );
  if (!ok) return;

  const panier = getPanier();
  panier.push(slot);
  savePanier(panier);

  cell.textContent = "Ajouté ✓";
  cell.classList.add("slot-selected");

  alert("Créneau ajouté au panier !");
}
