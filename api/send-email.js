const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const fs = require("node:fs");
const path = require("node:path");

// ----------------------------------------------------
// Config Supabase
// ----------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante");
}

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ----------------------------------------------------
// Config SMTP
// ----------------------------------------------------
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn("⚠️ SMTP_HOST / SMTP_USER / SMTP_PASS manquants (envoi mail KO)");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ----------------------------------------------------
// Helper logo : lit le fichier et renvoie un buffer
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
// Handler
// ----------------------------------------------------
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ error: "Méthode non autorisée" });
  }

  const { reservationId } = req.body || {};

  if (!reservationId) {
    res.statusCode = 400;
    return res.json({ error: "reservationId manquant" });
  }

  try {
    if (!supabase) {
      res.statusCode = 500;
      return res.json({ error: "Supabase non configuré" });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      res.statusCode = 500;
      return res.json({ error: "SMTP non configuré" });
    }

    // 1) Récupérer la réservation
    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .single();

    if (error || !reservation) {
      console.error("Erreur récupération réservation :", error);
      res.statusCode = 404;
      return res.json({ error: "Réservation introuvable" });
    }

    const toEmail = reservation.email;
    if (!toEmail) {
      res.statusCode = 400;
      return res.json({ error: "Email client manquant sur la réservation" });
    }

    // 2) QR code
    const backendBase =
      process.env.BACKEND_BASE_URL || "https://singbox-backend.onrender.com";
    const qrText = `${backendBase}/api/check?id=${encodeURIComponent(
      reservation.id
    )}`;

    const qrDataUrl = await QRCode.toDataURL(qrText);
    const base64Data = qrDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(base64Data, "base64");

    // Logo
    const logoBuffer = getLogoBuffer();
    const logoCid = "logo@singbox";

    // 3) Contenu email
    const start = reservation.start_time ? new Date(reservation.start_time) : null;
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

    // 4) Pièces jointes inline
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
      console.warn(
        "⚠️ Logo introuvable. Mets LOGO_PATH=logo.png (ou le bon chemin) dans tes variables d'env."
      );
    }

    // 5) Envoi
    const mailOptions = {
      from: `"Singbox" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    console.log("✅ Email envoyé à", toEmail);

    res.statusCode = 200;
    return res.json({ success: true });
  } catch (e) {
    console.error("❌ Erreur /api/send-email :", e);
    res.statusCode = 500;
    return res.json({ error: "Erreur lors de l'envoi de l'email" });
  }
};
