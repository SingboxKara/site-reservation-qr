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
  const data = {
    name: formData.get("name"),
    email: formData.get("email"),
    datetime: formData.get("datetime"),
  };

  try {
    const res = await fetch("/api/reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Erreur serveur");
    }

    // On récupère la réservation renvoyée par l'API
    const reservation = json.reservation;
    const reservationId = reservation && reservation.id;

    message.textContent = "Réservation enregistrée ✅";

    if (reservationId) {
      const qrPayload = reservationId; // ce qui sera dans le QR

      // Génération du QR dans la div #qrcode
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
