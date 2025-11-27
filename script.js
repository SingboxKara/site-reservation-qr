const form = document.getElementById("reservation-form");
const message = document.getElementById("message");
const qrContainer = document.getElementById("qrcode");

let qrCode = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "Envoi en cours...";
  qrContainer.innerHTML = "";
  qrCode = null;

  const formData = new FormData(form);

  const name = formData.get("name");
  const email = formData.get("email");
  const date = formData.get("date");      // ex: 2025-11-27
  const time = formData.get("time");      // ex: 20:00
  const duration = parseInt(formData.get("duration"), 10); // minutes
  const boxId = parseInt(formData.get("box_id"), 10);

  if (!date || !time || !duration || !boxId) {
    message.textContent = "Veuillez remplir tous les champs.";
    return;
  }

  // Construire start_time en ISO
  const startLocal = new Date(`${date}T${time}:00`); // heure locale
  const endLocal = new Date(startLocal.getTime() + duration * 60000);

  const start_time = startLocal.toISOString();
  const end_time = endLocal.toISOString();

  const payload = {
    name,
    email,
    start_time,
    end_time,
    box_id: boxId,
  };

  try {
    const res = await fetch("/api/reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      // on montre l'erreur renvoyée par l'API (créneau pris, etc.)
      throw new Error(json.error || "Erreur serveur");
    }

    const reservation = json.reservation;
    const reservationId = reservation && reservation.id;

    message.textContent = "Réservation enregistrée ✅";

    if (reservationId) {
      const qrPayload = reservationId; // ce qu'on met dans le QR

      qrCode = new QRCode(qrContainer, {
        text: qrPayload,
        width: 128,
        height: 128,
      });

      message.textContent += "\nQR code généré ci-dessous 👇";
    }

    form.reset();
  } catch (err) {
    console.error(err);
    message.textContent = "Erreur : " + err.message;
  }
});
