import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ error: "Méthode non autorisée" });
  }

  const { name, email, datetime } = req.body;

  if (!name || !email || !datetime) {
    res.statusCode = 400;
    return res.json({ error: "Champs manquants" });
  }

  try {
    const { data, error } = await supabase
      .from("reservations")
      .insert([{ name, email, datetime }])
      .select()
      .single();

    if (error) throw error;

    res.statusCode = 200;
    return res.json({ success: true, reservation: data });
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    return res.json({ error: "Erreur serveur" });
  }
}
