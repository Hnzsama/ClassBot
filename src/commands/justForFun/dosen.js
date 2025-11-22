module.exports = {
  name: "#tanya-dosen",
  description: "Konsultasi dengan Dosen AI (Killer Mode).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;
    const question = text.replace("#tanya-dosen", "").trim();

    if (!question) return sock.sendMessage(from, { text: "👨‍🏫 *Dosen:* Mana pertanyaanmu? Jangan buang waktu saya." });
    if (!model) return;

    try {
      await sock.sendMessage(from, { react: { text: "👨‍🏫", key: msg.key } });
      
      const prompt = `
      Berperanlah sebagai Dosen Senior yang tegas, kritis, dan sedikit galak.
      Mahasiswa bertanya: "${question}"
      
      Instruksi:
      1. Jawab pertanyaannya, tapi dengan nada skeptis/menguji.
      2. Gunakan frasa khas dosen seperti "Referensi kamu dari mana?", "Coba baca lagi jurnalnya.", "Ini pertanyaan semester 1 lho."
      3. Tetap berikan jawaban yang benar di akhir, tapi buat mereka merasa 'tertekan' dulu.
      4. Maksimal 3 paragraf pendek.
      `;

      const result = await model.generateContent(prompt);
      const answer = result.response.text();

      await sock.sendMessage(from, { text: `👨‍🏫 *Ruang Dosen:*\n\n${answer}`, mentions: [sender] });
    } catch (e) {
      console.error(e);
    }
  }
};