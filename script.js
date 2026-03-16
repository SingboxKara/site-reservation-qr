// ===================== CONFIG PLANNING =====================
const API_BASE =
  (globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : "https://singbox-backend.onrender.com";

const BOXES = [1, 2]; // ajoute 3, 4... si tu as plus de box
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00h -> 23h
const SLOT_DURATION_MINUTES = 90;

// ===================== PANIER (localStorage) =====================
function getPanier() {
  try {
    const parsed = JSON.parse(localStorage.getItem("panier"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erreur lecture panier :", error);
    return [];
  }
}

function savePanier(panier) {
  localStorage.setItem("panier", JSON.stringify(Array.isArray(panier) ? panier : []));
  updateCartIcon();
}

function updateCartIcon() {
  const el = document.getElementById("cart-count");
  if (!el) return;

  const panier = getPanier();
  el.textContent = panier.length > 0 ? String(panier.length) : "";
  el.setAttribute("aria-hidden", panier.length > 0 ? "false" : "true");
}

// Mettre à jour l'icône panier au chargement de la page
document.addEventListener("DOMContentLoaded", updateCartIcon);

// ===================== ÉLÉMENTS DOM =====================
const nameInput = document.getElementById("name-input");
const emailInput = document.getElementById("email-input");
const dateInput = document.getElementById("date-input");
const loadButton = document.getElementById("load-button");
const planningContainer = document.getElementById("planning-container");
const message = document.getElementById("message");
const qrContainer = document.getElementById("qrcode");

// ===================== OUTILS =====================
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

function getTodayIsoDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHourRange(hour, durationMinutes = SLOT_DURATION_MINUTES) {
  const startH = hour;
  const startM = 0;

  const endTotalMinutes = startH * 60 + startM + durationMinutes;
  const endH = Math.floor((endTotalMinutes % 1440) / 60);
  const endM = endTotalMinutes % 60;

  const startLabel = `${String(startH).padStart(2, "0")}h${String(startM).padStart(2, "0")}`;
  const endLabel = `${String(endH).padStart(2, "0")}h${String(endM).padStart(2, "0")}`;

  return `${startLabel} - ${endLabel}`;
}

function buildLocalDateTime(date, hour) {
  const hourStr = String(hour).padStart(2, "0");
  return new Date(`${date}T${hourStr}:00:00`);
}

function buildSlotId(date, boxId, hour) {
  return `${date}__box${boxId}__${hour}`;
}

function isSlotAlreadyInCart(date, boxId, hour) {
  const slotId = buildSlotId(date, boxId, hour);
  return getPanier().some((item) => item && item.slotId === slotId);
}

function setMessage(text, type = "info") {
  if (!message) return;

  message.textContent = text || "";
  message.className = "";

  if (type) {
    message.dataset.type = type;
  } else {
    delete message.dataset.type;
  }
}

function clearQrPreview() {
  if (qrContainer) {
    qrContainer.innerHTML = "";
  }
}

// ===================== INIT =====================
(function initReservationPage() {
  if (!dateInput || !loadButton || !planningContainer) {
    // On est probablement sur une autre page
    return;
  }

  const params = new URLSearchParams(globalThis.location.search);
  const dateFromUrl = params.get("date");

  if (dateFromUrl) {
    dateInput.value = dateFromUrl;
  } else {
    dateInput.value = getTodayIsoDate();
  }

  if (dateInput.value) {
    loadPlanning(dateInput.value);
  }

  loadButton.addEventListener("click", () => {
    const date = dateInput.value;
    if (!date) {
      alert("Choisis une date d'abord.");
      return;
    }
    loadPlanning(date);
  });
})();

// ===================== CHARGER LE PLANNING =====================
async function loadPlanning(date) {
  planningContainer.innerHTML = "Chargement du planning...";
  setMessage("");
  clearQrPreview();

  try {
    const res = await fetch(`${API_BASE}/api/slots?date=${encodeURIComponent(date)}`);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Erreur serveur");
    }

    const reservations = Array.isArray(json.reservations) ? json.reservations : [];

    // Créneaux occupés, ex: "1-15" = box 1 à 15h
    const busySlots = new Set();

    for (const r of reservations) {
      if (!r.start_time || !r.box_id) continue;

      const start = new Date(r.start_time);
      const hour = start.getHours();
      const key = `${r.box_id}-${hour}`;
      busySlots.add(key);
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
      hourCell.className = "hour-cell";
      hourCell.textContent = `${hour.toString().padStart(2, "0")}h`;
      row.appendChild(hourCell);

      for (const box of BOXES) {
        const cell = document.createElement("td");
        const key = `${box}-${hour}`;
        const inCart = isSlotAlreadyInCart(date, box, hour);

        if (busySlots.has(key)) {
          cell.className = "slot-busy";
          cell.textContent = "Réservé";
        } else if (inCart) {
          cell.className = "slot-selected";
          cell.textContent = "Dans le panier";
        } else {
          cell.className = "slot-free";
          cell.textContent = "Libre";
          cell.dataset.boxId = String(box);
          cell.dataset.hour = String(hour);

          cell.addEventListener("click", () => {
            handleSlotClick(date, box, hour);
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
    planningContainer.innerHTML = "Erreur : " + (err.message || "Impossible de charger le planning.");
  }
}

// ===================== CLIQUE SUR UN CRÉNEAU LIBRE =====================
function handleSlotClick(date, boxId, hour) {
  const name = nameInput?.value.trim() || "";
  const email = emailInput?.value.trim() || "";

  // Si les champs existent sur ta page, on les garde pour le confort panier
  if (nameInput && !name) {
    alert("Entre d'abord ton nom.");
    nameInput.focus();
    return;
  }

  if (emailInput && !isValidEmail(email)) {
    alert("Entre d'abord une adresse e-mail valide.");
    emailInput.focus();
    return;
  }

  if (isSlotAlreadyInCart(date, boxId, hour)) {
    setMessage("Ce créneau est déjà dans votre panier.", "info");
    loadPlanning(date);
    return;
  }

  const hourLabel = formatHourRange(hour, SLOT_DURATION_MINUTES);

  const ok = confirm(
    `Ajouter ce créneau au panier ?\n\nDate : ${date}\nCréneau : ${hourLabel}\nBox : ${boxId}`
  );
  if (!ok) return;

  const startLocal = buildLocalDateTime(date, hour);
  const endLocal = new Date(startLocal.getTime() + SLOT_DURATION_MINUTES * 60000);

  const start_time = startLocal.toISOString();
  const end_time = endLocal.toISOString();

  const slot = {
    slotId: buildSlotId(date, boxId, hour),
    date,
    hour,
    heure: hourLabel,
    boxId,
    boxName: String(boxId),
    name,
    email,
    start_time,
    end_time
  };

  const panier = getPanier();
  panier.push(slot);
  savePanier(panier);

  setMessage("Créneau ajouté au panier ✅ Vous pouvez continuer votre sélection ou ouvrir votre panier.", "success");
  clearQrPreview();
  loadPlanning(date);
}
