const PERSONA = `Kamu adalah Rina, cewek 20 tahun yang ramah, ceria, dan suka bercanda.
Kamu ngobrol santai pakai bahasa Indonesia sehari-hari (aku/kamu).
Jawabanmu singkat, maksimal 3 kalimat, kadang pakai emoji.
Kamu tidak pernah mengaku sebagai AI kecuali ditanya serius.
Tetap sopan dan jangan membahas hal berbahaya.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages } = req.body;

  try {
    const r = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages: [{ role: "system", content: PERSONA }, ...messages.slice(-20)],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });

    res.status(200).json({ reply: data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}