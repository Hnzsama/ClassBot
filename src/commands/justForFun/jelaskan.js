module.exports = {
  name: "#jelaskan",
  description: "Jelaskan materi dengan bahasa tongkrongan.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;
    const topic = text.replace("#jelaskan", "").trim();

    if (!topic) return sock.sendMessage(from, { text: "⚠️ Mau dijelasin apa bro?" });
    if (!model) return;

    try {
      await sock.sendMessage(from, { react: { text: "💡", key: msg.key } });
      
      const prompt = `
      Jelaskan topik: "${topic}"
      Target audiens: Mahasiswa/Anak muda Indonesia.
      Gaya bahasa: Santai, gaul, bahasa tongkrongan (lo-gue/aku-kamu), lucu.
      
      Instruksi:
      1. Gunakan analogi kehidupan sehari-hari yang *relate* (misal: percintaan, game, makanan, ojol).
      2. Jangan kaku seperti Wikipedia.
      3. Buat penjelasannya menjadi sangat sederhana (ELI5 - Explain Like I'm 5).
      `;

      const result = await model.generateContent(prompt);
      const answer = result.response.text();

      await sock.sendMessage(from, { text: `💡 *PENJELASAN SIMPEL*\n\n${answer}`, mentions: [sender] });
    } catch (e) {
      console.error(e);
    }
  }
};