const BOXES = [1, 2]; // Tu peux ajouter d'autres box ici
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23

const dateInput = document.getElementById("date-input");
const loadButton = document.getElementById("load-button");
const planningContainer = document.getElementById("planning-container");

loadButton.addEventListener("click", () => {
  const date = dateInput.value;
  if (!date) {
    alert("Choisis une date d'abord.");
    return;
  }
  loadPlanning(date);
});

async function loadPlanning(date) {
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

    // Ligne d'entête : vide + Box 1, Box 2, ...
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
