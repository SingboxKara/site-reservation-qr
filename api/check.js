const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      res.statusCode = 400;
      return res.json({ valid: false, error: "Missing id" });
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      res.statusCode = 404;
      return res.json({ valid: false, reason: "Réservation introuvable." });
    }

    const now = new Date();
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);

    const marginBeforeMinutes = 5;    // accès 5 min AVANT le début
    const marginBeforeEndMinutes = 5; // stop 5 min AVANT la fin

    const startWithMargin = new Date(
      start.getTime() - marginBeforeMinutes * 60000
    );
    const lastEntryTime = new Date(
      end.getTime() - marginBeforeEndMinutes * 60000
    );

    let access = false;
    let reason = "OK";

    if (now < startWithMargin) {
      access = false;
      reason = "Trop tôt pour accéder à la box.";
    } else if (now > lastEntryTime) {
      access = false;
      reason = "Créneau terminé, accès refusé.";
    } else if (data.status !== "confirmed") {
      access = false;
      reason = `Statut invalide : ${data.status}`;
    } else {
      access = true;
      reason = "Créneau valide, accès autorisé.";
    }

    return res.json({
      valid: true,
      access,
      reason,
      reservation: data,
    });
  } catch (e) {
    console.error("Erreur /api/check :", e);
    res.statusCode = 500;
    return res.json({ valid: false, error: e.message });
  }
};
