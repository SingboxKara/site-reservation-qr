// ===================== CONFIG PLANNING =====================
const BOXES = [1, 2]; // ajoute 3, 4... si tu as plus de box
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00h -> 23h

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
  const panier = getPanier();
  el.textContent = panier.length > 0 ? panier.length : "";
}

// Mettre à jour l'icône panier au chargement de la page
document.addEventListener("DOMContentLoaded", updateCartIcon);

// Éléments du DOM (uniquement sur reservation.html)
const nameInput = document.getElementById("name-input");
const emailInput = document.getElementById("email-input");
const dateInput = document.getElementById("date-input");
const loadButton = document.getElementById("load-button");
const planningContainer = document.getElementById("planning-container");
const message = document.getElementById("message");
const qrContainer = document.getElementById("qrcode");

let qrCode = null;

// ===================== INIT =====================
(function initReservationPage() {
  if (!dateInput || !loadButton) {
    // On est probablement sur une autre page (ex: index, concept)
    return;
  }

  // 1) Récupérer une date depuis l'URL si présente
  const params = new URLSearchParams(window.location.search);
  const dateFromUrl = params.get("date");

  if (dateFromUrl) {
    dateInput.value = dateFromUrl;
  } else {
    // sinon, mettre la date du jour
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    dateInput.value = `${y}-${m}-${d}`;
  }

  // 2) Charger le planning pour la date actuelle
  if (dateInput.value) {
    loadPlanning(dateInput.value);
  }

  // 3) Bouton "Voir les créneaux"
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
  message.textContent = "";
  qrContainer.innerHTML = "";
  qrCode = null;

  try {
    const res = await fetch(`/api/slots?date=${encodeURIComponent(date)}`);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Erreur serveur");
    }

    const reservations = json.reservations || [];

    // Créneaux occupés, ex: "1-15" = box 1 à 15h
    const busySlots = new Set();
    for (const r of reservations) {
      if (!r.start_time || !r.box_id) continue;
      const start = new Date(r.start_time);
      const hour = start.getHours(); // 0..23
      const key = `${r.box_id}-${hour}`;
      busySlots.add(key);
    }

    // ----- Génération du tableau -----
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

        if (busySlots.has(key)) {
          cell.className = "slot-busy";
          cell.textContent = "Réservé";
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
    planningContainer.innerHTML = "Erreur : " + err.message;
  }
}

// ===================== CLIQUE SUR UN CRÉNEAU LIBRE =====================
async function handleSlotClick(date, boxId, hour) {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name || !email) {
    alert("Entre d'abord ton nom et ton email.");
    return;
  }

  const hourLabel = `${hour.toString().padStart(2, "0")}h - ${((hour + 1) % 24)
    .toString()
    .padStart(2, "0")}h`;

  const ok = confirm(
    `Confirmer la réservation ?\n\nDate : ${date}\nCréneau : ${hourLabel}\nBox : ${boxId}\nNom : ${name}\nEmail : ${email}`
  );
  if (!ok) return;

  // Créneau d'1h
  const hourStr = `${hour.toString().padStart(2, "0")}:00`;
  const startLocal = new Date(`${date}T${hourStr}:00`);
  const endLocal = new Date(startLocal.getTime() + 60 * 60000);

  const start_time = startLocal.toISOString();
  const end_time = endLocal.toISOString();

  const payload = {
    name,
    email,
    start_time,
    end_time,
    box_id: boxId,
  };

  message.textContent = "Création de la réservation...";
  qrContainer.innerHTML = "";
  qrCode = null;

  try {
    // 1) Création de la réservation
    const res = await fetch("/api/reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Erreur serveur");
    }

    const reservation = json.reservation;
    const reservationId = reservation && reservation.id;

    message.textContent = "Réservation enregistrée ✅";

    // 2bis) Ajouter la réservation dans le panier local
    if (reservationId) {
      const slot = {
        reservationId,
        date,
        heure: hourLabel,
        boxId,
        name,
        email,
        start_time,
        end_time,
      };

      const panier = getPanier();
      panier.push(slot);
      savePanier(panier);
    }

    // 2) QR code à l'écran
    if (reservationId) {
      qrCode = new QRCode(qrContainer, {
        text: reservationId,
        width: 128,
        height: 128,
      });
      message.textContent += "\nQR code généré ci-dessous 👇";
    }

    // 3) Envoi d'email (en arrière-plan)
    if (reservationId) {
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      }).catch((err) => {
        console.error("Erreur /api/send-email :", err);
      });
    }

    // 4) Rafraîchir le planning pour bloquer le créneau
    loadPlanning(date);
  } catch (err) {
    console.error(err);
    message.textContent = "Erreur : " + err.message;
  }
}
