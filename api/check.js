const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cette fonction sera appelée quand on fait une requête GET sur /api/check?id=...
module.exports = async (req, res) => {
  try {
    const id = req.query.id; // on récupère l'id dans l'URL

    if (!id) {
      res.statusCode = 400;
      return res.json({ error: "Missing id" });
    }

    // On cherche dans la table reservations une ligne avec cet id
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      // Si on ne trouve rien → QR inconnu
      res.statusCode = 404;
      return res.json({ valid: false, reason: "Unknown QR" });
    }

    // Si on trouve une réservation, on renvoie valid: true et les infos
    return res.json({ valid: true, reservation: data });

  } catch (e) {
    console.error("Erreur /api/check :", e);
    res.statusCode = 500;
    return res.json({ error: e.message });
  }
};
