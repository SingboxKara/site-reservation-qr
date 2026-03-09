const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const fs = require("node:fs");
const path = require("node:path");

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
// Config SMTP
// ----------------------------------------------------
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn("⚠️ SMTP_HOST / SMTP_USER / SMTP_PASS manquants (envoi mail KO)");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// ----------------------------------------------------
// Helper logo
// ----------------------------------------------------
function getLogoBuffer() {
  if (process.env.LOGO_PATH) {
    const logoPathFromEnv = path.resolve(process.cwd(), process.env.LOGO_PATH);

    if (fs.existsSync(logoPathFromEnv)) {
      console.log("✅ Logo trouvé via LOGO_PATH :", logoPathFromEnv);
      return fs.readFileSync(logoPathFromEnv);
    }
  }

  const candidates = [
    path.resolve(process.cwd(), "logo.png"),
    path.resolve(process.cwd(), "assets", "logo.png"),
    path.resolve(process.cwd(), "backend", "logo.png"),
    path.resolve(process.cwd(), "backend", "assets", "logo.png"),
    path.resolve(__dirname, "logo.png"),
    path.resolve(__dirname, "..", "logo.png"),
  ];

  for (const candidatePath of candidates) {
    if (fs.existsSync(candidatePath)) {
      console.log("✅ Logo trouvé :", candidatePath);
      return fs.readFileSync(candidatePath);
    }
  }

  console.warn("⚠️ Logo introuvable. cwd=", process.cwd(), "dirname=", __dirname);
  return null;
}

// ----------------------------------------------------
// Helper date
// ----------------------------------------------------
function formatDateTime(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ----------------------------------------------------
// Helpers réponse HTTP
// ----------------------------------------------------
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  return res.json(payload);
}

// ----------------------------------------------------
// Handler principal (corrige le warning Sonar)
// ----------------------------------------------------
module.exports = async function sendReservationEmail(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Méthode non autorisée" });
  }

  const { reservationId } = req.body || {};

  if (!reservationId) {
    return sendJson(res, 400, { error: "reservationId manquant" });
  }

  try {
    if (!supabase) {
      return sendJson(res, 500, { error: "Supabase non configuré" });
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return sendJson(res, 500, { error: "SMTP non configuré" });
    }

    // ------------------------------------------------
    // 1) Récupérer réservation
    // ------------------------------------------------
    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .single();

    if (error || !reservation) {
      console.error("Erreur récupération réservation :", error);
      return sendJson(res, 404, { error: "Réservation introuvable" });
    }

    const toEmail = reservation.email;

    if (!toEmail) {
      return sendJson(res, 400, {
        error: "Email client manquant sur la réservation",
      });
    }

    // ------------------------------------------------
    // 2) QR Code
    // ------------------------------------------------
    const backendBase =
      process.env.BACKEND_BASE_URL || "https://singbox-backend.onrender.com";

    const qrText = `${backendBase}/api/check?id=${encodeURIComponent(
      reservation.id
    )}`;

    const qrDataUrl = await QRCode.toDataURL(qrText);
    const base64Data = qrDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(base64Data, "base64");

    const logoBuffer = getLogoBuffer();
    const logoCid = "logo@singbox";

    // ------------------------------------------------
    // 3) Email content
    // ------------------------------------------------
    const start = reservation.start_time
      ? new Date(reservation.start_time)
      : null;

    const end = reservation.end_time ? new Date(reservation.end_time) : null;

    const startStr = formatDateTime(start);
    const endStr = formatDateTime(end);

    const subject = `Votre réservation Singbox - Box ${reservation.box_id}`;

    const textBody = `Bonjour,

Votre réservation Singbox a bien été enregistrée ✅

Détails de votre session :
- Box : ${reservation.box_id}
- Début : ${startStr}
- Fin : ${endStr}

Votre QR code est en pièce jointe (à présenter à l'entrée).

À très vite chez Singbox 🎤
`;

    const htmlBody = `
<div style="font-family:Arial,sans-serif;line-height:1.5;">
  ${
    logoBuffer
      ? `<p style="margin:0 0 12px 0;">
           <img src="cid:${logoCid}" alt="Logo Singbox" width="80"
             style="display:block;border-radius:12px;" />
         </p>`
      : ""
  }

  <p>Bonjour,</p>
  <p>Votre réservation <strong>Singbox</strong> a bien été enregistrée ✅</p>

  <p><strong>Détails de votre session :</strong></p>
  <ul>
    <li>Box : <strong>${reservation.box_id}</strong></li>
    <li>Début : <strong>${startStr}</strong></li>
    <li>Fin : <strong>${endStr}</strong></li>
  </ul>

  <p>Présentez ce QR code à l'entrée :</p>
  <p>
    <img src="cid:qrimage@singbox" alt="QR Code Singbox"
      style="max-width:220px;height:auto;border-radius:12px;" />
  </p>

  <p style="font-size:12px;color:#666;">
    (Lien contenu dans le QR : ${qrText})
  </p>

  <p>À très vite chez Singbox 🎤</p>
</div>
`;

    // ------------------------------------------------
    // 4) Attachments
    // ------------------------------------------------
    const attachments = [
      {
        filename: "qr-reservation.png",
        content: qrBuffer,
        contentType: "image/png",
        cid: "qrimage@singbox",
      },
    ];

    if (logoBuffer) {
      attachments.push({
        filename: "logo.png",
        content: logoBuffer,
        contentType: "image/png",
        cid: logoCid,
      });
    } else {
      console.warn("⚠️ Logo introuvable.");
    }

    // ------------------------------------------------
    // 5) Envoi mail
    // ------------------------------------------------
    await transporter.sendMail({
      from: `"Singbox" <${SMTP_USER}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    console.log("✅ Email envoyé à", toEmail);

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error("❌ Erreur /api/send-email :", error);
    return sendJson(res, 500, {
      error: "Erreur lors de l'envoi de l'email",
    });
  }
};
