const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const METHOD_NOT_ALLOWED_STATUS = 405;
const BAD_REQUEST_STATUS = 400;
const SERVER_ERROR_STATUS = 500;
const SUCCESS_STATUS = 200;
const CONFIRMED_STATUS = "confirmed";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  return res.json(payload);
}

function isPostMethod(req) {
  return req.method === "POST";
}

function getReservationPayload(body = {}) {
  const { name, email, start_time, end_time, box_id } = body;

  return {
    name,
    email,
    start_time,
    end_time,
    box_id,
  };
}

function hasMissingReservationFields(payload) {
  return !payload.name ||
    !payload.email ||
    !payload.start_time ||
    !payload.end_time ||
    !payload.box_id;
}

async function fetchReservationConflicts({ box_id, start_time, end_time }) {
  return supabase
    .from("reservations")
    .select("id, start_time, end_time, box_id")
    .eq("box_id", box_id)
    .lt("start_time", end_time)
    .gt("end_time", start_time);
}

function hasConflicts(conflicts) {
  return Array.isArray(conflicts) && conflicts.length > 0;
}

async function insertReservation({ name, email, start_time, end_time, box_id }) {
  return supabase
    .from("reservations")
    .insert([
      {
        name,
        email,
        start_time,
        end_time,
        box_id,
        status: CONFIRMED_STATUS,
      },
    ])
    .select()
    .single();
}

module.exports = async function createReservation(req, res) {
  if (!isPostMethod(req)) {
    return sendJson(res, METHOD_NOT_ALLOWED_STATUS, {
      error: "Méthode non autorisée",
    });
  }

  const reservationPayload = getReservationPayload(req.body);

  if (hasMissingReservationFields(reservationPayload)) {
    return sendJson(res, BAD_REQUEST_STATUS, {
      error: "Champs manquants",
    });
  }

  try {
    const { data: conflicts, error: conflictError } =
      await fetchReservationConflicts(reservationPayload);

    if (conflictError) {
      console.error("Erreur vérification conflits :", conflictError);
      return sendJson(res, SERVER_ERROR_STATUS, {
        error: "Erreur serveur (conflit)",
      });
    }

    if (hasConflicts(conflicts)) {
      return sendJson(res, BAD_REQUEST_STATUS, {
        error:
          "Ce créneau est déjà réservé pour cette box. Choisissez une autre heure ou une autre box.",
      });
    }

    const { data, error } = await insertReservation(reservationPayload);

    if (error) {
      console.error("Erreur insertion réservation :", error);
      throw error;
    }

    return sendJson(res, SUCCESS_STATUS, {
      success: true,
      reservation: data,
    });
  } catch (error) {
    console.error("Erreur /api/reservation :", error);
    return sendJson(res, SERVER_ERROR_STATUS, {
      error: "Erreur serveur",
    });
  }
};
