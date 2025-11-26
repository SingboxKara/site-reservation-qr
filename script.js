const form = document.getElementById("reservation-form");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "Envoi en cours...";

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

    message.textContent = "Réservation enregistrée ✅";
    form.reset();
  } catch (err) {
    console.error(err);
    message.textContent = "Erreur : " + err.message;
  }
});
