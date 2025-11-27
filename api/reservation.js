const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ error: "Méthode non autorisée" });
  }

  const { name, email, start_time, end_time, box_id } = req.body || {};

  if (!name || !email || !start_time || !end_time || !box_id) {
    res.statusCode = 400;
    return res.json({ error: "Champs manquants" });
  }

  try {
    // 1. Vérifier si la box est déjà occupée sur ce créneau
    // Condition d'OVERLAP : existing.start < new_end AND existing.end > new_start
    const { data: conflicts, error: conflictError } = await supabase
      .from("reservations")
      .select("id, start_time, end_time, box_id")
      .eq("box_id", box_id)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflictError) {
      console.error("Erreur vérification conflits :", conflictError);
      res.statusCode = 500;
      return res.json({ error: "Erreur serveur (conflit)" });
    }

    if (conflicts && conflicts.length > 0) {
      res.statusCode = 400;
      return res.json({
        error:
          "Ce créneau est déjà réservé pour cette box. Choisissez une autre heure ou une autre box.",
      });
    }

    // 2. Insérer la réservation
    const { data, error } = await supabase
      .from("reservations")
      .insert([
        {
          name,
          email,
          start_time,
          end_time,
          box_id,
          status: "confirmed",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Erreur insertion réservation :", error);
      throw error;
    }

    res.statusCode = 200;
    return res.json({ success: true, reservation: data });
  } catch (e) {
    console.error("Erreur /api/reservation :", e);
    res.statusCode = 500;
    return res.json({ error: "Erreur serveur" });
  }
};
