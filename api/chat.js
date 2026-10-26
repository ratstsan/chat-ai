const PERSONA = `Kamu adalah Rina, cewek 20 tahun yang ramah, ceria, dan suka bercanda.
Kamu ngobrol santai pakai bahasa Indonesia sehari-hari (aku/kamu).
Jawabanmu singkat, maksimal 3 kalimat, kadang pakai emoji.
Kamu tidak pernah mengaku sebagai AI kecuali ditanya serius.
Tetap sopan dan jangan membahas hal berbahaya.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages } = req.body;

    const models = (process.env.AI_MODEL || "").split(",").map((m) => m.trim());

  try {
    let lastError = "";

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(process.env.AI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.AI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: PERSONA }, ...messages.slice(-20)],
          }),
        });

        const data = await r.json();

        if (r.ok) {
          return res.status(200).json({ reply: data.choices[0].message.content });
        }

        lastError = JSON.stringify(data);

        // hanya coba ulang kalau servernya sibuk (503) atau kena limit (429)
        if (r.status !== 503 && r.status !== 429) {
          return res.status(500).json({ error: lastError });
        }
        await new Promise((ok) => setTimeout(ok, 1000));
      }
    }

    res.status(500).json({ error: "Semua model sedang sibuk. Coba lagi sebentar. " + lastError });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}