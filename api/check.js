const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCESS_MARGIN_BEFORE_MINUTES = 5;
const ACCESS_MARGIN_BEFORE_END_MINUTES = 5;
const MS_PER_MINUTE = 60_000;
const CONFIRMED_STATUS = "confirmed";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function buildDateFromValue(value) {
  return new Date(value);
}

function isInvalidDate(date) {
  return Number.isNaN(date.getTime());
}

function subtractMinutes(date, minutes) {
  return new Date(date.getTime() - minutes * MS_PER_MINUTE);
}

function buildInvalidReservationDatesResponse(res) {
  res.statusCode = 500;
  return res.json({
    valid: false,
    error: "Dates de réservation invalides.",
  });
}

function buildMissingIdResponse(res) {
  res.statusCode = 400;
  return res.json({
    valid: false,
    error: "Missing id",
  });
}

function buildReservationNotFoundResponse(res) {
  res.statusCode = 404;
  return res.json({
    valid: false,
    reason: "Réservation introuvable.",
  });
}

function computeAccess(now, reservation) {
  const start = buildDateFromValue(reservation.start_time);
  const end = buildDateFromValue(reservation.end_time);

  if (isInvalidDate(start) || isInvalidDate(end)) {
    return {
      hasDateError: true,
      access: false,
      reason: "Dates de réservation invalides.",
    };
  }

  const startWithMargin = subtractMinutes(start, ACCESS_MARGIN_BEFORE_MINUTES);
  const lastEntryTime = subtractMinutes(end, ACCESS_MARGIN_BEFORE_END_MINUTES);

  if (now < startWithMargin) {
    return {
      hasDateError: false,
      access: false,
      reason: "Trop tôt pour accéder à la box.",
    };
  }

  if (now > lastEntryTime) {
    return {
      hasDateError: false,
      access: false,
      reason: "Créneau terminé, accès refusé.",
    };
  }

  if (reservation.status !== CONFIRMED_STATUS) {
    return {
      hasDateError: false,
      access: false,
      reason: `Statut invalide : ${reservation.status}`,
    };
  }

  return {
    hasDateError: false,
    access: true,
    reason: "Créneau valide, accès autorisé.",
  };
}

async function fetchReservationById(id) {
  return supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();
}

module.exports = async function checkReservationAccess(req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return buildMissingIdResponse(res);
    }

    const { data, error } = await fetchReservationById(id);

    if (error || !data) {
      return buildReservationNotFoundResponse(res);
    }

    const now = new Date();
    const accessResult = computeAccess(now, data);

    if (accessResult.hasDateError) {
      return buildInvalidReservationDatesResponse(res);
    }

    return res.json({
      valid: true,
      access: accessResult.access,
      reason: accessResult.reason,
      reservation: data,
    });
  } catch (error) {
    console.error("Erreur /api/check :", error);
    res.statusCode = 500;
    return res.json({
      valid: false,
      error: error.message,
    });
  }
};
