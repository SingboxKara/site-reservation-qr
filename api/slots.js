const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.json({ error: "Méthode non autorisée" });
  }

  const date = req.query.date; // format attendu : "2025-11-27"

  if (!date) {
    res.statusCode = 400;
    return res.json({ error: "Paramètre 'date' manquant (YYYY-MM-DD)" });
  }

  try {
    // Début et fin de la journée locale
    const dayStartLocal = new Date(`${date}T00:00:00`);
    const dayEndLocal = new Date(`${date}T23:59:59`);

    const dayStartIso = dayStartLocal.toISOString();
    const dayEndIso = dayEndLocal.toISOString();

    // On récupère toutes les réservations qui commencent ce jour-là
    const { data, error } = await supabase
      .from("reservations")
      .select("id, box_id, start_time, end_time")
      .gte("start_time", dayStartIso)
      .lte("start_time", dayEndIso);

    if (error) {
      console.error("Erreur /api/slots Supabase :", error);
      res.statusCode = 500;
      return res.json({ error: "Erreur serveur Supabase" });
    }

    // On renvoie la liste brute, le front fera la grille
    res.statusCode = 200;
    return res.json({ reservations: data || [] });
  } catch (e) {
    console.error("Erreur /api/slots :", e);
    res.statusCode = 500;
    return res.json({ error: "Erreur serveur" });
  }
};
