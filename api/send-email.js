const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Transport SMTP (Gmail, OVH, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
    // 1) Récupérer la réservation dans Supabase
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

    // 2) Générer le QR code (basé sur l'id de réservation)
    const qrText = reservation.id; // ce qu'on met dans le QR
    const qrDataUrl = await QRCode.toDataURL(qrText); // "data:image/png;base64,...."

    // On extrait la partie base64
    const base64Data = qrDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(base64Data, "base64");

    // 3) Construire l'email
    const start = reservation.start_time
      ? new Date(reservation.start_time)
      : null;
    const end = reservation.end_time ? new Date(reservation.end_time) : null;

    const formatDateTime = (d) =>
      d
        ? d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "N/A";

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
      <p>Bonjour,</p>
      <p>Votre réservation <strong>Singbox</strong> a bien été enregistrée ✅</p>
      <p><strong>Détails de votre session :</strong></p>
      <ul>
        <li>Box : <strong>${reservation.box_id}</strong></li>
        <li>Début : <strong>${startStr}</strong></li>
        <li>Fin : <strong>${endStr}</strong></li>
      </ul>
      <p>Votre QR code est ci-dessous et en pièce jointe (à présenter à l'entrée) :</p>
      <p><img src="cid:qrimage@singbox" alt="QR Code Singbox" /></p>
      <p>À très vite chez Singbox 🎤</p>
    `;

    const mailOptions = {
      from: `"Singbox" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          filename: "qr-reservation.png",
          content: qrBuffer,
          contentType: "image/png",
          cid: "qrimage@singbox", // pour l'afficher dans le HTML avec <img src="cid:qrimage@singbox">
        },
      ],
    };

    // 4) Envoi du mail
    await transporter.sendMail(mailOptions);

    console.log("Email envoyé à", toEmail);

    res.statusCode = 200;
    return res.json({ success: true });
  } catch (e) {
    console.error("Erreur /api/send-email :", e);
    res.statusCode = 500;
    return res.json({ error: "Erreur lors de l'envoi de l'email" });
  }
};
