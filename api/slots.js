const { createClient } = require("@supabase/supabase-js");

// ----------------------------------------------------
// Config Supabase
// ----------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante");
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  return res.json(payload);
}

function buildDayRange(dateString) {
  const dayStartLocal = new Date(`${dateString}T00:00:00`);
  const dayEndLocal = new Date(`${dateString}T23:59:59`);

  return {
    startIso: dayStartLocal.toISOString(),
    endIso: dayEndLocal.toISOString(),
  };
}

// ----------------------------------------------------
// Handler principal
// ----------------------------------------------------
module.exports = async function getReservationSlots(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Méthode non autorisée" });
  }

  const date = req.query.date; // format attendu : YYYY-MM-DD

  if (!date) {
    return sendJson(res, 400, {
      error: "Paramètre 'date' manquant (YYYY-MM-DD)",
    });
  }

  if (!supabase) {
    return sendJson(res, 500, {
      error: "Supabase non configuré",
    });
  }

  try {
    const { startIso, endIso } = buildDayRange(date);

    // ------------------------------------------------
    // Récupérer réservations du jour
    // ------------------------------------------------
    const { data, error } = await supabase
      .from("reservations")
      .select("id, box_id, start_time, end_time")
      .gte("start_time", startIso)
      .lte("start_time", endIso);

    if (error) {
      console.error("Erreur /api/slots Supabase :", error);
      return sendJson(res, 500, {
        error: "Erreur serveur Supabase",
      });
    }

    return sendJson(res, 200, {
      reservations: data || [],
    });
  } catch (error) {
    console.error("Erreur /api/slots :", error);

    return sendJson(res, 500, {
      error: "Erreur serveur",
    });
  }
};
