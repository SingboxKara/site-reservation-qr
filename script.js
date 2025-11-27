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
  const date = formData.get("date");
  const time = formData.get("time");
  const duration = parseInt(formData.get("duration"), 10);
  const boxId = parseInt(formData.get("box_id"), 10);

  if (!date || !time || !duration || !boxId) {
    message.textContent = "Veuillez remplir tous les champs.";
    return;
  }

  const startLocal = new Date(`${date}T${time}:00`);
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
    // 1) Créer la réservation
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

    // 2) Générer le QR sur la page
    if (reservationId) {
      const qrPayload = reservationId;

      qrCode = new QRCode(qrContainer, {
        text: qrPayload,
        width: 128,
        height: 128,
      });

      message.textContent += "\nQR code généré ci-dessous 👇";
    }

    // 3) Appeler l'API d'envoi d'email (en arrière-plan)
    if (reservationId) {
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      }).then((r) => {
        if (!r.ok) {
          console.error("Erreur envoi email", r.status);
        }
      }).catch((err) => {
        console.error("Erreur fetch /api/send-email", err);
      });
    }

    form.reset();
  } catch (err) {
    console.error(err);
    message.textContent = "Erreur : " + err.message;
  }
});
