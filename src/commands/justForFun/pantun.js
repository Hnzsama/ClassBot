module.exports = {
  name: "#rhyme",
  alias: ["#pantun"],
  description: "Generate funny rhymes. Format: #rhyme [Topic]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;

    // Ambil topik dari input
    const topic = text.replace("#pantun", "").trim() || "Random/Bebas";

    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI sedang tidak aktif." });

    try {
      await sock.sendMessage(from, { react: { text: "🎤", key: msg.key } });

      const prompt = `
      Buatkan satu bait pantun Indonesia (4 baris, sajak a-b-a-b) yang lucu atau bijak.
      Topik: "${topic}".
      
      Aturan:
      - Baris 1-2 adalah sampiran (biasanya tentang alam/benda).
      - Baris 3-4 adalah isi (poin utamanya).
      - Bahasa santai dan gaul tapi sopan.
      - JANGAN kasih penjelasan "Ini pantunnya", langsung teks pantunnya saja.
      `;

      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      await sock.sendMessage(from, {
        text: `🎋 *PANTUN HARI INI*\nTopik: ${topic}\n\n${response}`
      });

    } catch (e) {
      console.error("Error pantun:", e);
      await sock.sendMessage(from, { text: "❌ Gagal merakit pantun." });
    }
  }
};